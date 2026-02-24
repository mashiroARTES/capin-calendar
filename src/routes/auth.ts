// 認証APIルート

import { Hono } from 'hono'
import { hashPassword, verifyPassword, generateJWT } from '../utils/auth'
import type { Bindings, Variables } from '../types'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ユーザー登録
auth.post('/register', async (c) => {
  try {
    const { name, email, password } = await c.req.json();
    
    // バリデーション
    if (!name || !email || !password) {
      return c.json({ error: '名前、メールアドレス、パスワードは必須です' }, 400);
    }
    
    if (password.length < 8) {
      return c.json({ error: 'パスワードは8文字以上で入力してください' }, 400);
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: '有効なメールアドレスを入力してください' }, 400);
    }
    
    // 既存ユーザー確認
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();
    
    if (existing) {
      return c.json({ error: 'このメールアドレスは既に登録されています' }, 409);
    }
    
    // パスワードハッシュ化
    const passwordHash = await hashPassword(password);
    
    // ユーザー作成
    const result = await c.env.DB.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id, name, email, role, created_at'
    ).bind(name.trim(), email.toLowerCase(), passwordHash, 'volunteer').first();
    
    if (!result) {
      return c.json({ error: 'ユーザー作成に失敗しました' }, 500);
    }
    
    // JWTトークン発行
    const secret = c.env.JWT_SECRET || 'capin-calendar-default-secret-2024';
    const token = await generateJWT(
      { userId: result.id, email: result.email, name: result.name, role: result.role },
      secret
    );
    
    return c.json({
      message: 'アカウントを作成しました',
      token,
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role
      }
    }, 201);
    
  } catch (err) {
    console.error('Register error:', err);
    return c.json({ error: 'サーバーエラーが発生しました' }, 500);
  }
});

// ログイン
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'メールアドレスとパスワードを入力してください' }, 400);
    }
    
    // ユーザー検索
    const user = await c.env.DB.prepare(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
      role: string;
    }>();
    
    if (!user) {
      return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }
    
    // パスワード検証
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }
    
    // JWTトークン発行
    const secret = c.env.JWT_SECRET || 'capin-calendar-default-secret-2024';
    const token = await generateJWT(
      { userId: user.id, email: user.email, name: user.name, role: user.role },
      secret
    );
    
    return c.json({
      message: 'ログインしました',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    return c.json({ error: 'サーバーエラーが発生しました' }, 500);
  }
});

// 現在のユーザー情報取得
auth.get('/me', async (c) => {
  // クッキーまたはAuthorizationヘッダーからトークン取得
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/capin_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
  }
  
  if (!token) {
    return c.json({ error: '未認証' }, 401);
  }
  
  const secret = c.env.JWT_SECRET || 'capin-calendar-default-secret-2024';
  const { verifyJWT } = await import('../utils/auth');
  const payload = await verifyJWT(token, secret);
  
  if (!payload) {
    return c.json({ error: 'トークンが無効です' }, 401);
  }
  
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?'
  ).bind(payload.userId).first();
  
  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404);
  }
  
  return c.json({ user });
});

export default auth;
