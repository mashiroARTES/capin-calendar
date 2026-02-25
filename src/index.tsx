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
      height: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    #month-table tbody { height: 100%; }
    #month-table tbody tr { height: calc((100% - 28px) / var(--cal-rows, 6)); }

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

    @media (max-width: 640px) {
      .cal-cell { padding: 2px 1px; }
      .cal-cell-inner { min-height: 48px; }
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

<script>
// ============================================================
// 定数・設定
// ============================================================

// 活動内容（旧担当動物を拡張）
const ACTIVITY_TYPES = {
  dog:          { label: '🐶 犬',    emoji: '🐶', color: '#3b82f6', bg: '#eff6ff' },
  cat:          { label: '🐱 猫',    emoji: '🐱', color: '#ec4899', bg: '#fdf2f8' },
  other_animal: { label: '🐾 動物その他', emoji: '🐾', color: '#8b5cf6', bg: '#f5f3ff' },
  office:       { label: '💼 事務',   emoji: '💼', color: '#f59e0b', bg: '#fffbeb' },
  negotiation:  { label: '🤝 折衝',   emoji: '🤝', color: '#10b981', bg: '#ecfdf5' },
  other_custom: { label: '✏️ その他', emoji: '✏️', color: '#6b7280', bg: '#f3f4f6' },
};
// 後方互換
const ANIMAL_TYPES = ACTIVITY_TYPES;

const API = {
  base: '/api',
  getToken()  { return localStorage.getItem('capin_token'); },
  setToken(t) { localStorage.setItem('capin_token', t); },
  removeToken(){ localStorage.removeItem('capin_token'); localStorage.removeItem('capin_user'); },
  getUser()   { try { return JSON.parse(localStorage.getItem('capin_user') || 'null'); } catch { return null; } },
  setUser(u)  { localStorage.setItem('capin_user', JSON.stringify(u)); },

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(this.base + path, opts);
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { this.removeToken(); App.showLogin(); }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'ネットワークエラー' } };
    }
  },
  get:    (p)    => API.request('GET', p),
  post:   (p, b) => API.request('POST', p, b),
  put:    (p, b) => API.request('PUT', p, b),
  delete: (p)    => API.request('DELETE', p),
};

// ============================================================
// 状態管理
// ============================================================
const State = {
  user: null,
  guestMode: false,
  calendars: [],
  shifts: [],
  dayNotes: {},   // { 'YYYY-MM-DD': { content, updated_by_name, updated_at } }
  currentCalendarSlug: null,
  currentYear:  new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  viewMode: 'month',   // 'month' | 'week' | 'list'
  loading: false,
};

// ============================================================
// トースト
// ============================================================
function showToast(msg, type = 'info', ms = 3200) {
  const c = document.getElementById('toast');
  const d = document.createElement('div');
  d.className = 'toast-item toast-' + type;
  d.textContent = msg;
  c.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity 0.3s'; setTimeout(() => d.remove(), 300); }, ms);
}

// ============================================================
// アプリ
// ============================================================
const App = {
  async init() {
    State.user = API.getUser();
    if (!State.user || !API.getToken()) {
      // 未ログイン → ログイン画面（ゲスト閲覧ボタン付き）
      this.showLogin();
      return;
    }
    const r = await API.get('/auth/me');
    if (!r.ok) { this.showLogin(); return; }
    State.user = r.data.user; API.setUser(State.user);
    await this.loadCalendars();
    this.showCalendar();
  },
  async loadCalendars() {
    const r = await API.get('/calendars');
    if (r.ok) State.calendars = r.data.calendars || [];
  },
  showLogin(prefill) {
    document.getElementById('app').innerHTML = renderLogin(prefill);
    bindLoginEvents();
  },
  showRegister(prefill) {
    document.getElementById('app').innerHTML = renderRegister(prefill);
    bindRegisterEvents(prefill);
  },
  showCalendar() {
    State.guestMode = false;
    document.getElementById('app').innerHTML = renderShell();
    bindShellEvents();
    this.loadAndRenderShifts();
  },
  async showGuestCalendar() {
    State.guestMode = true;
    State.user = null;
    await this.loadCalendars();
    document.getElementById('app').innerHTML = renderShell();
    bindShellEvents();
    this.loadAndRenderShifts();
  },

  async loadAndRenderShifts() {
    State.loading = true;
    renderContent();

    const y = State.currentYear;
    const m = State.currentMonth;
    let path = '/shifts?year=' + y + '&month=' + m;
    if (State.currentCalendarSlug) path += '&calendar=' + State.currentCalendarSlug;

    // シフトと掲示板を並列取得
    const [rShifts, rNotes] = await Promise.all([
      API.get(path),
      API.get('/day-notes?year=' + y + '&month=' + m),
    ]);
    if (rShifts.ok) State.shifts = rShifts.data.shifts || [];
    else State.shifts = [];

    // 掲示板をdate→オブジェクトのマップに変換
    State.dayNotes = {};
    if (rNotes.ok) {
      (rNotes.data.notes || []).forEach(n => { State.dayNotes[n.note_date] = n; });
    }

    State.loading = false;
    renderContent();
  },
  async logout() {
    API.removeToken(); State.user = null; State.shifts = []; State.dayNotes = {}; State.guestMode = false;
    showToast('ログアウトしました', 'info');
    this.showLogin();
  },
};

