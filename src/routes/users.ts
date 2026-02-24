// ユーザー管理APIルート

import { Hono } from 'hono'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全ユーザー一覧（管理者専用）
users.get('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    ).all();
    
    return c.json({ users: results });
  } catch (err) {
    console.error('Get users error:', err);
    return c.json({ error: 'ユーザー取得に失敗しました' }, 500);
  }
});

// ユーザーの役割変更（管理者専用）
users.put('/:id/role', authMiddleware, adminMiddleware, async (c) => {
  try {
    const targetId = parseInt(c.req.param('id'));
    const { role } = await c.req.json();
    
    if (!['admin', 'volunteer'].includes(role)) {
      return c.json({ error: '無効な役割です' }, 400);
    }
    
    await c.env.DB.prepare(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(role, targetId).run();
    
    return c.json({ message: '役割を更新しました' });
  } catch (err) {
    console.error('Update role error:', err);
    return c.json({ error: '役割更新に失敗しました' }, 500);
  }
});

// プロフィール更新（本人のみ）
users.put('/me', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { name } = await c.req.json();
    
    if (!name || name.trim().length === 0) {
      return c.json({ error: '名前を入力してください' }, 400);
    }
    
    await c.env.DB.prepare(
      'UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name.trim(), userId).run();
    
    return c.json({ message: 'プロフィールを更新しました' });
  } catch (err) {
    console.error('Update profile error:', err);
    return c.json({ error: 'プロフィール更新に失敗しました' }, 500);
  }
});

export default users;
