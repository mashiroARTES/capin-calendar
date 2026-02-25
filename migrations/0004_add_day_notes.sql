-- 日ごと一行掲示板テーブル
-- 各日付に1件のメモを保存（誰でも上書き編集可能）
CREATE TABLE IF NOT EXISTS day_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_date TEXT NOT NULL UNIQUE,   -- YYYY-MM-DD
  content   TEXT NOT NULL DEFAULT '',
  updated_by_name TEXT,             -- 最後に更新した人の名前
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_day_notes_date ON day_notes(note_date);
