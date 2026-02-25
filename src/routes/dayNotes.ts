// 日ごと一行掲示板APIルート

import { Hono } from 'hono'
import { optionalAuthMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const dayNotes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 掲示板取得（認証不要・年月指定でまとめて取得）
dayNotes.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const year  = c.req.query('year');
    const month = c.req.query('month');

    let query = 'SELECT note_date, content, updated_by_name, updated_at FROM day_notes WHERE 1=1';
    const params: unknown[] = [];

    if (year && month) {
      const y = parseInt(year);
      const m = parseInt(month);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate   = `${y}-${String(m).padStart(2, '0')}-31`;
      query += ' AND note_date >= ? AND note_date <= ?';
      params.push(startDate, endDate);
    } else if (year) {
      query += ' AND note_date LIKE ?';
      params.push(`${year}-%`);
    }

    query += ' ORDER BY note_date ASC';
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ notes: results });

  } catch (err) {
    console.error('Get day notes error:', err);
    return c.json({ error: '掲示板取得に失敗しました' }, 500);
  }
});

// 掲示板更新（ログイン済みの誰でも可、未ログインは不可）
dayNotes.put('/:date', optionalAuthMiddleware, async (c) => {
  try {
    const userId   = c.get('userId');
    const userName = c.get('userName');

    // 未ログインは書き込み不可
    if (!userId) {
      return c.json({ error: '書き込みにはログインが必要です' }, 401);
    }

    const noteDate = c.req.param('date');
    // 日付フォーマット検証
    if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) {
      return c.json({ error: '日付の形式が正しくありません' }, 400);
    }

    const { content } = await c.req.json();
    const text = (content || '').trim().slice(0, 200); // 最大200文字

    // UPSERT（存在すれば上書き、なければ新規作成）
    await c.env.DB.prepare(`
      INSERT INTO day_notes (note_date, content, updated_by_name, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(note_date) DO UPDATE SET
        content = excluded.content,
        updated_by_name = excluded.updated_by_name,
        updated_at = CURRENT_TIMESTAMP
    `).bind(noteDate, text, userName || '').run();

    const updated = await c.env.DB.prepare(
      'SELECT note_date, content, updated_by_name, updated_at FROM day_notes WHERE note_date = ?'
    ).bind(noteDate).first();

    return c.json({ message: '掲示板を更新しました', note: updated });

  } catch (err) {
    console.error('Update day note error:', err);
    return c.json({ error: '掲示板の更新に失敗しました' }, 500);
  }
});

export default dayNotes;
