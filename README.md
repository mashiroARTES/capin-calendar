# 🐾 CAPINカレンダー

CAPIN（キャピン）動物保護団体向けの **ボランティアシフト管理カレンダー** システムです。

## 🌐 アクセスURL
- **ローカル開発**: http://localhost:3000
- **本番環境**: （Cloudflare Pages デプロイ後に更新）

## ✨ 機能一覧

### 実装済み機能
- ✅ **ユーザー認証**: アカウント作成（名前・メール・パスワード）、ログイン/ログアウト
- ✅ **パスワード忘れ対応**: 新規アカウント作成への誘導
- ✅ **3種類のカレンダー管理**:
  - 🔵 第１シェルター
  - 🟢 第２シェルター
  - 🟠 パル動物病院
- ✅ **シフト管理**: 時分指定での投稿・編集・削除
- ✅ **複数表示モード**:
  - 📅 月表示: 月カレンダー形式（多人数シフトも色分けで一覧表示）
  - 📆 週表示: 週単位のシフト一覧
  - 📋 リスト表示: 日付ごとの一覧（詳細情報付き）
- ✅ **カレンダーフィルター**: 全カレンダー表示 or 特定カレンダーのみ表示
- ✅ **管理者機能**: ステータス管理（未確認/承認済/却下）
- ✅ **キーボードショートカット**: ←→ で月移動、Esc でモーダル閉じる

### 未実装機能
- ❌ メール通知
- ❌ シフトのCSVエクスポート
- ❌ Google Calendar連携

## 🔗 APIエンドポイント

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| GET | `/api/health` | ヘルスチェック | 不要 |
| POST | `/api/auth/register` | ユーザー登録 | 不要 |
| POST | `/api/auth/login` | ログイン | 不要 |
| GET | `/api/auth/me` | 現在のユーザー情報 | 必要 |
| GET | `/api/calendars` | カレンダー一覧 | 不要 |
| GET | `/api/shifts` | シフト一覧（クエリ: calendar, year, month） | 必要 |
| POST | `/api/shifts` | シフト作成 | 必要 |
| PUT | `/api/shifts/:id` | シフト更新 | 必要 |
| DELETE | `/api/shifts/:id` | シフト削除 | 必要 |
| GET | `/api/users` | ユーザー一覧 | 管理者のみ |
| PUT | `/api/users/:id/role` | 役割変更 | 管理者のみ |

## 📊 データモデル

### users（ユーザー）
- `id`, `name`（名前）, `email`, `password_hash`, `role`（volunteer/admin）

### calendars（カレンダー）
- `id`, `slug`, `name`, `color`, `description`

### shifts（シフト）
- `id`, `user_id`, `calendar_id`, `shift_date`（YYYY-MM-DD）
- `start_time`（HH:MM）, `end_time`（HH:MM）, `note`
- `status`（pending/approved/rejected）

## 🚀 開発環境セットアップ

```bash
# インストール
npm install

# D1マイグレーション（初回）
npx wrangler d1 migrations apply capin-calendar-production --local

# ビルド
npm run build

# PM2で起動
pm2 start ecosystem.config.cjs

# テスト
curl http://localhost:3000/api/health
```

## 🏗️ 技術スタック
- **バックエンド**: Hono (TypeScript) + Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite)
- **認証**: PBKDF2パスワードハッシュ + HS256 JWT
- **フロントエンド**: Vanilla JS + Tailwind CSS (CDN) + FontAwesome
- **ビルド**: Vite + @hono/vite-cloudflare-pages
- **開発**: wrangler pages dev（ローカルD1）

## 🌍 Cloudflare Pages デプロイ

```bash
# Cloudflare認証設定後
npx wrangler d1 create capin-calendar-production
# → wrangler.jsonc の database_id を更新

npm run build
npx wrangler pages project create capin-calendar --production-branch main
npx wrangler pages deploy dist --project-name capin-calendar
```

## 👤 使い方

1. トップページでメールアドレスとパスワードを入力してログイン
2. 初回利用は「新規アカウントを作成する」から登録
3. ヘッダーのカレンダータブで表示するシェルターを選択
4. 「＋シフト登録」ボタン または カレンダーのセルをクリックしてシフト追加
5. 表示モードを「月」「週」「一覧」で切り替え可能
6. シフトをクリックすると詳細表示・編集・削除が可能

---

**最終更新**: 2026-02-24 | **ステータス**: ✅ ローカル開発中
