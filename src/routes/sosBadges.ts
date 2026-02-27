// SOS バッジ API ルート
// 管理者が「人数不足SOSマーク」を日・場所・活動内容の組み合わせで管理する

import { Hono } from 'hono'
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const sosBadges = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── GET /sos-badges ─────────────────────────────────────────
// 認証不要・年月指定でまとめて取得（カレンダー情報をJOIN）
sosBadges.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const year  = c.req.query('year');
    const month = c.req.query('month');

    let query = `
      SELECT
        s.id, s.badge_date, s.calendar_id, s.activity_type,
        s.urgency, s.message, s.created_by, s.created_at,
        c.name  AS calendar_name,
        c.color AS calendar_color,
        c.slug  AS calendar_slug
      FROM sos_badges s
      JOIN calendars c ON s.calendar_id = c.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (year && month) {
      const y = parseInt(year);
      const m = parseInt(month);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate   = `${y}-${String(m).padStart(2, '0')}-31`;
      query += ' AND s.badge_date >= ? AND s.badge_date <= ?';
      params.push(startDate, endDate);
    } else if (year) {
      query += ' AND s.badge_date LIKE ?';
      params.push(`${year}-%`);
    }

    query += ' ORDER BY s.badge_date ASC, s.calendar_id ASC';
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ badges: results });

  } catch (err) {
    console.error('Get SOS badges error:', err);
    return c.json({ error: 'SOSバッジ取得に失敗しました' }, 500);
  }
});

// ── POST /sos-badges ────────────────────────────────────────
// 管理者のみ：SOSバッジを作成（同一日・場所・活動は UPSERT）
sosBadges.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { badge_date, calendar_id, activity_type, urgency, message } = await c.req.json();

    // バリデーション
    if (!badge_date || !/^\d{4}-\d{2}-\d{2}$/.test(badge_date)) {
      return c.json({ error: '日付の形式が正しくありません (YYYY-MM-DD)' }, 400);
    }
    if (!calendar_id) {
      return c.json({ error: '場所（カレンダー）を指定してください' }, 400);
    }
    const validActivities = ['dog','cat','other_animal','office','negotiation','supplies','transport','rescue','capture','other_custom'];
    if (!activity_type || !validActivities.includes(activity_type)) {
      return c.json({ error: '活動内容が正しくありません' }, 400);
    }
    const safeUrgency = (urgency === 'urgent') ? 'urgent' : 'normal';
    const safeMsg = (message || '').slice(0, 100);

    // UPSERT（同一の日・場所・活動があれば上書き）
    await c.env.DB.prepare(`
      INSERT INTO sos_badges (badge_date, calendar_id, activity_type, urgency, message, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(badge_date, calendar_id, activity_type) DO UPDATE SET
        urgency    = excluded.urgency,
        message    = excluded.message,
        created_by = excluded.created_by,
        created_at = CURRENT_TIMESTAMP
    `).bind(badge_date, calendar_id, activity_type, safeUrgency, safeMsg, userId).run();

    // 作成したレコードを返す（カレンダー情報付き）
    const created = await c.env.DB.prepare(`
      SELECT s.id, s.badge_date, s.calendar_id, s.activity_type, s.urgency, s.message,
             c.name AS calendar_name, c.color AS calendar_color, c.slug AS calendar_slug
      FROM sos_badges s
      JOIN calendars c ON s.calendar_id = c.id
      WHERE s.badge_date = ? AND s.calendar_id = ? AND s.activity_type = ?
    `).bind(badge_date, calendar_id, activity_type).first();

    return c.json({ message: 'SOSバッジを設定しました', badge: created }, 201);

  } catch (err) {
    console.error('Create SOS badge error:', err);
    return c.json({ error: 'SOSバッジの作成に失敗しました' }, 500);
  }
});

// ── DELETE /sos-badges/:id ──────────────────────────────────
// 管理者のみ：SOSバッジを削除
sosBadges.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: '不正なIDです' }, 400);

    const existing = await c.env.DB.prepare(
      'SELECT id FROM sos_badges WHERE id = ?'
    ).bind(id).first();
    if (!existing) return c.json({ error: 'SOSバッジが見つかりません' }, 404);

    await c.env.DB.prepare('DELETE FROM sos_badges WHERE id = ?').bind(id).run();
    return c.json({ message: 'SOSバッジを削除しました' });

  } catch (err) {
    console.error('Delete SOS badge error:', err);
    return c.json({ error: 'SOSバッジの削除に失敗しました' }, 500);
  }
});

export default sosBadges;
