// カレンダーAPIルート

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const calendars = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// カレンダー一覧取得（認証不要）
calendars.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, slug, name, color, description FROM calendars ORDER BY id ASC'
    ).all();
    
    return c.json({ calendars: results });
  } catch (err) {
    console.error('Get calendars error:', err);
    return c.json({ error: 'カレンダー取得に失敗しました' }, 500);
  }
});

// カレンダー詳細取得（認証不要）
calendars.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const calendar = await c.env.DB.prepare(
      'SELECT id, slug, name, color, description FROM calendars WHERE slug = ?'
    ).bind(slug).first();
    
    if (!calendar) {
      return c.json({ error: 'カレンダーが見つかりません' }, 404);
    }
    
    return c.json({ calendar });
  } catch (err) {
    console.error('Get calendar error:', err);
    return c.json({ error: 'カレンダー取得に失敗しました' }, 500);
  }
});

export default calendars;
