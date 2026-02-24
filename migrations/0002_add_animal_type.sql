-- animal_typeカラムをshiftsテーブルに追加
ALTER TABLE shifts ADD COLUMN animal_type TEXT NOT NULL DEFAULT 'other';
-- 'dog' | 'cat' | 'other'
