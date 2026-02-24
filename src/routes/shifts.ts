// シフトAPIルート

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const shifts = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全ルートに認証ミドルウェア適用
shifts.use('*', authMiddleware)

// シフト一覧取得（カレンダー・月でフィルタリング）
shifts.get('/', async (c) => {
  try {
    const calendarSlug = c.req.query('calendar');
    const year = c.req.query('year');
    const month = c.req.query('month');
    const userId = c.req.query('user_id');
    
    let query = `
      SELECT 
        s.id, s.user_id, s.calendar_id, s.shift_date,
        s.start_time, s.end_time, s.note, s.status, s.created_at,
        u.name as user_name, u.email as user_email,
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

// シフト作成
shifts.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const { calendar_id, shift_date, start_time, end_time, note } = await c.req.json();
    
    if (!calendar_id || !shift_date) {
      return c.json({ error: 'カレンダーと日付は必須です' }, 400);
    }
    
    // 日付フォーマット確認
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(shift_date)) {
      return c.json({ error: '日付の形式が正しくありません (YYYY-MM-DD)' }, 400);
    }
    
    // 時間フォーマット確認
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (start_time && !timeRegex.test(start_time)) {
      return c.json({ error: '開始時刻の形式が正しくありません (HH:MM)' }, 400);
    }
    if (end_time && !timeRegex.test(end_time)) {
      return c.json({ error: '終了時刻の形式が正しくありません (HH:MM)' }, 400);
    }
    
    // カレンダー存在確認
    const calendar = await c.env.DB.prepare(
      'SELECT id FROM calendars WHERE id = ?'
    ).bind(calendar_id).first();
    
    if (!calendar) {
      return c.json({ error: 'カレンダーが見つかりません' }, 404);
    }
    
    // 重複チェック（同一ユーザー・同一日・同一カレンダー）
    const existing = await c.env.DB.prepare(
      'SELECT id FROM shifts WHERE user_id = ? AND calendar_id = ? AND shift_date = ?'
    ).bind(userId, calendar_id, shift_date).first();
    
    if (existing) {
      return c.json({ error: 'この日付には既にシフトが登録されています。編集してください。' }, 409);
    }
    
    // シフト作成
    const result = await c.env.DB.prepare(`
      INSERT INTO shifts (user_id, calendar_id, shift_date, start_time, end_time, note, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
      RETURNING id, user_id, calendar_id, shift_date, start_time, end_time, note, status, created_at
    `).bind(
      userId,
      calendar_id,
      shift_date,
      start_time || null,
      end_time || null,
      note || null
    ).first();
    
    return c.json({ message: 'シフトを登録しました', shift: result }, 201);
    
  } catch (err) {
    console.error('Create shift error:', err);
    return c.json({ error: 'シフト登録に失敗しました' }, 500);
  }
});

// シフト更新
shifts.put('/:id', async (c) => {
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
    
    const { start_time, end_time, note, status } = await c.req.json();
    
    // 時間フォーマット確認
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (start_time && !timeRegex.test(start_time)) {
      return c.json({ error: '開始時刻の形式が正しくありません (HH:MM)' }, 400);
    }
    if (end_time && !timeRegex.test(end_time)) {
      return c.json({ error: '終了時刻の形式が正しくありません (HH:MM)' }, 400);
    }
    
    // ステータス変更は管理者のみ
    let newStatus = shift.status;
    if (status && userRole === 'admin') {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'ステータスが不正です' }, 400);
      }
      newStatus = status;
    }
    
    const result = await c.env.DB.prepare(`
      UPDATE shifts 
      SET start_time = ?, end_time = ?, note = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `).bind(
      start_time !== undefined ? start_time : null,
      end_time !== undefined ? end_time : null,
      note !== undefined ? note : null,
      newStatus,
      shiftId
    ).first();
    
    return c.json({ message: 'シフトを更新しました', shift: result });
    
  } catch (err) {
    console.error('Update shift error:', err);
    return c.json({ error: 'シフト更新に失敗しました' }, 500);
  }
});

// シフト削除
shifts.delete('/:id', async (c) => {
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
