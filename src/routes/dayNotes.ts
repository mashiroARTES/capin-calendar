// 日ごと一行掲示板APIルート（場所ごとに分けて管理）

import { Hono } from 'hono'
import { optionalAuthMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const dayNotes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 掲示板取得（認証不要・年月指定でまとめて取得）
// calendar_id を含む全件返す
dayNotes.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const year  = c.req.query('year');
    const month = c.req.query('month');

    let query = 'SELECT id, note_date, calendar_id, content, updated_by_name, updated_at FROM day_notes WHERE 1=1';
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

    query += ' ORDER BY note_date ASC, calendar_id ASC';
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ notes: results });

  } catch (err) {
    console.error('Get day notes error:', err);
    return c.json({ error: '掲示板取得に失敗しました' }, 500);
  }
});

// 掲示板更新（ログイン済みの誰でも可、未ログインは不可）
// PUT /api/day-notes/:date  body: { content, calendar_id? }
// calendar_id が null/未指定 = 全体メモ（後方互換）
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

    const body = await c.req.json();
    const { content } = body;
    const calendarId: number | null = body.calendar_id ? Number(body.calendar_id) : null;

    // calendar_id が指定されている場合はカレンダー存在確認
    if (calendarId !== null) {
      const cal = await c.env.DB.prepare('SELECT id FROM calendars WHERE id = ?').bind(calendarId).first();
      if (!cal) {
        return c.json({ error: '指定された場所が見つかりません' }, 404);
      }
    }

    // 最大3行・各行200文字・合計600文字
    const rawLines = (content || '').split('\n');
    const text = rawLines
      .slice(0, 3)
      .map((l: string) => l.trim().slice(0, 200))
      .join('\n')
      .trim()
      .slice(0, 600);

    // UPSERT（同じ日×calendar_id は1件のみ）
    if (calendarId !== null) {
      await c.env.DB.prepare(`
        INSERT INTO day_notes (note_date, calendar_id, content, updated_by_name, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(note_date, calendar_id) DO UPDATE SET
          content = excluded.content,
          updated_by_name = excluded.updated_by_name,
          updated_at = CURRENT_TIMESTAMP
      `).bind(noteDate, calendarId, text, userName || '').run();
    } else {
      // calendar_id = NULL の場合（NULL同士のUNIQUE衝突はSQLiteでは起きないため手動チェック）
      const existing = await c.env.DB.prepare(
        'SELECT id FROM day_notes WHERE note_date = ? AND calendar_id IS NULL'
      ).bind(noteDate).first();
      if (existing) {
        await c.env.DB.prepare(`
          UPDATE day_notes SET content = ?, updated_by_name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE note_date = ? AND calendar_id IS NULL
        `).bind(text, userName || '', noteDate).run();
      } else {
        await c.env.DB.prepare(`
          INSERT INTO day_notes (note_date, calendar_id, content, updated_by_name, updated_at)
          VALUES (?, NULL, ?, ?, CURRENT_TIMESTAMP)
        `).bind(noteDate, text, userName || '').run();
      }
    }

    // 更新後のデータを返す
    const updated = calendarId !== null
      ? await c.env.DB.prepare(
          'SELECT id, note_date, calendar_id, content, updated_by_name, updated_at FROM day_notes WHERE note_date = ? AND calendar_id = ?'
        ).bind(noteDate, calendarId).first()
      : await c.env.DB.prepare(
          'SELECT id, note_date, calendar_id, content, updated_by_name, updated_at FROM day_notes WHERE note_date = ? AND calendar_id IS NULL'
        ).bind(noteDate).first();

    return c.json({ message: '掲示板を更新しました', note: updated });

  } catch (err) {
    console.error('Update day note error:', err);
    return c.json({ error: '掲示板の更新に失敗しました' }, 500);
  }
});

export default dayNotes;
