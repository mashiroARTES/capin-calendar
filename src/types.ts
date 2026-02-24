// 型定義

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export type Variables = {
  userId: number;
  userRole: string;
  userName: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
};

export type Calendar = {
  id: number;
  slug: string;
  name: string;
  color: string;
  description: string;
};

export type Shift = {
  id: number;
  user_id: number;
  calendar_id: number;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  status: string;
  created_at: string;
  // JOINデータ
  user_name?: string;
  user_email?: string;
  calendar_name?: string;
  calendar_color?: string;
  calendar_slug?: string;
};
