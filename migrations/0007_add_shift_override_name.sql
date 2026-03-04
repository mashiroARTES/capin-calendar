-- shifts テーブルに override_name カラムを追加
-- 管理者が代理登録する際に、DB上のユーザーと無関係な任意名を登録するためのカラム
ALTER TABLE shifts ADD COLUMN override_name TEXT DEFAULT NULL;
