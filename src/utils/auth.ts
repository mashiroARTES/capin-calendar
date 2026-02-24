// 認証ユーティリティ（Cloudflare Workers Web Crypto API使用）

// パスワードハッシュ化（PBKDF2）
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // ソルト生成
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // PBKDF2キー導出
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `pbkdf2:${saltHex}:${hashHex}`;
}

// パスワード検証
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith('pbkdf2:')) return false;
  
  const parts = hash.split(':');
  if (parts.length !== 3) return false;
  
  const [, saltHex, storedHashHex] = parts;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const computedHashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHashHex === storedHashHex;
}

// JWTトークン生成（HS256）
export async function generateJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number = 7 * 24 * 3600
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  
  const encoder = new TextEncoder();
  
  // Unicode対応のBase64URL エンコード（日本語名前対応）
  function toBase64Url(str: string): string {
    const bytes = encoder.encode(str);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  
  const headerBase64 = toBase64Url(JSON.stringify(header));
  const payloadBase64 = toBase64Url(JSON.stringify(fullPayload));
  
  const signingInput = `${headerBase64}.${payloadBase64}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${signingInput}.${signatureBase64}`;
}

// JWT検証
export async function verifyJWT(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const signingInput = `${headerBase64}.${payloadBase64}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = Uint8Array.from(
      atob(signatureBase64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(signingInput)
    );
    
    if (!valid) return null;
    
    // Unicode対応のBase64デコード
    const b64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(b64);
    const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(bytes));
    
    // 有効期限チェック
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}
