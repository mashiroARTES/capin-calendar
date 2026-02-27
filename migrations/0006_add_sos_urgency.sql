-- sos_badges テーブルに urgency（重要度）カラムを追加
-- 'normal'  = 募集（黄色系）
-- 'urgent'  = 緊急募集（赤系）
ALTER TABLE sos_badges ADD COLUMN urgency TEXT NOT NULL DEFAULT 'normal';
