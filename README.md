# 🐾 CAPINカレンダー

CAPIN（キャピン）動物保護団体向けの **ボランティアシフト管理カレンダー** システムです。

## 🌐 アクセスURL
- **本番環境**: https://capin-calendar.pages.dev
- **プラットフォーム**: Cloudflare Pages

## ✨ 機能一覧

### 認証
- ✅ アカウント作成（お名前・メールアドレス・パスワード）
- ✅ メールアドレス＋パスワードでログイン
- ✅ パスワード忘れ → 新規アカウント作成への誘導
- ✅ JWT認証（7日間有効）

### カレンダー管理（3種類）
- 🔵 **第１シェルター**
- 🟢 **第２シェルター**
- 🟠 **パル動物病院**

### シフト管理
- ✅ 時分指定でのシフト登録（開始・終了時刻）
- ✅ 担当動物の選択：🐶 犬 / 🐱 猫 / 🐾 その他
- ✅ メモ欄付き
- ✅ 自分のシフトを編集・削除

### 表示モード（3種類）
- 📅 **月表示**: 月カレンダー。動物種別ごとにグループ分けして表示
- 📆 **週表示**: 週単位の一覧
- 📋 **一覧表示**: 日付×動物種別でまとめた詳細一覧

### 管理者機能
- シフトステータス管理（未確認/承認済/却下）

## 🔗 APIエンドポイント

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| GET | `/api/health` | ヘルスチェック | 不要 |
| POST | `/api/auth/register` | ユーザー登録 | 不要 |
| POST | `/api/auth/login` | ログイン | 不要 |
| GET | `/api/auth/me` | 現在のユーザー情報 | 必要 |
| GET | `/api/calendars` | カレンダー一覧 | 不要 |
| GET | `/api/shifts?year=&month=&calendar=` | シフト一覧 | 必要 |
| POST | `/api/shifts` | シフト作成 | 必要 |
| PUT | `/api/shifts/:id` | シフト更新 | 必要 |
| DELETE | `/api/shifts/:id` | シフト削除 | 必要 |

## 📊 データモデル

### users
- `id`, `name`, `email`, `password_hash`, `role`（volunteer/admin）

### calendars
- `id`, `slug`, `name`, `color`, `description`

### shifts
- `id`, `user_id`, `calendar_id`, `shift_date`（YYYY-MM-DD）
- `start_time`（HH:MM）, `end_time`（HH:MM）
- `animal_type`（dog/cat/other）
- `note`, `status`（pending/approved/rejected）

## 🏗️ 技術スタック
- **バックエンド**: Hono (TypeScript) + Cloudflare Workers
- **データベース**: Cloudflare D1（SQLite）
- **認証**: PBKDF2パスワードハッシュ + HS256 JWT
- **フロントエンド**: Vanilla JS + Tailwind CSS (CDN) + FontAwesome
- **ビルド**: Vite + @hono/vite-cloudflare-pages

## 🚀 ローカル開発

```bash
npm install
npx wrangler d1 migrations apply capin-calendar-production --local
npm run build
pm2 start ecosystem.config.cjs
```

## 🌍 デプロイ済み情報
- **Cloudflare Pages プロジェクト**: capin-calendar
- **D1 データベース**: capin-calendar-production
- **D1 データベースID**: 70b24fb6-4ca1-4fb3-ae7c-7fbbe78d9b5a
- **ステータス**: ✅ 稼働中
- **最終デプロイ**: 2026-02-24

## 👤 使い方

1. https://capin-calendar.pages.dev にアクセス
2. 「新規アカウントを作成する」からアカウント登録
3. ログイン後、上部タブで表示するシェルターを選択
4. 「＋シフト登録」またはカレンダーのセルをクリック
5. カレンダー・担当動物・日時を選択して登録
6. 表示モード（月/週/一覧）を切り替えて確認
