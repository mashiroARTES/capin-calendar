// シフトAPIルート

import { Hono } from 'hono'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const shifts = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// シフト一覧取得（未ログインでも閲覧可能）
shifts.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const calendarSlug = c.req.query('calendar');
    const year = c.req.query('year');
    const month = c.req.query('month');
    const userId = c.req.query('user_id');
    
    let query = `
      SELECT 
        s.id, s.user_id, s.calendar_id, s.shift_date,
        s.start_time, s.end_time, s.note, s.status,
        s.animal_type, s.activity_type, s.activity_custom,
        s.location_type, s.location_custom,
        s.override_name, s.created_at,
        COALESCE(s.override_name, u.name) as user_name,
        u.name as real_user_name, u.email as user_email,
        cal.name as calendar_name, cal.color as calendar_color, cal.slug as calendar_slug
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      JOIN calendars cal ON s.calendar_id = cal.id
      WHERE 1=1
    `;
    
    const params: unknown[] = [];
    
    if (calendarSlug) {
      query += ' AND cal.slug = ?';
      params.push(calendarSlug);
    }
    
    if (year && month) {
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
      const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-31`;
      query += ' AND s.shift_date >= ? AND s.shift_date <= ?';
      params.push(startDate, endDate);
    } else if (year) {
      query += ' AND s.shift_date LIKE ?';
      params.push(`${year}-%`);
    }
    
    if (userId) {
      query += ' AND s.user_id = ?';
      params.push(parseInt(userId));
    }
    
    query += ' ORDER BY s.shift_date ASC, s.start_time ASC, u.name ASC';
    
    const stmt = c.env.DB.prepare(query);
    const { results } = await stmt.bind(...params).all();
    
    return c.json({ shifts: results });
    
  } catch (err) {
    console.error('Get shifts error:', err);
    return c.json({ error: 'シフト取得に失敗しました' }, 500);
  }
});

// シフト作成（ログイン必須）
shifts.post('/', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const body = await c.req.json();
    const {
      calendar_id, shift_date, start_time, end_time, note,
      activity_type, activity_custom,
      location_type, location_custom,
      // 管理者が任意ユーザー名でシフト登録するための override_user_name
      override_user_name,
    } = body;
    
    if (!calendar_id || !shift_date) {
      return c.json({ error: 'カレンダーと日付は必須です' }, 400);
    }
    
    // 活動内容バリデーション
    const validActivityTypes = ['dog', 'cat', 'other_animal', 'office', 'negotiation', 'supplies', 'transport', 'rescue', 'capture', 'other_custom'];
    const activityTypeValue = activity_type && validActivityTypes.includes(activity_type) ? activity_type : 'dog';
    const activityCustomValue = activityTypeValue === 'other_custom' ? (activity_custom || null) : null;

    // 場所バリデーション
    const validLocationTypes = ['shelter1', 'shelter2', 'animal_hospital', 'other_location', null];
    const locationTypeValue = location_type && validLocationTypes.includes(location_type) ? location_type : null;
    const locationCustomValue = locationTypeValue === 'other_location' ? (location_custom || null) : null;
    
    // 日付フォーマット確認
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(shift_date)) {
      return c.json({ error: '日付の形式が正しくありません (YYYY-MM-DD)' }, 400);
    }
    
    // 時間フォーマット確認（HH:MM または スロットキー morning/afternoon/night/evening を許可）
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    const validSlotKeys = ['morning', 'afternoon', 'night', 'evening', 'noon'];
    if (start_time && !timeRegex.test(start_time) && !validSlotKeys.includes(start_time)) {
      return c.json({ error: '開始時刻の形式が正しくありません' }, 400);
    }
    if (end_time && !timeRegex.test(end_time) && !validSlotKeys.includes(end_time)) {
      return c.json({ error: '終了時刻の形式が正しくありません' }, 400);
    }
    
    // カレンダー存在確認
    const calendar = await c.env.DB.prepare(
      'SELECT id FROM calendars WHERE id = ?'
    ).bind(calendar_id).first();
    
    if (!calendar) {
      return c.json({ error: 'カレンダーが見つかりません' }, 404);
    }
    
    // 重複チェックなし（同一ユーザー・同日・同カレンダーで複数登録可能）

    // 代理登録: override_user_name が指定された場合、override_name に保存（任意名義・DB照合なし）
    const overrideNameValue = (userRole === 'admin' && override_user_name)
      ? override_user_name.trim().slice(0, 30)
      : null;

    // シフト作成
    const result = await c.env.DB.prepare(`
      INSERT INTO shifts (
        user_id, calendar_id, shift_date, start_time, end_time, note, status,
        animal_type, activity_type, activity_custom,
        location_type, location_custom, override_name
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      userId,
      calendar_id,
      shift_date,
      start_time || null,
      end_time || null,
      note || null,
      activityTypeValue,      // animal_type互換
      activityTypeValue,      // activity_type
      activityCustomValue,
      locationTypeValue,
      locationCustomValue,
      overrideNameValue,
    ).first();

    // user_name を override_name 優先で組み立てて返す
    const adminUser = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{name:string}>();
    const responseShift = result ? { ...result, user_name: overrideNameValue || adminUser?.name || '' } : result;

    return c.json({ message: 'シフトを登録しました', shift: responseShift }, 201);
    
  } catch (err) {
    console.error('Create shift error:', err);
    return c.json({ error: 'シフト登録に失敗しました' }, 500);
  }
});

