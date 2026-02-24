-- CAPINカレンダー 初期スキーマ

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'volunteer',  -- 'admin' or 'volunteer'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- カレンダー（シェルター種別）テーブル
CREATE TABLE IF NOT EXISTS calendars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,  -- 'shelter1', 'shelter2', 'animal_hospital'
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4f8ef7',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- シフト投稿テーブル
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  calendar_id INTEGER NOT NULL,
  shift_date TEXT NOT NULL,        -- 'YYYY-MM-DD'
  start_time TEXT,                  -- 'HH:MM'
  end_time TEXT,                    -- 'HH:MM'
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- セッションテーブル（JWT refresh管理）
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_calendar_id ON shifts(calendar_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- デフォルトカレンダーデータ挿入
INSERT OR IGNORE INTO calendars (slug, name, color, description) VALUES
  ('shelter1', '第１シェルター', '#4f8ef7', '第１シェルターのボランティアシフト'),
  ('shelter2', '第２シェルター', '#22c55e', '第２シェルターのボランティアシフト'),
  ('animal_hospital', 'パル動物病院', '#f97316', 'パル動物病院のボランティアシフト');