// ============================================================
// ログイン画面
// ============================================================
function renderLogin(prefill) {
  const email = (prefill && prefill.email) ? prefill.email : '';
  const pw    = (prefill && prefill.password) ? prefill.password : '';
  return \`<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-6xl mb-3 paw-icon">🐾</div>
      <h1 class="text-3xl font-bold text-gray-800">CAPINカレンダー</h1>
      <p class="text-gray-400 mt-1 text-sm">動物保護団体ボランティアシフト管理</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-8">
      <h2 class="text-xl font-semibold text-gray-700 mb-5">ログイン</h2>
      <div id="login-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <input type="email" id="login-email" required autocomplete="email"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="your@email.com" value="\${escHtml(email)}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
          <div class="relative">
            <input type="password" id="login-password" required autocomplete="current-password"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
              placeholder="パスワードを入力" value="\${escHtml(pw)}">
            <button type="button" onclick="togglePw('login-password',this)"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i class="fas fa-eye text-sm"></i></button>
          </div>
        </div>
        <button type="submit" id="login-btn"
          class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-sign-in-alt"></i>ログイン
        </button>
      </form>
      <div class="mt-5 pt-4 border-t border-gray-100 space-y-2">
        <button id="go-register-btn"
          class="w-full text-center text-blue-500 hover:text-blue-700 text-sm font-medium py-1">
          <i class="fas fa-user-plus mr-1"></i>新規アカウントを作成する
        </button>
        <button onclick="App.showGuestCalendar()"
          class="w-full text-center text-gray-400 hover:text-gray-600 text-sm py-1">
          <i class="fas fa-eye mr-1"></i>ログインせずに閲覧する
        </button>
        <button onclick="forgotPassword()" class="w-full text-center text-gray-300 hover:text-gray-500 text-xs py-0.5">
          <i class="fas fa-key mr-1"></i>パスワードをお忘れの方
        </button>
      </div>
    </div>
    <p class="text-center text-xs text-gray-400 mt-5">🐾 CAPIN（キャピン）動物保護団体</p>
  </div>
</div>\`;
}

// ============================================================
// 登録画面（prefill対応）
// ============================================================
function renderRegister(prefill) {
  const email = (prefill && prefill.email) ? prefill.email : '';
  const pw    = (prefill && prefill.password) ? prefill.password : '';
  return \`<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-6xl mb-3">🐾</div>
      <h1 class="text-3xl font-bold text-gray-800">CAPINカレンダー</h1>
      <p class="text-gray-400 mt-1 text-sm">動物保護団体ボランティアシフト管理</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-8">
      <h2 class="text-xl font-semibold text-gray-700 mb-1">新規アカウント作成</h2>
      <p class="text-xs text-gray-400 mb-5">
        <i class="fas fa-info-circle mr-1 text-blue-400"></i>
        一覧で分かりやすいよう、<strong>短めの名前</strong>（ニックネームなど）がオススメです
      </p>
      <div id="reg-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      <form id="reg-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            お名前（ユーザー名）
            <span class="text-gray-400 text-xs font-normal ml-1">短め推奨（例：やまだ、田中H）</span>
          </label>
          <input type="text" id="reg-name" required autocomplete="name" maxlength="20"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="やまだ（短めがオススメ）">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <input type="email" id="reg-email" required autocomplete="email"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="your@email.com" value="\${escHtml(email)}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">パスワード <span class="text-gray-400 text-xs">(8文字以上)</span></label>
          <div class="relative">
            <input type="password" id="reg-password" required minlength="8" autocomplete="new-password"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
              placeholder="パスワード（8文字以上）" value="\${escHtml(pw)}">
            <button type="button" onclick="togglePw('reg-password',this)"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i class="fas fa-eye text-sm"></i></button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
          <input type="password" id="reg-pw2" required minlength="8" autocomplete="new-password"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="パスワードを再入力" value="\${escHtml(pw)}">
        </div>
        <button type="submit" id="reg-btn"
          class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-user-plus"></i>アカウントを作成する
        </button>
      </form>
      <div class="mt-4 pt-4 border-t border-gray-100 text-center">
        <button onclick="App.showLogin()" class="text-blue-500 hover:text-blue-700 text-sm font-medium">
          <i class="fas fa-arrow-left mr-1"></i>ログイン画面に戻る
        </button>
      </div>
    </div>
  </div>
</div>\`;
}

// HTML エスケープ
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ============================================================
// シェル（ログイン後の骨格）
// ============================================================
function renderShell() {
  const isGuest = State.guestMode || !State.user;
  const isAdmin = State.user && State.user.role === 'admin';
  return \`<div class="flex flex-col h-screen">

    <!-- ゲストバナー -->
    \${isGuest ? \`<div class="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-between">
      <span class="text-xs text-amber-700"><i class="fas fa-eye mr-1"></i>閲覧専用モード — シフトの登録・変更はログインが必要です</span>
      <button onclick="App.showLogin()" class="text-xs bg-blue-500 text-white px-2.5 py-1 rounded-lg hover:bg-blue-600 transition-colors">
        <i class="fas fa-sign-in-alt mr-1"></i>ログイン
      </button>
    </div>\` : ''}

    <!-- ヘッダー -->
    <header class="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      <div class="max-w-screen-xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-2xl paw-icon">🐾</span>
          <div class="hidden sm:block">
            <div class="text-base font-bold text-gray-800 leading-tight">CAPINカレンダー</div>
            <div class="text-xs text-gray-400 leading-tight">ボランティアシフト管理</div>
          </div>
        </div>

        <div id="cal-tabs" class="flex items-center gap-1 flex-1 justify-center overflow-x-auto px-1"></div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
          \${!isGuest ? \`
          <span class="text-xs text-gray-500 hidden md:inline-flex items-center gap-1">
            <i class="fas fa-user"></i>\${escHtml(State.user.name)}
            \${isAdmin ? '<span class="bg-red-100 text-red-600 text-xs px-1 py-0.5 rounded font-bold ml-1">管理者</span>' : ''}
          </span>
          <button onclick="openShiftForm()"
            class="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
            <i class="fas fa-plus"></i><span class="hidden sm:inline">シフト登録</span>
          </button>
          <button onclick="openProfileModal()" title="プロフィール・アカウント名変更" class="text-gray-400 hover:text-blue-500 p-1.5 rounded-lg transition-colors">
            <i class="fas fa-user-cog text-sm"></i>
          </button>
          \${isAdmin ? \`<button onclick="openAdminModal()" title="管理者パネル" class="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors">
            <i class="fas fa-shield-alt text-sm"></i>
          </button>\` : ''}
          <button onclick="App.logout()" title="ログアウト"
            class="text-gray-400 hover:text-red-400 p-1.5 rounded-lg transition-colors">
            <i class="fas fa-sign-out-alt text-sm"></i>
          </button>\` : \`
          <button onclick="App.showLogin()" class="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
            <i class="fas fa-sign-in-alt mr-1"></i>ログイン
          </button>\`}
        </div>
      </div>
    </header>

    <!-- ナビゲーションバー -->
    <div class="bg-white border-b border-gray-100 flex-shrink-0 px-3 py-1.5">
      <div class="max-w-screen-xl mx-auto flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <button onclick="changeMonth(-1)" class="nav-btn" aria-label="前月">
            <i class="fas fa-chevron-left text-xs text-gray-600"></i>
          </button>
          <span id="month-label" class="text-sm font-bold text-gray-800 min-w-[96px] text-center">
            \${State.currentYear}年\${State.currentMonth}月
          </span>
          <button onclick="changeMonth(1)" class="nav-btn" aria-label="翌月">
            <i class="fas fa-chevron-right text-xs text-gray-600"></i>
          </button>
          <button onclick="goToToday()" class="nav-btn text-xs text-gray-600 px-2">今日</button>
        </div>
        <div class="flex items-center gap-1">
          <button id="view-month" onclick="setViewMode('month')" class="view-btn \${State.viewMode==='month'?'active':''}">
            <i class="fas fa-th mr-1 text-xs"></i>月
          </button>
          <button id="view-week"  onclick="setViewMode('week')"  class="view-btn \${State.viewMode==='week'?'active':''}">
            <i class="fas fa-calendar-week mr-1 text-xs"></i>週
          </button>
          <button id="view-list"  onclick="setViewMode('list')"  class="view-btn \${State.viewMode==='list'?'active':''}">
            <i class="fas fa-list mr-1 text-xs"></i>一覧
          </button>
        </div>
      </div>
    </div>

    <div id="cal-content" class="flex-1 overflow-hidden min-h-0"></div>
  </div>
  <div id="modal-root"></div>\`;
}

// ============================================================
// タブ・ラベルの個別更新
// ============================================================
function updateCalTabs() {
  const el = document.getElementById('cal-tabs');
  if (!el) return;
  const slug = State.currentCalendarSlug;
  let html = \`<button onclick="selectCalendar(null)"
    class="tab-btn px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 whitespace-nowrap \${slug===null?'active':'bg-white text-gray-600 hover:bg-gray-50'}">
    <i class="fas fa-layer-group mr-1"></i>全て</button>\`;
  State.calendars.forEach(c => {
    const active = slug === c.slug;
    html += \`<button onclick="selectCalendar('\${c.slug}')"
      class="tab-btn px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 whitespace-nowrap"
      style="\${active?'background:'+c.color+';color:white;border-color:'+c.color:'background:white;color:#4b5563'}">
      <span style="color:\${active?'white':c.color}">●</span>
      <span class="ml-0.5">\${escHtml(c.name)}</span></button>\`;
  });
  el.innerHTML = html;
}

function updateMonthLabel() {
  const el = document.getElementById('month-label');
  if (el) el.textContent = State.currentYear + '年' + State.currentMonth + '月';
}

function updateViewBtns() {
  ['month','week','list'].forEach(m => {
    const el = document.getElementById('view-' + m);
    if (el) el.classList.toggle('active', m === State.viewMode);
  });
}

// ============================================================
// コンテンツ描画（月・週・一覧）
// ============================================================
function renderContent() {
  const el = document.getElementById('cal-content');
  if (!el) return;
  el.style.overflow = State.viewMode === 'month' ? 'hidden' : 'auto';
  if (State.loading) {
    el.innerHTML = \`<div class="flex items-center justify-center h-full"><div class="spinner"></div></div>\`;
    return;
  }
  if (State.viewMode === 'month') el.innerHTML = renderMonthView();
  else if (State.viewMode === 'week') el.innerHTML = renderWeekView();
  else el.innerHTML = renderListView();
}

// ============================================================
// 日ごと一行掲示板ヘルパー
// ============================================================

// 月ビューのセル内に表示するミニ掲示板バー
function calNoteBadgeHtml(dateStr) {
  const note = State.dayNotes[dateStr];
  const hasContent = note && note.content && note.content.trim();
  return \`<div class="cal-note-bar" onclick="event.stopPropagation();openDayView('\${dateStr}',true)" title="\${hasContent ? '📌 '+escHtml(note.content) : '掲示板（タップして編集）'}">
    <span style="font-size:9px;flex-shrink:0">📌</span>
    \${hasContent
      ? \`<span class="cn-text">\${escHtml(note.content)}</span>\`
      : \`<span class="cn-empty">メモを追加…</span>\`
    }
  </div>\`;
}

// 日別モーダル内の掲示板UI（表示＋インライン編集）
function dayNoteSectionHtml(dateStr) {
  const note = State.dayNotes[dateStr];
  const content = note ? note.content : '';
  const updater = note && note.updated_by_name ? note.updated_by_name : '';
  const isGuest = State.guestMode || !State.user;

  return \`<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4" id="day-note-section">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-base">📌</span>
      <span class="text-sm font-bold text-amber-800">今日のひとこと掲示板</span>
      \${updater ? \`<span class="text-xs text-amber-500 ml-auto">最終更新: \${escHtml(updater)}</span>\` : ''}
    </div>
    \${isGuest
      ? \`<div class="text-sm text-amber-700 min-h-[28px] px-1 py-0.5 rounded leading-relaxed">
          \${content ? escHtml(content) : '<span class="opacity-50 italic">まだメモがありません</span>'}
         </div>
         <p class="text-xs text-amber-500 mt-1.5"><i class="fas fa-lock mr-1"></i>書き込みにはログインが必要です</p>\`
      : \`<textarea id="day-note-input" class="note-edit-area w-full" rows="2"
          maxlength="200" placeholder="この日のひとこと、連絡事項など…（200文字以内）"
          oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
        >\${escHtml(content)}</textarea>
        <div class="flex items-center justify-between mt-1.5">
          <span id="day-note-count" class="text-xs text-amber-400">\${content.length}/200</span>
          <button id="day-note-save-btn" onclick="saveDayNote('\${dateStr}')"
            class="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1">
            <i class="fas fa-save"></i>保存
          </button>
        </div>\`
    }
  </div>\`;
}

// 掲示板を保存してUIを更新
async function saveDayNote(dateStr) {
  const input = document.getElementById('day-note-input');
  const btn   = document.getElementById('day-note-save-btn');
  if (!input || !btn) return;
  const content = input.value.trim();
  btn.disabled = true; btn.innerHTML = '<div class="spinner w-3 h-3"></div>';
  const r = await API.put('/day-notes/' + dateStr, { content });
  if (r.ok) {
    // Stateを即時更新（リロードなし）
    State.dayNotes[dateStr] = r.data.note;
    showToast('掲示板を更新しました', 'success', 2000);
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i>保存';
    // 文字数カウント更新
    const cnt = document.getElementById('day-note-count');
    if (cnt) cnt.textContent = content.length + '/200';
    // カレンダーのバッジも更新（月ビューの場合）
    if (State.viewMode === 'month' || State.viewMode === 'week') {
      renderContent();
    }
  } else {
    showToast(r.data.error || '保存に失敗しました', 'error');
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i>保存';
  }
}

// 一覧ビューのノートバナー（クリックで日別モーダルへ）
function listNoteBannerHtml(dateStr) {
  const note = State.dayNotes[dateStr];
  const hasContent = note && note.content && note.content.trim();
  const isGuest = State.guestMode || !State.user;
  // 内容があるか、ログイン済みのときだけ表示
  if (!hasContent && isGuest) return '';
  return \`<div class="day-note-bar mb-2" onclick="openDayView('\${dateStr}',true)">
    <span class="note-icon">📌</span>
    \${hasContent
      ? \`<span class="note-text">\${escHtml(note.content)}</span>\`
      : \`<span class="note-empty">この日のひとことを書く…</span>\`
    }
    \${!isGuest ? '<span style="font-size:9px;color:#d97706;flex-shrink:0"><i class="fas fa-pencil-alt"></i></span>' : ''}
  </div>\`;
}

// ============================================================
// 活動内容の表示ラベル取得
// ============================================================
function getActivityLabel(s) {
  const type = s.activity_type || s.animal_type || 'other_animal';
  const at = ACTIVITY_TYPES[type] || ACTIVITY_TYPES.other_animal;
  if (type === 'other_custom' && s.activity_custom) return s.activity_custom;
  return at.label;
}
function getActivityEmoji(s) {
  const type = s.activity_type || s.animal_type || 'other_animal';
  return (ACTIVITY_TYPES[type] || ACTIVITY_TYPES.other_animal).emoji;
}
function getActivityColor(s) {
  const type = s.activity_type || s.animal_type || 'other_animal';
  return (ACTIVITY_TYPES[type] || ACTIVITY_TYPES.other_animal).color;
}

// 場所の表示名取得
function getLocationLabel(s) {
  if (s.location_type === 'other_location' && s.location_custom) return s.location_custom;
  return s.calendar_name || '';
}

// ============================================================
// 月表示（コンパクト行形式 - デフォルト）
// ============================================================
function renderMonthView() {
  const {currentYear:y, currentMonth:m} = State;
  const firstDay = new Date(y, m-1, 1).getDay();
  const lastDate = new Date(y, m, 0).getDate();
  const today = new Date();
  const days = ['日','月','火','水','木','金','土'];

  const map = {};
  State.shifts.forEach(s => { (map[s.shift_date] = map[s.shift_date] || []).push(s); });

  const rows = Math.ceil((firstDay + lastDate) / 7);

  let html = \`<div class="h-full flex flex-col" style="--cal-rows:\${rows}">
  <table id="month-table">
    <thead>
      <tr style="height:28px">\${days.map((d,i)=>\`<th class="text-xs font-semibold pb-1 \${i===0?'text-red-500':i===6?'text-blue-500':'text-gray-500'} text-center border-b border-gray-200">\${d}</th>\`).join('')}</tr>
    </thead>
    <tbody>\`;

  for (let row = 0; row < rows; row++) {
    html += '<tr>';
    for (let col = 0; col < 7; col++) {
      const day = row*7 + col - firstDay + 1;
      if (day < 1 || day > lastDate) {
        html += '<td class="cal-cell other-month"><div class="cal-cell-inner"></div></td>';
        continue;
      }
      const ds = \`\${y}-\${String(m).padStart(2,'0')}-\${String(day).padStart(2,'0')}\`;
      const isToday = today.getFullYear()===y && today.getMonth()+1===m && today.getDate()===day;
      const dayShifts = (map[ds] || []).sort((a,b)=>(a.start_time||'99:99') < (b.start_time||'99:99') ? -1 : 1);

      // 各シフトをコンパクト行で表示（最大4件+overflow）
      const maxShow = 4;
      let badgesHtml = '';
      dayShifts.slice(0, maxShow).forEach(s => {
        const color = s.calendar_color || '#4f8ef7';
        const emoji = getActivityEmoji(s);
        const timeStr = s.start_time ? s.start_time.slice(0,5) : '';
        const endStr  = s.end_time   ? s.end_time.slice(0,5)   : '';
        const timeLabel = timeStr ? (endStr ? timeStr+'-'+endStr : timeStr) : '';
        const name = escHtml(s.user_name);
        const safeS = encodeURIComponent(JSON.stringify(s));
        badgesHtml += \`<div class="day-compact-row" style="color:\${color}"
          onclick="event.stopPropagation();showDetail(decodeURIComponent('\${safeS}'))"
          title="\${name}\${timeLabel?' '+timeLabel:''} [\${getActivityLabel(s)}]">
          <span style="font-size:8px">\${emoji}</span>
          \${timeLabel ? '<span style="color:#6b7280;font-size:8.5px">'+timeLabel+'</span>' : ''}
          <span class="truncate" style="font-weight:600;font-size:9.5px">\${name}</span>
        </div>\`;
      });
      if (dayShifts.length > maxShow) {
        badgesHtml += \`<div class="text-xs text-gray-400 pl-1" style="font-size:9px">+\${dayShifts.length-maxShow}件</div>\`;
      }

      html += \`<td class="cal-cell \${isToday?'today':''}" onclick="openDayView('\${ds}')">
        <div class="cal-cell-inner">
          <div class="flex items-center justify-between mb-0.5">
            <span class="\${isToday?'bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold':'text-xs font-bold '+((col===0)?'text-red-500':(col===6)?'text-blue-500':'text-gray-700')}">\${day}</span>
            \${dayShifts.length > 0 ? \`<span style="font-size:8px;color:#9ca3af">\${dayShifts.length}</span>\` : ''}
          </div>
          \${calNoteBadgeHtml(ds)}
          \${badgesHtml}
        </div>
      </td>\`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

// ============================================================
// 週表示
// ============================================================
function renderWeekView() {
  const {currentYear:y, currentMonth:m} = State;
  const firstDay = new Date(y, m-1, 1);
  const lastDay  = new Date(y, m, 0);
  const today = new Date();
  const days = ['日','月','火','水','木','金','土'];

  const weeks = [];
  let week = [];
  for (let i = 0; i < firstDay.getDay(); i++) {
    week.push({ date: new Date(y, m-1, 1 - firstDay.getDay() + i), other: true });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(y, m-1, d);
    week.push({ date, other: false });
    if (date.getDay() === 6 || d === lastDay.getDate()) { weeks.push(week); week = []; }
  }

  const map = {};
  State.shifts.forEach(s => { (map[s.shift_date] = map[s.shift_date] || []).push(s); });

  let html = '<div class="p-3 max-w-screen-xl mx-auto pb-6 space-y-3">';
  weeks.forEach((wk, wi) => {
    html += \`<div class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      <div class="bg-gray-50 px-3 py-1 border-b border-gray-100 text-xs font-semibold text-gray-500">第\${wi+1}週</div>
      <table class="w-full table-fixed">
        <thead><tr>\${wk.map((cell,ci)=>{
          const isToday = cell.date.toDateString() === today.toDateString();
          return \`<th class="week-cell text-center \${ci===0?'text-red-500':ci===6?'text-blue-500':'text-gray-600'}">
            <div class="text-xs font-medium">\${days[cell.date.getDay()]}</div>
            <div class="\${isToday?'text-sm font-bold bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto':'text-sm font-bold'}">\${cell.other?'':cell.date.getDate()}</div>
          </th>\`;
        }).join('')}</tr></thead>
        <tbody><tr>\${wk.map(cell => {
          if (cell.other) return '<td class="week-cell bg-gray-50"></td>';
          const ds = cell.date.toISOString().split('T')[0];
          const shifts = (map[ds] || []).sort((a,b)=>(a.start_time||'99:99')<(b.start_time||'99:99')?-1:1);
          const badgesHtml = shifts.slice(0,3).map(s => {
            const color = s.calendar_color || '#4f8ef7';
            const emoji = getActivityEmoji(s);
            const time = s.start_time ? s.start_time.slice(0,5) : '';
            const safeS = encodeURIComponent(JSON.stringify(s));
            return \`<div class="day-compact-row" style="color:\${color}"
              onclick="event.stopPropagation();showDetail(decodeURIComponent('\${safeS}'))">
              <span style="font-size:8px">\${emoji}</span>
              \${time?'<span style="font-size:8px;color:#6b7280">'+time+'</span>':''}
              <span class="truncate" style="font-weight:600;font-size:9px">\${escHtml(s.user_name)}</span>
            </div>\`;
          }).join('') + (shifts.length > 3 ? \`<div style="font-size:9px;color:#9ca3af;padding-left:2px">+\${shifts.length-3}</div>\` : '');
          return \`<td class="week-cell" onclick="openDayView('\${ds}')">\${calNoteBadgeHtml(ds)}\${badgesHtml}</td>\`;
        }).join('')}</tr></tbody>
      </table>
    </div>\`;
  });
  html += '</div>';
  return html;
}

// ============================================================
// 一覧表示
// ============================================================
function renderListView() {
  const isGuest = State.guestMode || !State.user;
  if (State.shifts.length === 0) {
    return \`<div class="flex flex-col items-center justify-center h-64 text-center p-8">
      <div class="text-5xl mb-4">📅</div>
      <p class="text-gray-400 mb-4">この月のシフトはありません</p>
      \${!isGuest ? \`<button onclick="openShiftForm()"
        class="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors">
        シフトを登録する
      </button>\` : ''}
    </div>\`;
  }

  const grp = {};
  State.shifts.forEach(s => { (grp[s.shift_date] = grp[s.shift_date] || []).push(s); });
  const todayStr = new Date().toISOString().split('T')[0];
  const dayNames = ['日','月','火','水','木','金','土'];
  const isAdmin = State.user && State.user.role === 'admin';

  let html = '<div class="max-w-screen-xl mx-auto p-3 space-y-4">';
  Object.keys(grp).sort().forEach(date => {
    const d = new Date(date + 'T12:00:00');
    const dn = dayNames[d.getDay()];
    const isToday = date === todayStr;
    const sorted = grp[date].sort((a,b)=>(a.start_time||'99:99')<(b.start_time||'99:99')?-1:1);

    html += \`<div>
      <div class="flex items-center gap-2 mb-2 sticky top-0 bg-gray-50 py-1 z-10">
        <h3 class="text-sm font-bold \${isToday?'text-blue-600':'text-gray-700'}">\${date.replace(/-/g,'/')}（\${dn}）</h3>
        \${isToday?'<span class="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">今日</span>':''}
        <span class="text-xs text-gray-400">\${sorted.length}件</span>
      </div>
      \${listNoteBannerHtml(date)}
      <div class="space-y-1.5">\`;

    sorted.forEach(s => {
      const color = s.calendar_color || '#4f8ef7';
      const timeStr = s.start_time ? s.start_time.slice(0,5) + (s.end_time?' ～ '+s.end_time.slice(0,5):'') : '';
      const stMap = { pending:'未確認', approved:'承認済', rejected:'却下' };
      const stColor = { pending:'yellow', approved:'green', rejected:'red' };
      const safeS = encodeURIComponent(JSON.stringify(s));
      const isMine = s.user_id === (State.user && State.user.id);
      const locLabel = getLocationLabel(s);
      const actLabel = getActivityLabel(s);
      html += \`<div class="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow \${isMine?'bg-blue-50':''}"
        style="border-left-color:\${color}"
        onclick="showDetail(decodeURIComponent('\${safeS}'))">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-semibold text-gray-800 text-sm">\${escHtml(s.user_name)}</span>
            \${isMine?'<span class="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">自分</span>':''}
            <span class="text-xs font-medium" style="color:\${color}">\${escHtml(locLabel)}</span>
            <span class="text-xs px-1.5 py-0.5 rounded bg-\${stColor[s.status]||'gray'}-100 text-\${stColor[s.status]||'gray'}-700">\${stMap[s.status]||s.status}</span>
          </div>
          <div class="flex items-center gap-2 flex-wrap mt-0.5">
            <span class="text-xs text-gray-500">\${getActivityEmoji(s)} \${escHtml(actLabel)}</span>
            \${timeStr?'<span class="text-xs text-gray-500"><i class="fas fa-clock mr-0.5"></i>'+timeStr+'</span>':''}
            \${s.note?'<span class="text-xs text-gray-400 truncate"><i class="fas fa-sticky-note mr-0.5"></i>'+escHtml(s.note)+'</span>':''}
          </div>
        </div>
        \${(isMine || isAdmin) ? \`
        <button onclick="event.stopPropagation();deleteShift(\${s.id})"
          class="text-red-300 hover:text-red-500 text-xs p-1 flex-shrink-0 transition-colors">
          <i class="fas fa-trash"></i>
        </button>\` : ''}
      </div>\`;
    });
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

// ============================================================
// シフト登録モーダル
// ============================================================
function openShiftForm(defaultDate = null, adminOverrideName = null) {
  if (State.guestMode || !State.user) {
    showToast('シフトの登録にはログインが必要です', 'error');
    return;
  }
  const isAdmin = State.user && State.user.role === 'admin';
  const dateVal = defaultDate || new Date().toISOString().split('T')[0];
  const cal = State.calendars;
  const defaultCalId = State.currentCalendarSlug
    ? (cal.find(c => c.slug === State.currentCalendarSlug) || cal[0] || {}).id
    : (cal[0] || {}).id;

  const activityEntries = Object.entries(ACTIVITY_TYPES);
  const activityBtnsHtml = activityEntries.map(([k,v], i) => \`
    <label class="cursor-pointer">
      <input type="radio" name="activity_type" value="\${k}" class="sr-only" \${i===0?'checked':''}>
      <div class="act-btn" id="actb-\${k}">
        <div class="text-xl">\${v.emoji}</div>
        <div class="text-xs font-semibold mt-0.5 leading-tight" style="color:\${v.color}">\${v.label.replace(/^[^ ]+ /,'')}</div>
      </div>
    </label>\`).join('');

  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-calendar-plus text-blue-500 mr-2"></i>シフトを登録</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times"></i></button>
      </div>
      <div id="sf-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      <form id="sf-form" class="space-y-4">

        \${isAdmin ? \`
        <!-- 管理者：任意名前でのシフト登録 -->
        <div class="bg-red-50 border border-red-200 rounded-xl p-3">
          <label class="block text-sm font-medium text-red-700 mb-1">
            <i class="fas fa-shield-alt mr-1"></i>代理登録名（省略時は自分の名前）
          </label>
          <input type="text" id="sf-override-name" maxlength="20" placeholder="例：山田さん（空欄で自分名義）"
            value="\${escHtml(adminOverrideName || '')}"
            class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
        </div>\` : ''}

        <!-- 場所選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">場所 <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-2 gap-2">
            \${cal.map(c => \`
            <label class="cursor-pointer">
              <input type="radio" name="cal_id" value="\${c.id}" class="sr-only" \${c.id===defaultCalId?'checked':''}>
              <div class="cal-opt border-2 rounded-xl p-2.5 text-center transition-all \${c.id===defaultCalId?'':'border-gray-200'}"
                style="\${c.id===defaultCalId?'border-color:'+c.color+';background:'+c.color+'14':''}">
                <div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:\${c.color}"></div>
                <div class="text-xs font-medium text-gray-700 leading-tight">\${escHtml(c.name)}</div>
              </div>
            </label>\`).join('')}
            <label class="cursor-pointer">
              <input type="radio" name="cal_id" value="other_loc" class="sr-only">
              <div class="cal-opt border-2 border-gray-200 rounded-xl p-2.5 text-center transition-all" id="cal-other-box">
                <div class="w-3 h-3 rounded-full mx-auto mb-1 bg-gray-400"></div>
                <div class="text-xs font-medium text-gray-700 leading-tight">その他</div>
              </div>
            </label>
          </div>
          <div id="loc-custom-wrap" class="hidden mt-2">
            <input type="text" id="sf-loc-custom" maxlength="30" placeholder="場所を入力（例：本部、イベント会場）"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
        </div>

        <!-- 活動内容 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">活動内容 <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-3 gap-1.5">
            \${activityBtnsHtml}
          </div>
          <div id="act-custom-wrap" class="hidden mt-2">
            <input type="text" id="sf-act-custom" maxlength="30" placeholder="活動内容を入力"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
        </div>

        <!-- 日付 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">日付 <span class="text-red-500">*</span></label>
          <input type="date" id="sf-date" value="\${dateVal}" required
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>

        <!-- 時刻 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
            <input type="time" id="sf-start"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
            <input type="time" id="sf-end"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
        </div>

        <!-- メモ -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea id="sf-note" rows="2" placeholder="備考・メモ（任意）"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"></textarea>
        </div>

        <div class="flex gap-2 pt-1">
          <button type="button" onclick="closeModal()"
            class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">キャンセル</button>
          <button type="submit" id="sf-btn"
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            <i class="fas fa-check"></i>登録する
          </button>
        </div>
      </form>
    </div>
  </div>\`;

  // 活動内容ボタン初期スタイル
  const firstAct = activityEntries[0];
  if (firstAct) {
    const el = document.getElementById('actb-' + firstAct[0]);
    if (el) { el.style.borderColor = firstAct[1].color; el.style.background = firstAct[1].bg; }
  }

  // カレンダーオプションのクリック
  document.querySelectorAll('.cal-opt').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.cal-opt').forEach(o => { o.style.borderColor = '#e5e7eb'; o.style.background = ''; });
      const label = el.closest('label');
      const rad = label.querySelector('input');
      rad.checked = true;
      if (rad.value === 'other_loc') {
        el.style.borderColor = '#94a3b8'; el.style.background = '#f1f5f9';
        document.getElementById('loc-custom-wrap').classList.remove('hidden');
      } else {
        document.getElementById('loc-custom-wrap').classList.add('hidden');
        const c = State.calendars.find(c => c.id == rad.value);
        if (c) { el.style.borderColor = c.color; el.style.background = c.color + '14'; }
      }
    });
  });

  // 活動内容ラジオクリック
  document.querySelectorAll('input[name="activity_type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      Object.keys(ACTIVITY_TYPES).forEach(k => {
        const ab = document.getElementById('actb-' + k);
        if (!ab) return;
        if (radio.value === k) {
          const v = ACTIVITY_TYPES[k];
          ab.style.borderColor = v.color; ab.style.background = v.bg;
        } else {
          ab.style.borderColor = '#e5e7eb'; ab.style.background = '';
        }
      });
      const customWrap = document.getElementById('act-custom-wrap');
      if (customWrap) customWrap.classList.toggle('hidden', radio.value !== 'other_custom');
    });
  });

  // フォーム送信
  document.getElementById('sf-form').addEventListener('submit', async e => {
    e.preventDefault();
    const calIdRaw = document.querySelector('input[name="cal_id"]:checked')?.value;
    const activity = document.querySelector('input[name="activity_type"]:checked')?.value || 'dog';
    const actCustom = activity === 'other_custom' ? (document.getElementById('sf-act-custom')?.value || null) : null;
    const date  = document.getElementById('sf-date').value;
    const start = document.getElementById('sf-start').value || null;
    const end   = document.getElementById('sf-end').value || null;
    const note  = document.getElementById('sf-note').value || null;
    const overrideName = isAdmin ? (document.getElementById('sf-override-name')?.value?.trim() || null) : null;

    if (!calIdRaw) { showSfError('場所を選択してください'); return; }

    let calId = null;
    let locationType = null;
    let locationCustom = null;
    if (calIdRaw === 'other_loc') {
      locationType = 'other_location';
      locationCustom = document.getElementById('sf-loc-custom')?.value || null;
      if (!locationCustom) { showSfError('場所（その他）を入力してください'); return; }
      calId = State.calendars[0]?.id;
    } else {
      calId = +calIdRaw;
      const calObj = State.calendars.find(c => c.id === calId);
      locationType = calObj?.slug || null;
    }

    const btn = document.getElementById('sf-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner w-4 h-4"></div>';

    const payload = {
      calendar_id: calId,
      shift_date: date,
      start_time: start,
      end_time: end,
      note,
      activity_type: activity,
      activity_custom: actCustom,
      location_type: locationType,
      location_custom: locationCustom,
    };
    if (overrideName) payload.override_user_name = overrideName;

    const r = await API.post('/shifts', payload);
    if (r.ok) {
      closeModal(); showToast('シフトを登録しました 🐾', 'success');
      await App.loadAndRenderShifts();
    } else {
      showSfError(r.data.error || '登録に失敗しました');
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i>登録する';
    }
  });
}

function showSfError(msg) {
  const el = document.getElementById('sf-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

// ============================================================
// 日別一覧モーダル（日付タップ時）
// ============================================================
function openDayView(dateStr, focusNote = false) {
  const dayShifts = State.shifts
    .filter(s => s.shift_date === dateStr)
    .sort((a, b) => {
      const ta = a.start_time || '99:99';
      const tb = b.start_time || '99:99';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

  const d = new Date(dateStr + 'T12:00:00');
  const dayNames = ['日','月','火','水','木','金','土'];
  const dayName  = dayNames[d.getDay()];
  const isToday  = dateStr === new Date().toISOString().split('T')[0];
  const dispDate = dateStr.replace(/-/g, '/') + '（' + dayName + '）';
  const isGuest  = State.guestMode || !State.user;
  const isAdmin  = State.user && State.user.role === 'admin';

  // 時刻バー計算
  function calcBarStyle(s, color) {
    if (!s.start_time) return '';
    const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const BASE = 6*60, RANGE = 16*60;
    const st = Math.max(toMin(s.start_time) - BASE, 0);
    const en = s.end_time ? Math.min(toMin(s.end_time) - BASE, RANGE) : st + 60;
    const left  = Math.round(st / RANGE * 100);
    const width = Math.max(Math.round((en - st) / RANGE * 100), 3);
    return \`<div class="time-bar-wrap"><div class="time-bar-fill" style="background:\${color};width:\${width}%;margin-left:\${left}%"></div></div>\`;
  }

  // コンパクト一覧行（デフォルト表示）
  function shiftCompactRowHtml(s) {
    const color = s.calendar_color || '#4f8ef7';
    const emoji = getActivityEmoji(s);
    const actLabel = getActivityLabel(s);
    const locLabel = getLocationLabel(s);
    const isMine  = s.user_id === (State.user && State.user.id);
    const start   = s.start_time ? s.start_time.slice(0,5) : null;
    const end_t   = s.end_time   ? s.end_time.slice(0,5)   : null;
    const stMap   = { pending:'未確認', approved:'承認済', rejected:'却下' };
    const stClass = { pending:'bg-yellow-100 text-yellow-700', approved:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700' };
    const safeS   = encodeURIComponent(JSON.stringify(s));
    return \`<div class="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors \${isMine?'bg-blue-50':''}"
      onclick="showDetail(decodeURIComponent('\${safeS}'))">
      <!-- カラーバー -->
      <div class="w-1 self-stretch rounded-full flex-shrink-0" style="background:\${color}"></div>
      <!-- 時刻 -->
      <div class="text-xs font-bold text-blue-700 flex-shrink-0 w-20 text-center">
        \${start ? (start + (end_t ? ' ～ ' + end_t : '')) : '<span class="text-gray-300 font-normal text-xs">時刻未定</span>'}
      </div>
      <!-- 名前 -->
      <div class="flex items-center gap-1 min-w-0 flex-1">
        <span class="font-semibold text-gray-800 text-sm truncate">\${escHtml(s.user_name)}</span>
        \${isMine?'<span class="text-xs bg-blue-500 text-white px-1 py-0 rounded-full flex-shrink-0">自分</span>':''}
      </div>
      <!-- 場所・活動 -->
      <div class="text-xs text-gray-400 flex-shrink-0 text-right hidden sm:block" style="max-width:80px">
        <div class="truncate" style="color:\${color}">\${escHtml(locLabel)}</div>
        <div>\${emoji} \${escHtml(actLabel.replace(/^[^ ]+ /,''))}</div>
      </div>
      <!-- ステータス -->
      <span class="text-xs \${stClass[s.status]||'bg-gray-100 text-gray-600'} px-1.5 py-0.5 rounded flex-shrink-0">\${stMap[s.status]||s.status}</span>
    </div>\`;
  }

  // 詳細カード（時刻順ビュー用）
  function shiftCardHtml(s) {
    const color   = s.calendar_color || '#4f8ef7';
    const emoji   = getActivityEmoji(s);
    const actLabel = getActivityLabel(s);
    const locLabel = getLocationLabel(s);
    const safeS   = encodeURIComponent(JSON.stringify(s));
    const stMap   = { pending:'未確認', approved:'承認済', rejected:'却下' };
    const stClass = { pending:'bg-yellow-100 text-yellow-700', approved:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700' };
    const isMine  = s.user_id === (State.user && State.user.id);
    const start   = s.start_time ? s.start_time.slice(0,5) : null;
    const end_t   = s.end_time   ? s.end_time.slice(0,5)   : null;

    return \`<div class="day-shift-card \${isMine ? 'is-mine' : ''}" onclick="showDetail(decodeURIComponent('\${safeS}'))">
      <div class="shift-time-col">
        \${start ? \`
          <div class="t-start">\${start}</div>
          <div class="t-arrow">↓</div>
          <div class="t-end">\${end_t || '--:--'}</div>
        \` : '<div class="t-none">時刻<br>未設定</div>'}
      </div>
      <div class="shift-info-col">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-bold text-gray-800 text-sm">\${escHtml(s.user_name)}</span>
          \${isMine ? '<span class="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">自分</span>' : ''}
          <span class="text-xs \${stClass[s.status]||'bg-gray-100 text-gray-600'} px-1.5 py-0.5 rounded ml-auto">\${stMap[s.status]||s.status}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="shift-cal-dot" style="background:\${color}"></span>
          <span class="text-xs font-medium text-gray-600">\${escHtml(locLabel)}</span>
          <span class="text-xs text-gray-500 ml-1">\${emoji} \${escHtml(actLabel.replace(/^[^ ]+ /,''))}</span>
        </div>
        \${s.note ? \`<div class="text-xs text-gray-400 truncate">📝 \${escHtml(s.note)}</div>\` : ''}
        \${calcBarStyle(s, color)}
      </div>
      <div class="flex-shrink-0 text-gray-300 px-2.5 self-center">
        <i class="fas fa-chevron-right text-xs"></i>
      </div>
    </div>\`;
  }

  // デフォルト: コンパクト一覧
  let defaultBodyHtml = '';
  if (dayShifts.length === 0) {
    defaultBodyHtml = \`<div class="text-center py-8">
      <div class="text-4xl mb-3">📭</div>
      <p class="text-gray-400 text-sm">この日のシフトはまだ登録されていません</p>
    </div>\`;
  } else {
    defaultBodyHtml = \`<div class="space-y-0.5">\${dayShifts.map(shiftCompactRowHtml).join('')}</div>\`;
    // 活動内容サマリー
    const actMap = {};
    dayShifts.forEach(s => {
      const k = s.activity_type || s.animal_type || 'other_animal';
      actMap[k] = (actMap[k]||0) + 1;
    });
    const summaryHtml = Object.entries(actMap).map(([k,cnt]) => {
      const at = ACTIVITY_TYPES[k] || ACTIVITY_TYPES.other_animal;
      return \`<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style="background:\${at.color}18;color:\${at.color}">\${at.emoji} \${cnt}名</span>\`;
    }).join('');
    if (summaryHtml) defaultBodyHtml += \`<div class="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-gray-100">\${summaryHtml}</div>\`;
  }

  // 時刻順ビュー（ボタンで切り替え）
  const detailBodyHtml = dayShifts.length > 0
    ? \`<div class="space-y-2">\${dayShifts.map(shiftCardHtml).join('')}</div>\`
    : defaultBodyHtml;

  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content day-view-modal" onclick="event.stopPropagation()">
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            \${isToday ? '<span class="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">今日</span>' : ''}
            <h3 class="text-xl font-bold text-gray-800">\${dispDate}</h3>
          </div>
          <p class="text-xs text-gray-400 mt-0.5">シフト登録数: <strong class="text-gray-700">\${dayShifts.length}件</strong></p>
        </div>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>

      <!-- ★ 日ごと一行掲示板（最上部・全員編集可） -->
      \${dayNoteSectionHtml(dateStr)}

      <!-- 表示切り替えタブ -->
      <div class="flex gap-1 mb-3">
        <button id="dv-tab-simple" onclick="dvSwitchTab('simple')"
          class="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 bg-blue-500 text-white font-medium transition-colors">
          <i class="fas fa-list mr-1"></i>一覧
        </button>
        <button id="dv-tab-timeline" onclick="dvSwitchTab('timeline')"
          class="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 font-medium transition-colors">
          <i class="fas fa-clock mr-1"></i>時刻順（詳細）
        </button>
      </div>

      <div id="dv-body-simple" class="mb-4">\${defaultBodyHtml}</div>
      <div id="dv-body-timeline" class="mb-4 hidden">\${detailBodyHtml}</div>

      \${!isGuest ? \`<button onclick="closeModal(); openShiftForm('\${dateStr}')"
        class="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm">
        <i class="fas fa-plus"></i>この日にシフトを登録する
      </button>\` : \`<button onclick="App.showLogin()"
        class="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
        <i class="fas fa-sign-in-alt mr-1"></i>ログインして登録する
      </button>\`}
    </div>
  </div>\`;

  // 掲示板のテキストエリアに文字数カウントを紐付け
  const noteInput = document.getElementById('day-note-input');
  if (noteInput) {
    noteInput.addEventListener('input', () => {
      const cnt = document.getElementById('day-note-count');
      if (cnt) cnt.textContent = noteInput.value.length + '/200';
      noteInput.style.height = 'auto';
      noteInput.style.height = noteInput.scrollHeight + 'px';
    });
    // Ctrl+Enter で保存
    noteInput.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveDayNote(dateStr);
      }
    });
    if (focusNote) {
      noteInput.focus();
      noteInput.select();
    }
  }
}

function dvSwitchTab(tab) {
  const isSimple = tab === 'simple';
  document.getElementById('dv-tab-simple').className = \`flex-1 text-xs py-1.5 rounded-lg border border-gray-200 \${isSimple?'bg-blue-500 text-white':'bg-white text-gray-600'} font-medium transition-colors\`;
  document.getElementById('dv-tab-timeline').className = \`flex-1 text-xs py-1.5 rounded-lg border border-gray-200 \${!isSimple?'bg-blue-500 text-white':'bg-white text-gray-600'} font-medium transition-colors\`;
  document.getElementById('dv-body-simple').classList.toggle('hidden', !isSimple);
  document.getElementById('dv-body-timeline').classList.toggle('hidden', isSimple);
}

// ============================================================
// シフト詳細モーダル
// ============================================================
function showDetail(shiftStr) {
  let s;
  try { s = typeof shiftStr === 'string' ? JSON.parse(shiftStr) : shiftStr; } catch { return; }

  const color = s.calendar_color || '#4f8ef7';
  const emoji = getActivityEmoji(s);
  const actLabel = getActivityLabel(s);
  const locLabel = getLocationLabel(s);
  const timeStr = s.start_time ? s.start_time.slice(0,5) + (s.end_time?' ～ '+s.end_time.slice(0,5):'') : '時刻未設定';
  const stMap = { pending:'未確認', approved:'承認済', rejected:'却下' };
  const stColor = { pending:'yellow', approved:'green', rejected:'red' };
  const isOwner = s.user_id === (State.user && State.user.id);
  const isAdmin = State.user && State.user.role === 'admin';
  const safeS = encodeURIComponent(JSON.stringify(s));

  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-calendar-check mr-2" style="color:\${color}"></i>シフト詳細</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times"></i></button>
      </div>
      <div class="bg-gray-50 rounded-xl p-4 space-y-2.5 mb-4">
        <div class="flex items-center gap-3">
          <span class="w-5 h-5 rounded-full flex-shrink-0" style="background:\${color}"></span>
          <span class="font-semibold text-gray-800">\${escHtml(locLabel)}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xl">\${emoji}</span>
          <span class="font-semibold" style="color:\${getActivityColor(s)}">\${escHtml(actLabel)}</span>
        </div>
        <div class="flex items-center gap-3 text-gray-600">
          <i class="fas fa-user w-5 text-center text-gray-400"></i>
          <span>\${escHtml(s.user_name)}</span>
          \${isOwner?'<span class="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">自分</span>':''}
        </div>
        <div class="flex items-center gap-3 text-gray-600">
          <i class="fas fa-calendar w-5 text-center text-gray-400"></i><span>\${s.shift_date.replace(/-/g,'/')}</span>
        </div>
        <div class="flex items-center gap-3 text-gray-600">
          <i class="fas fa-clock w-5 text-center text-gray-400"></i><span>\${timeStr}</span>
        </div>
        \${s.note?\`<div class="flex items-start gap-3 text-gray-600"><i class="fas fa-sticky-note w-5 text-center text-gray-400 mt-0.5"></i><span>\${escHtml(s.note)}</span></div>\`:''}
        <div class="flex items-center gap-3">
          <i class="fas fa-info-circle w-5 text-center text-gray-400"></i>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-\${stColor[s.status]||'gray'}-100 text-\${stColor[s.status]||'gray'}-700">\${stMap[s.status]||s.status}</span>
        </div>
      </div>
      \${(isOwner || isAdmin) ? \`
      <div class="flex gap-2">
        <button onclick="openEditForm('\${safeS}')"
          class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-1">
          <i class="fas fa-edit"></i>\${isAdmin && !isOwner ? '管理者として編集' : '編集'}
        </button>
        <button onclick="deleteShift(\${s.id})"
          class="flex-1 border border-red-200 text-red-500 py-2 rounded-lg text-sm hover:bg-red-50 flex items-center justify-center gap-1">
          <i class="fas fa-trash"></i>削除
        </button>
      </div>\`:''}
    </div>
  </div>\`;
}

// ============================================================
// シフト編集モーダル
// ============================================================
function openEditForm(shiftStr) {
  let s;
  try { s = typeof shiftStr === 'string' ? JSON.parse(decodeURIComponent(shiftStr)) : shiftStr; } catch { return; }
  const isAdmin = State.user && State.user.role === 'admin';

  const activityEntries = Object.entries(ACTIVITY_TYPES);
  const currentAct = s.activity_type || s.animal_type || 'dog';

  const actBtnsHtml = activityEntries.map(([k,v]) => \`
    <label class="cursor-pointer">
      <input type="radio" name="edit_activity" value="\${k}" class="sr-only" \${currentAct===k?'checked':''}>
      <div class="act-btn" id="eab-\${k}" style="\${currentAct===k?'border-color:'+v.color+';background:'+v.bg:''}">
        <div class="text-lg">\${v.emoji}</div>
        <div class="text-xs font-semibold mt-0.5 leading-tight" style="color:\${v.color}">\${v.label.replace(/^[^ ]+ /,'')}</div>
      </div>
    </label>\`).join('');

  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-edit text-blue-500 mr-2"></i>シフトを編集</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times"></i></button>
      </div>
      <div id="ef-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>

      <!-- 活動内容変更 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">活動内容</label>
        <div class="grid grid-cols-3 gap-1.5">
          \${actBtnsHtml}
        </div>
        <div id="ef-act-custom-wrap" class="\${currentAct==='other_custom'?'':'hidden'} mt-2">
          <input type="text" id="ef-act-custom" maxlength="30" placeholder="活動内容を入力"
            value="\${escHtml(s.activity_custom||'')}"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
      </div>

      <form id="ef-form" class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">日付</label>
          <div class="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5">\${s.shift_date.replace(/-/g,'/')}</div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
            <input type="time" id="ef-start" value="\${s.start_time||''}"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
            <input type="time" id="ef-end" value="\${s.end_time||''}"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
        </div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea id="ef-note" rows="2"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none">\${escHtml(s.note||'')}</textarea>
        </div>
        \${isAdmin ? \`
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ステータス（管理者のみ）</label>
          <select id="ef-status" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="pending" \${s.status==='pending'?'selected':''}>未確認</option>
            <option value="approved" \${s.status==='approved'?'selected':''}>承認済</option>
            <option value="rejected" \${s.status==='rejected'?'selected':''}>却下</option>
          </select>
        </div>\` : ''}
        <div class="flex gap-2 pt-1">
          <button type="button" onclick="closeModal()"
            class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">キャンセル</button>
          <button type="submit" id="ef-btn"
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            <i class="fas fa-save"></i>保存する
          </button>
        </div>
      </form>
    </div>
  </div>\`;

  // 活動内容ラジオ
  document.querySelectorAll('input[name="edit_activity"]').forEach(radio => {
    radio.addEventListener('change', () => {
      Object.keys(ACTIVITY_TYPES).forEach(k => {
        const ab = document.getElementById('eab-'+k);
        if (!ab) return;
        if (radio.value === k) {
          const v = ACTIVITY_TYPES[k];
          ab.style.borderColor = v.color; ab.style.background = v.bg;
        } else {
          ab.style.borderColor = '#e5e7eb'; ab.style.background = '';
        }
      });
      const w = document.getElementById('ef-act-custom-wrap');
      if (w) w.classList.toggle('hidden', radio.value !== 'other_custom');
    });
  });

  document.getElementById('ef-form').addEventListener('submit', async e => {
    e.preventDefault();
    const actType = document.querySelector('input[name="edit_activity"]:checked')?.value || s.activity_type || 'dog';
    const actCustom = actType === 'other_custom' ? (document.getElementById('ef-act-custom')?.value || null) : null;
    const start  = document.getElementById('ef-start').value || null;
    const end    = document.getElementById('ef-end').value || null;
    const note   = document.getElementById('ef-note').value || null;
    const status = isAdmin ? document.getElementById('ef-status')?.value : undefined;

    const btn = document.getElementById('ef-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner w-4 h-4"></div>';

    const payload = { start_time: start, end_time: end, note, activity_type: actType, activity_custom: actCustom };
    if (status) payload.status = status;

    const r = await API.put('/shifts/' + s.id, payload);
    if (r.ok) {
      closeModal(); showToast('シフトを更新しました', 'success');
      await App.loadAndRenderShifts();
    } else {
      const el = document.getElementById('ef-error');
      if (el) { el.textContent = r.data.error || '更新に失敗しました'; el.classList.remove('hidden'); }
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i>保存する';
    }
  });
}

// ============================================================
// シフト削除
// ============================================================
async function deleteShift(id) {
  if (!confirm('このシフトを削除しますか？')) return;
  const r = await API.delete('/shifts/' + id);
  if (r.ok) { closeModal(); showToast('シフトを削除しました', 'success'); await App.loadAndRenderShifts(); }
  else showToast(r.data.error || '削除に失敗しました', 'error');
}

// ============================================================
// プロフィールモーダル（アカウント名変更）
// ============================================================
function openProfileModal() {
  if (!State.user) return;
  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-user-cog text-blue-500 mr-2"></i>プロフィール</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times"></i></button>
      </div>
      <div class="bg-blue-50 rounded-xl p-3 mb-5 text-sm text-blue-700">
        <i class="fas fa-info-circle mr-1"></i>
        シフト一覧で分かりやすいよう、<strong>短めの名前</strong>（例: やまだ、田中H）がオススメです
      </div>
      <div id="profile-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      <div id="profile-success" class="hidden bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm"></div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">現在の名前</label>
          <div class="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5">\${escHtml(State.user.name)}</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            新しい名前 <span class="text-gray-400 text-xs">(20文字以内)</span>
          </label>
          <input type="text" id="profile-name" maxlength="20" placeholder="新しい名前を入力"
            value="\${escHtml(State.user.name)}"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <div class="text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5">\${escHtml(State.user.email)}</div>
        </div>
        <div class="flex gap-2">
          <button onclick="closeModal()"
            class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">閉じる</button>
          <button id="profile-save-btn" onclick="saveProfileName()"
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            <i class="fas fa-save"></i>名前を変更する
          </button>
        </div>
      </div>
    </div>
  </div>\`;
}

async function saveProfileName() {
  const nameInput = document.getElementById('profile-name');
  const btn = document.getElementById('profile-save-btn');
  const errEl = document.getElementById('profile-error');
  const sucEl = document.getElementById('profile-success');
  if (!nameInput || !btn) return;
  const name = nameInput.value.trim();
  if (!name) { errEl.textContent = '名前を入力してください'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden'); sucEl.classList.add('hidden');
  btn.disabled = true; btn.innerHTML = '<div class="spinner w-4 h-4"></div>';
  const r = await API.put('/users/me', { name });
  if (r.ok) {
    State.user = { ...State.user, name: r.data.user.name };
    API.setUser(State.user);
    sucEl.textContent = '名前を変更しました！'; sucEl.classList.remove('hidden');
    // ヘッダーのユーザー名も更新
    const nameSpan = document.querySelector('span.text-xs.text-gray-500.hidden');
    if (nameSpan) nameSpan.innerHTML = '<i class="fas fa-user"></i>' + escHtml(State.user.name);
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i>名前を変更する';
    showToast('名前を変更しました', 'success');
  } else {
    errEl.textContent = r.data.error || '変更に失敗しました'; errEl.classList.remove('hidden');
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i>名前を変更する';
  }
}

// ============================================================
// 管理者パネルモーダル
// ============================================================
async function openAdminModal() {
  if (!State.user || State.user.role !== 'admin') return;

  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content" onclick="event.stopPropagation()" style="max-width:560px">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-shield-alt text-red-500 mr-2"></i>管理者パネル</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times"></i></button>
      </div>
      <div id="admin-msg" class="hidden mb-3 p-3 rounded-lg text-sm"></div>

      <!-- メールで管理者昇格 -->
      <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
        <h4 class="text-sm font-semibold text-red-700 mb-2"><i class="fas fa-user-shield mr-1"></i>メールアドレスで権限変更</h4>
        <div class="flex gap-2">
          <input type="email" id="admin-email-input" placeholder="対象ユーザーのメールアドレス"
            class="flex-1 border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
          <select id="admin-role-select" class="border border-red-200 rounded-lg px-3 py-2 text-sm">
            <option value="admin">管理者にする</option>
            <option value="volunteer">一般に戻す</option>
          </select>
        </div>
        <button onclick="adminPromoteByEmail()"
          class="mt-2 w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
          権限を変更する
        </button>
      </div>

      <!-- ユーザー一覧 -->
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-users mr-1"></i>ユーザー一覧</h4>
        <div id="admin-user-list" class="space-y-1.5 max-h-60 overflow-y-auto">
          <div class="flex items-center justify-center py-4"><div class="spinner w-5 h-5"></div></div>
        </div>
      </div>
    </div>
  </div>\`;

  // ユーザー一覧ロード
  loadAdminUserList();
}

async function loadAdminUserList() {
  const r = await API.get('/users');
  const el = document.getElementById('admin-user-list');
  if (!el) return;
  if (!r.ok) { el.innerHTML = '<p class="text-xs text-red-500">ユーザー取得に失敗しました</p>'; return; }
  const users = r.data.users || [];
  if (users.length === 0) { el.innerHTML = '<p class="text-xs text-gray-400">ユーザーがいません</p>'; return; }
  el.innerHTML = users.map(u => \`<div class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
    <div class="flex-1 min-w-0">
      <div class="text-sm font-semibold text-gray-800">\${escHtml(u.name)}</div>
      <div class="text-xs text-gray-400">\${escHtml(u.email)}</div>
    </div>
    <span class="text-xs px-2 py-0.5 rounded-full \${u.role==='admin'?'bg-red-100 text-red-600 font-bold':'bg-gray-100 text-gray-500'}">\${u.role==='admin'?'管理者':'一般'}</span>
  </div>\`).join('');
}

async function adminPromoteByEmail() {
  const email = document.getElementById('admin-email-input')?.value?.trim();
  const role  = document.getElementById('admin-role-select')?.value;
  const msgEl = document.getElementById('admin-msg');
  if (!email) { showAdminMsg('メールアドレスを入力してください', 'error'); return; }
  const r = await API.post('/users/promote-by-email', { email, role });
  if (r.ok) {
    showAdminMsg(r.data.message, 'success');
    loadAdminUserList();
  } else {
    showAdminMsg(r.data.error || '変更に失敗しました', 'error');
  }
}

function showAdminMsg(msg, type) {
  const el = document.getElementById('admin-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = \`mb-3 p-3 rounded-lg text-sm \${type==='success'?'bg-green-50 text-green-700':'bg-red-50 text-red-600'}\`;
  el.classList.remove('hidden');
}

// ============================================================
// ナビ操作
// ============================================================
function changeMonth(delta) {
  State.currentMonth += delta;
  if (State.currentMonth > 12) { State.currentMonth = 1; State.currentYear++; }
  if (State.currentMonth < 1)  { State.currentMonth = 12; State.currentYear--; }
  updateMonthLabel();
  App.loadAndRenderShifts();
}

function goToToday() {
  const now = new Date();
  State.currentYear  = now.getFullYear();
  State.currentMonth = now.getMonth() + 1;
  updateMonthLabel();
  App.loadAndRenderShifts();
}

function setViewMode(mode) {
  State.viewMode = mode;
  updateViewBtns();
  renderContent();
}

function selectCalendar(slug) {
  State.currentCalendarSlug = slug;
  updateCalTabs();
  App.loadAndRenderShifts();
}

// ============================================================
// モーダル
// ============================================================
function closeModalOuter(e) { if (e.target === e.currentTarget) closeModal(); }
function closeModal() { const el = document.getElementById('modal-root'); if (el) el.innerHTML = ''; }

// ============================================================
// 認証イベント
// ============================================================
function bindLoginEvents() {
  // 「新規アカウント作成」ボタン：入力値を引き継いで登録画面へ
  document.getElementById('go-register-btn')?.addEventListener('click', () => {
    const email = document.getElementById('login-email')?.value || '';
    const pw    = document.getElementById('login-password')?.value || '';
    App.showRegister({ email, password: pw });
  });

  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pw    = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    btn.disabled = true; btn.innerHTML = '<div class="spinner w-5 h-5"></div>'; err.classList.add('hidden');
    const r = await API.post('/auth/login', { email, password: pw });
    if (r.ok) {
      API.setToken(r.data.token); API.setUser(r.data.user); State.user = r.data.user;
      showToast('ようこそ ' + r.data.user.name + ' さん！', 'success');
      await App.loadCalendars(); App.showCalendar();
    } else {
      err.textContent = r.data.error || 'ログインに失敗しました'; err.classList.remove('hidden');
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i>ログイン';
    }
  });
}

function bindRegisterEvents(prefill) {
  // 登録ページからログインページに戻る時も入力を引き継ぐ
  document.querySelector('#reg-form ~ div button[onclick="App.showLogin()"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email')?.value || '';
    const pw    = document.getElementById('reg-password')?.value || '';
    App.showLogin({ email, password: pw });
  });

  document.getElementById('reg-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name  = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pw    = document.getElementById('reg-password').value;
    const pw2   = document.getElementById('reg-pw2').value;
    const btn = document.getElementById('reg-btn');
    const err = document.getElementById('reg-error');
    err.classList.add('hidden');
    if (pw !== pw2) { err.textContent = 'パスワードが一致しません'; err.classList.remove('hidden'); return; }
    btn.disabled = true; btn.innerHTML = '<div class="spinner w-5 h-5"></div>';
    const r = await API.post('/auth/register', { name, email, password: pw });
    if (r.ok) {
      API.setToken(r.data.token); API.setUser(r.data.user); State.user = r.data.user;
      showToast('アカウントを作成しました！ようこそ ' + r.data.user.name + ' さん', 'success');
      await App.loadCalendars(); App.showCalendar();
    } else {
      err.textContent = r.data.error || 'アカウント作成に失敗しました'; err.classList.remove('hidden');
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i>アカウントを作成する';
    }
  });
}

function bindShellEvents() {
  updateCalTabs();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (!document.querySelector('.modal-overlay')) {
      if (e.key === 'ArrowLeft')  changeMonth(-1);
      if (e.key === 'ArrowRight') changeMonth(1);
    }
  }, { once: true });
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.innerHTML = inp.type === 'password'
    ? '<i class="fas fa-eye text-sm"></i>'
    : '<i class="fas fa-eye-slash text-sm"></i>';
}

function forgotPassword() {
  if (confirm('パスワードをお忘れですか？\\n\\n新しいアカウントを作成することができます。\\n「OK」を押すと新規登録画面に移動します。')) {
    App.showRegister();
  }
}

// ============================================================
// 起動
// ============================================================
App.init();
</script>
</body>
</html>`;

app.get('*', (c) => c.html(htmlContent));

export default app;