// シフト更新（ログイン必須）
shifts.put('/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const shiftId = parseInt(c.req.param('id'));
    
    // シフト取得
    const shift = await c.env.DB.prepare(
      'SELECT * FROM shifts WHERE id = ?'
    ).bind(shiftId).first<{ user_id: number; status: string }>();
    
    if (!shift) {
      return c.json({ error: 'シフトが見つかりません' }, 404);
    }
    
    // 権限確認（本人または管理者のみ編集可能）
    if (shift.user_id !== userId && userRole !== 'admin') {
      return c.json({ error: 'このシフトを編集する権限がありません' }, 403);
    }
    
    const {
      start_time, end_time, note, status,
      activity_type, activity_custom,
      location_type, location_custom,
    } = await c.req.json();
    
    // 活動内容バリデーション
    const validActivityTypes = ['dog', 'cat', 'other_animal', 'office', 'negotiation', 'supplies', 'transport', 'rescue', 'capture', 'other_custom'];
    const newActivityType = activity_type && validActivityTypes.includes(activity_type) ? activity_type : undefined;
    const newActivityCustom = newActivityType === 'other_custom' ? (activity_custom || null) : null;

    // 場所バリデーション
    const validLocationTypes = ['shelter1', 'shelter2', 'animal_hospital', 'other_location'];
    const newLocationType = location_type && validLocationTypes.includes(location_type) ? location_type : undefined;
    const newLocationCustom = newLocationType === 'other_location' ? (location_custom || null) : null;
    
    // 時間フォーマット確認（HH:MM または スロットキー morning/afternoon/night/evening を許可）
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    const validSlotKeys = ['morning', 'afternoon', 'night', 'evening', 'noon'];
    if (start_time && !timeRegex.test(start_time) && !validSlotKeys.includes(start_time)) {
      return c.json({ error: '開始時刻の形式が正しくありません' }, 400);
    }
    if (end_time && !timeRegex.test(end_time) && !validSlotKeys.includes(end_time)) {
      return c.json({ error: '終了時刻の形式が正しくありません' }, 400);
    }
    
    // ステータス変更は管理者のみ
    let newStatus = (shift as any).status;
    if (status && userRole === 'admin') {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'ステータスが不正です' }, 400);
      }
      newStatus = status;
    }
    
    const result = await c.env.DB.prepare(`
      UPDATE shifts 
      SET start_time = ?,
          end_time = ?,
          note = ?,
          status = ?,
          animal_type = COALESCE(?, animal_type),
          activity_type = COALESCE(?, activity_type),
          activity_custom = ?,
          location_type = COALESCE(?, location_type),
          location_custom = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `).bind(
      start_time !== undefined ? start_time : null,
      end_time !== undefined ? end_time : null,
      note !== undefined ? note : null,
      newStatus,
      newActivityType || null,
      newActivityType || null,
      newActivityCustom,
      newLocationType || null,
      newLocationCustom,
      shiftId
    ).first();
    
    return c.json({ message: 'シフトを更新しました', shift: result });
    
  } catch (err) {
    console.error('Update shift error:', err);
    return c.json({ error: 'シフト更新に失敗しました' }, 500);
  }
});

// シフト削除（ログイン必須）
shifts.delete('/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const shiftId = parseInt(c.req.param('id'));
    
    const shift = await c.env.DB.prepare(
      'SELECT user_id FROM shifts WHERE id = ?'
    ).bind(shiftId).first<{ user_id: number }>();
    
    if (!shift) {
      return c.json({ error: 'シフトが見つかりません' }, 404);
    }
    
    if (shift.user_id !== userId && userRole !== 'admin') {
      return c.json({ error: 'このシフトを削除する権限がありません' }, 403);
    }
    
    await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(shiftId).run();
    
    return c.json({ message: 'シフトを削除しました' });
    
  } catch (err) {
    console.error('Delete shift error:', err);
    return c.json({ error: 'シフト削除に失敗しました' }, 500);
  }
});

export default shifts;
