// 認証ミドルウェア

import { Context, Next } from 'hono'
import { verifyJWT } from '../utils/auth'
import type { Bindings, Variables } from '../types'

export async function authMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // クッキーからもトークン取得
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/capin_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }
  
  if (!token) {
    return c.json({ error: '認証が必要です' }, 401);
  }
  
  const secret = c.env.JWT_SECRET || 'capin-calendar-default-secret-2024';
  const payload = await verifyJWT(token, secret);
  
  if (!payload) {
    return c.json({ error: 'トークンが無効または期限切れです' }, 401);
  }
  
  c.set('userId', payload.userId as number);
  c.set('userRole', payload.role as string);
  c.set('userName', payload.name as string);
  
  await next();
}

// 管理者専用ミドルウェア
export async function adminMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const role = c.get('userRole');
  if (role !== 'admin') {
    return c.json({ error: '管理者権限が必要です' }, 403);
  }
  await next();
}
