// CAPINカレンダー メインアプリケーション

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import authRoutes from './routes/auth'
import shiftsRoutes from './routes/shifts'
import calendarsRoutes from './routes/calendars'
import usersRoutes from './routes/users'
import dayNotesRoutes from './routes/dayNotes'
import type { Bindings, Variables } from './types'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', logger())
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/api/auth', authRoutes)
app.route('/api/shifts', shiftsRoutes)
app.route('/api/calendars', calendarsRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/day-notes', dayNotesRoutes)

app.get('/api/health', (c) => c.json({ status: 'ok', app: 'CAPINカレンダー' }))
app.use('/static/*', serveStatic({ root: './' }))

const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CAPINカレンダー - ボランティアシフト管理</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐾</text></svg>">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', sans-serif; }

    /* カレンダーセル */
    .cal-cell {
      height: 1px;
      vertical-align: top;
      border: 1px solid #e5e7eb;
      padding: 4px 3px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .cal-cell-inner {
      height: 100%;
      min-height: 72px;
    }
    .cal-cell:hover { background: #f0f7ff; }
    .cal-cell.today { background: #fffbeb; }
    .cal-cell.other-month { background: #f9fafb; opacity: 0.55; }
    .cal-cell.today:hover { background: #fef3c7; }

    #month-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    /* tr高さはJSでインラインstyle指定するためCSSルールなし */

    /* シフトバッジ（月表示用コンパクト） */
    .shift-badge {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 9999px;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: opacity 0.15s;
      max-width: 100%;
    }
    .shift-badge:hover { opacity: 0.75; }

    /* モーダル */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .modal-content {
      background: white;
      border-radius: 16px;
      max-width: 500px;
      width: 100%;
      max-height: 92vh;
      overflow-y: auto;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }

    /* 活動内容ボタン */
    .act-btn {
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      padding: 8px 4px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
      background: white;
    }
    .act-btn:hover { border-color: #93c5fd; background: #eff6ff; }

    /* トースト */
    #toast { position: fixed; bottom: 24px; right: 24px; z-index: 9999; min-width: 200px; max-width: 360px; }
    .toast-item { padding: 12px 16px; border-radius: 10px; margin-top: 8px; font-size: 14px; font-weight: 500; box-shadow: 0 4px 16px rgba(0,0,0,0.15); animation: fadeIn 0.2s ease-out; }
    .toast-success { background: #22c55e; color: white; }
    .toast-error   { background: #ef4444; color: white; }
    .toast-info    { background: #4f8ef7; color: white; }

    @keyframes fadeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

    .spinner { border:3px solid #f3f4f6; border-top-color:#4f8ef7; border-radius:50%; width:24px; height:24px; animation:spin 0.8s linear infinite; }
    .paw-icon { display:inline-block; animation:bounce 2s infinite; }

    /* 週表示セル */
    .week-cell { min-height: 70px; border: 1px solid #e5e7eb; padding: 4px; vertical-align: top; cursor: pointer; transition: background 0.1s; }
    .week-cell:hover { background: #f0f7ff; }

    /* 日別一覧モーダル */
    .day-view-modal { max-width: 540px !important; }

    /* 日別シフトカード（時刻順ビュー） */
    .day-shift-card {
      display: flex;
      align-items: stretch;
      border-radius: 10px;
      background: white;
      border: 1.5px solid #e5e7eb;
      cursor: pointer;
      transition: box-shadow 0.15s, border-color 0.15s;
      overflow: hidden;
    }
    .day-shift-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.10); border-color: #93c5fd; }
    .day-shift-card.is-mine { border-color: #93c5fd; background: #f0f7ff; }
    .shift-time-col {
      flex-shrink: 0;
      width: 72px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 4px;
      background: #f8fafc;
      border-right: 1.5px solid #e5e7eb;
      gap: 1px;
    }
    .shift-time-col .t-start { font-size: 15px; font-weight: 800; color: #1e40af; line-height: 1.1; }
    .shift-time-col .t-arrow { font-size: 10px; color: #94a3b8; }
    .shift-time-col .t-end   { font-size: 12px; font-weight: 600; color: #475569; line-height: 1.1; }
    .shift-time-col .t-none  { font-size: 9px; color: #94a3b8; }
    .shift-info-col {
      flex: 1;
      min-width: 0;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
    }
    .shift-cal-dot {
      display: inline-block;
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .time-bar-wrap {
      width: 100%;
      height: 3px;
      background: #e5e7eb;
      border-radius: 2px;
      margin-top: 2px;
      overflow: hidden;
    }
    .time-bar-fill {
      height: 100%;
      border-radius: 2px;
    }

    /* 月ビュー：コンパクト行表示 */
    .day-compact-row {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 9.5px;
      line-height: 1.2;
      padding: 1px 2px;
      border-radius: 3px;
      margin-bottom: 1px;
      cursor: pointer;
      transition: background 0.1s;
      white-space: nowrap;
      overflow: hidden;
    }
    .day-compact-row:hover { background: rgba(0,0,0,0.05); }

    /* ナビボタン */
    .nav-btn { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:5px 10px; cursor:pointer; transition:all 0.15s; }
    .nav-btn:hover { background:#f1f5f9; }
    .view-btn { padding:5px 12px; border-radius:6px; font-size:12px; cursor:pointer; border:1px solid #e5e7eb; transition:all 0.15s; background:white; }
    .view-btn.active { background:#1e40af; color:white; border-color:#1e40af; }
    .tab-btn { transition: all 0.2s; }
    .tab-btn.active { background:#4f8ef7; color:white; }

    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:#f1f5f9; }
    ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }

    /* 日ごと一行掲示板 */
    .day-note-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 3px 6px;
      margin-bottom: 3px;
      font-size: 11px;
      line-height: 1.3;
      cursor: pointer;
      transition: background 0.15s;
      min-height: 22px;
    }
    .day-note-bar:hover { background: #fef3c7; }
    .day-note-bar .note-icon { font-size: 11px; flex-shrink: 0; }
    .day-note-bar .note-text { color: #92400e; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .day-note-bar .note-empty { color: #d97706; opacity: 0.6; font-style: italic; }

    /* 月ビュー内の掲示板（小さく） */
    .cal-note-bar {
      display: flex;
      align-items: center;
      gap: 2px;
      background: #fffbeb;
      border-left: 2px solid #f59e0b;
      border-radius: 2px;
      padding: 1px 3px;
      margin-bottom: 2px;
      font-size: 9px;
      line-height: 1.3;
      cursor: pointer;
      transition: background 0.12s;
      overflow: hidden;
    }
    .cal-note-bar:hover { background: #fef3c7; }
    .cal-note-bar .cn-text { color: #92400e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; flex: 1; }
    .cal-note-bar .cn-empty { color: #d97706; opacity: 0.5; font-style: italic; }

    /* 掲示板インライン編集エリア */
    .note-edit-area {
      width: 100%;
      border: 1.5px solid #f59e0b;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 13px;
      resize: none;
      outline: none;
      background: #fffbeb;
      color: #78350f;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .note-edit-area:focus { border-color: #d97706; box-shadow: 0 0 0 2px #fde68a; }

    /* 翌日ハイライト */
    .cal-cell.tomorrow { background: #fff7ed; }
    .cal-cell.tomorrow:hover { background: #ffedd5; }

    /* 週ビュー：今日/翌日セルの背景（列幅はJS側インラインstyle） */
    .week-cell.today    { background: #fffbeb; }
    .week-cell.tomorrow { background: #fff7ed; }

    @media (max-width: 640px) {
      .cal-cell { padding: 2px 1px; }
      .day-compact-row { font-size: 8.5px; }
      .cal-note-bar { font-size: 8px; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

<div id="toast"></div>
<div id="app">
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <div class="text-5xl mb-4">🐾</div>
      <div class="spinner mx-auto"></div>
      <p class="text-gray-400 mt-3 text-sm">読み込み中...</p>
    </div>
  </div>
</div>

<script src="/static/app.js"></script>
</body>
</html>`;

app.get('*', (c) => c.html(htmlContent));

export default app;
