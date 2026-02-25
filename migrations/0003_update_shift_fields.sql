-- 活動内容カラム追加 (animal_type を activity_type に実質置き換え)
-- activity_type: 'dog'|'cat'|'other_animal'|'office'|'negotiation'|'other_custom'
ALTER TABLE shifts ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'dog';
ALTER TABLE shifts ADD COLUMN activity_custom TEXT;  -- 「その他」時の任意テキスト

-- 場所カラム追加（カレンダー外の追記場所）
-- location_type: 'shelter1'|'shelter2'|'animal_hospital'|'other_location'
ALTER TABLE shifts ADD COLUMN location_type TEXT;
ALTER TABLE shifts ADD COLUMN location_custom TEXT;  -- 「その他」時の任意テキスト

-- 同一ユーザー・同日・同一カレンダーの複数登録を許可するため
-- 既存の一意制約はなかったが、念のため重複チェックロジックをAPI側で削除対応
-- （このマイグレーション自体はカラム追加のみ）

-- animal_type の既存データを activity_type にコピー
UPDATE shifts SET activity_type = animal_type WHERE activity_type = 'dog' AND animal_type IS NOT NULL;
