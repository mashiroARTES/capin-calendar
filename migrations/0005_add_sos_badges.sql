-- SOSバッジテーブル
-- 管理者が「人数不足」マークをつける日・場所・活動内容の組み合わせを管理
CREATE TABLE IF NOT EXISTS sos_badges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  badge_date   TEXT NOT NULL,       -- YYYY-MM-DD
  calendar_id  INTEGER NOT NULL,    -- 場所（カレンダー）
  activity_type TEXT NOT NULL,      -- 'dog','cat','other_animal','office','negotiation','other_custom'
  message      TEXT DEFAULT '',     -- 任意のコメント（例：「あと2名必要」）
  created_by   INTEGER NOT NULL,    -- 作成した管理者のuser_id
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (badge_date, calendar_id, activity_type)  -- 同一日・場所・活動は1件のみ
);

CREATE INDEX IF NOT EXISTS idx_sos_badges_date ON sos_badges(badge_date);
CREATE INDEX IF NOT EXISTS idx_sos_badges_calendar ON sos_badges(calendar_id);
