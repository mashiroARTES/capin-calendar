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

// メールアドレスで管理者昇格（管理者専用）
users.post('/promote-by-email', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { email, role } = await c.req.json();
    
    if (!email) {
      return c.json({ error: 'メールアドレスが必要です' }, 400);
    }
    
    const newRole = role === 'volunteer' ? 'volunteer' : 'admin';
    
    const user = await c.env.DB.prepare(
      'SELECT id, name, email FROM users WHERE email = ?'
    ).bind(email.toLowerCase().trim()).first<{ id: number; name: string; email: string }>();
    
    if (!user) {
      return c.json({ error: 'このメールアドレスのユーザーが見つかりません' }, 404);
    }
    
    await c.env.DB.prepare(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(newRole, user.id).run();
    
    return c.json({ message: `${user.name} を${newRole === 'admin' ? '管理者' : '一般ユーザー'}に変更しました`, user: { ...user, role: newRole } });
  } catch (err) {
    console.error('Promote by email error:', err);
    return c.json({ error: '権限変更に失敗しました' }, 500);
  }
});

// 自分のプロフィール更新（名前変更、本人のみ）
users.put('/me', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { name } = await c.req.json();
    
    if (!name || name.trim().length === 0) {
      return c.json({ error: '名前を入力してください' }, 400);
    }
    
    if (name.trim().length > 20) {
      return c.json({ error: '名前は20文字以内で入力してください' }, 400);
    }
    
    await c.env.DB.prepare(
      'UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name.trim(), userId).run();
    
    // 更新後のユーザー情報を返す
    const updated = await c.env.DB.prepare(
      'SELECT id, name, email, role FROM users WHERE id = ?'
    ).bind(userId).first();
    
    return c.json({ message: 'プロフィールを更新しました', user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    return c.json({ error: 'プロフィール更新に失敗しました' }, 500);
  }
});

export default users;
