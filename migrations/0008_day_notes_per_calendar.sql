-- day_notes を場所（calendar）ごとに管理するよう拡張
-- 1. calendar_id カラムを追加（NULL = 全体共通メモ、後方互換用）
ALTER TABLE day_notes ADD COLUMN calendar_id INTEGER REFERENCES calendars(id) ON DELETE CASCADE;

-- 2. 旧UNIQUE制約(note_date)を削除して再作成はSQLiteではALTERできないため、
--    新テーブルを作り直す方式で対応
CREATE TABLE IF NOT EXISTS day_notes_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  note_date       TEXT    NOT NULL,
  calendar_id     INTEGER REFERENCES calendars(id) ON DELETE CASCADE,
  content         TEXT    NOT NULL DEFAULT '',
  updated_by_name TEXT,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (note_date, calendar_id)  -- 同じ日×場所は1件のみ
);

-- 既存データを移行（calendar_id = NULL として移行）
INSERT OR IGNORE INTO day_notes_new (note_date, calendar_id, content, updated_by_name, updated_at)
SELECT note_date, NULL, content, updated_by_name, updated_at FROM day_notes;

-- 旧テーブル削除
DROP TABLE day_notes;

-- 新テーブルを旧名に変更
ALTER TABLE day_notes_new RENAME TO day_notes;

-- インデックス再作成
CREATE INDEX IF NOT EXISTS idx_day_notes_date ON day_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_day_notes_calendar ON day_notes(calendar_id);
