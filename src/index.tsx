// CAPINカレンダー メインアプリケーション

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import authRoutes from './routes/auth'
import shiftsRoutes from './routes/shifts'
import calendarsRoutes from './routes/calendars'
import usersRoutes from './routes/users'
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
      min-height: 100px;
      vertical-align: top;
      border: 1px solid #e5e7eb;
      padding: 4px 3px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .cal-cell:hover { background: #f0f7ff; }
    .cal-cell.today { background: #fffbeb; }
    .cal-cell.other-month { background: #f9fafb; opacity: 0.6; }
    .cal-cell.today:hover { background: #fef3c7; }

    /* シフトバッジ */
    .shift-badge {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 10px;
      padding: 1px 5px;
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

    /* 動物種別グループヘッダー */
    .animal-group-header {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 9px;
      font-weight: 700;
      color: #6b7280;
      margin-top: 3px;
      margin-bottom: 1px;
      padding-left: 2px;
    }

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

    /* 動物種別選択ボタン */
    .animal-btn {
      flex: 1;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      padding: 10px 6px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
      background: white;
    }
    .animal-btn:hover { border-color: #93c5fd; background: #eff6ff; }
    .animal-btn.selected-dog  { border-color: #3b82f6; background: #eff6ff; }
    .animal-btn.selected-cat  { border-color: #ec4899; background: #fdf2f8; }
    .animal-btn.selected-other{ border-color: #8b5cf6; background: #f5f3ff; }

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
    .week-cell { min-height: 64px; border: 1px solid #e5e7eb; padding: 4px 3px; vertical-align: top; }

    /* ナビボタン */
    .nav-btn { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; cursor:pointer; transition:all 0.15s; }
    .nav-btn:hover { background:#f1f5f9; }
    .view-btn { padding:6px 14px; border-radius:6px; font-size:13px; cursor:pointer; border:1px solid #e5e7eb; transition:all 0.15s; background:white; }
    .view-btn.active { background:#1e40af; color:white; border-color:#1e40af; }
    .tab-btn { transition: all 0.2s; }
    .tab-btn.active { background:#4f8ef7; color:white; }

    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:#f1f5f9; }
    ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }

    @media (max-width: 640px) {
      .cal-cell { min-height: 64px; padding: 2px; }
      .shift-badge { font-size: 9px; padding: 1px 3px; }
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
const ANIMAL_TYPES = {
  dog:   { label: '🐶 犬',  emoji: '🐶', color: '#3b82f6', bg: '#eff6ff' },
  cat:   { label: '🐱 猫',  emoji: '🐱', color: '#ec4899', bg: '#fdf2f8' },
  other: { label: '🐾 その他', emoji: '🐾', color: '#8b5cf6', bg: '#f5f3ff' },
};

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
  calendars: [],
  shifts: [],
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
    if (!State.user || !API.getToken()) { this.showLogin(); return; }
    const r = await API.get('/auth/me');
    if (!r.ok) { this.showLogin(); return; }
    State.user = r.data.user; API.setUser(State.user);
    await this.loadCalendars();
    this.showCalendar();
  },
  async loadCalendars() {
    const r = await API.get('/calendars');
    if (r.ok) State.calendars = r.data.calendars;
  },
  showLogin()    { document.getElementById('app').innerHTML = renderLogin();    bindLoginEvents(); },
  showRegister() { document.getElementById('app').innerHTML = renderRegister(); bindRegisterEvents(); },
  showCalendar() { document.getElementById('app').innerHTML = renderShell();    bindShellEvents(); this.loadAndRenderShifts(); },

  async loadAndRenderShifts() {
    State.loading = true;
    renderContent();

    let path = '/shifts?year=' + State.currentYear + '&month=' + State.currentMonth;
    if (State.currentCalendarSlug) path += '&calendar=' + State.currentCalendarSlug;

    const r = await API.get(path);
    if (r.ok) State.shifts = r.data.shifts || [];
    else State.shifts = [];

    State.loading = false;
    renderContent();
  },
  async logout() {
    API.removeToken(); State.user = null; State.shifts = [];
    showToast('ログアウトしました', 'info');
    this.showLogin();
  },
};

// ============================================================
// ログイン画面
// ============================================================
function renderLogin() {
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
            placeholder="your@email.com">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
          <div class="relative">
            <input type="password" id="login-password" required autocomplete="current-password"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
              placeholder="パスワードを入力">
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
      <div class="mt-5 pt-4 border-t border-gray-100 text-center space-y-2">
        <button onclick="App.showRegister()" class="text-blue-500 hover:text-blue-700 text-sm font-medium">
          <i class="fas fa-user-plus mr-1"></i>新規アカウントを作成する
        </button><br>
        <button onclick="forgotPassword()" class="text-gray-400 hover:text-gray-600 text-xs">
          <i class="fas fa-key mr-1"></i>パスワードをお忘れの方
        </button>
      </div>
    </div>
    <p class="text-center text-xs text-gray-400 mt-5">🐾 CAPIN（キャピン）動物保護団体</p>
  </div>
</div>\`;
}

function renderRegister() {
  return \`<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-6xl mb-3">🐾</div>
      <h1 class="text-3xl font-bold text-gray-800">CAPINカレンダー</h1>
      <p class="text-gray-400 mt-1 text-sm">動物保護団体ボランティアシフト管理</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-8">
      <h2 class="text-xl font-semibold text-gray-700 mb-5">新規アカウント作成</h2>
      <div id="reg-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      <form id="reg-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">お名前（ユーザー名）</label>
          <input type="text" id="reg-name" required autocomplete="name"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="山田 花子">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <input type="email" id="reg-email" required autocomplete="email"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="your@email.com">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">パスワード <span class="text-gray-400 text-xs">(8文字以上)</span></label>
          <div class="relative">
            <input type="password" id="reg-password" required minlength="8" autocomplete="new-password"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
              placeholder="パスワード（8文字以上）">
            <button type="button" onclick="togglePw('reg-password',this)"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i class="fas fa-eye text-sm"></i></button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
          <input type="password" id="reg-pw2" required minlength="8" autocomplete="new-password"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="パスワードを再入力">
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

// ============================================================
// シェル（ログイン後の骨格 — ナビ部分は動的更新専用関数で描画）
// ============================================================
function renderShell() {
  return \`<div class="flex flex-col h-screen">

    <!-- ヘッダー（固定） -->
    <header class="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      <div class="max-w-screen-xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
        <!-- ロゴ -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-2xl paw-icon">🐾</span>
          <div class="hidden sm:block">
            <div class="text-base font-bold text-gray-800 leading-tight">CAPINカレンダー</div>
            <div class="text-xs text-gray-400 leading-tight">ボランティアシフト管理</div>
          </div>
        </div>

        <!-- カレンダーフィルタータブ -->
        <div id="cal-tabs" class="flex items-center gap-1 flex-1 justify-center overflow-x-auto px-1"></div>

        <!-- 右側ボタン -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class="text-xs text-gray-500 hidden md:block">
            <i class="fas fa-user mr-0.5"></i>\${State.user ? State.user.name : ''}
          </span>
          <button onclick="openShiftForm()"
            class="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
            <i class="fas fa-plus"></i><span class="hidden sm:inline">シフト登録</span>
          </button>
          <button onclick="App.logout()" title="ログアウト"
            class="text-gray-400 hover:text-red-400 p-1.5 rounded-lg transition-colors">
            <i class="fas fa-sign-out-alt text-sm"></i>
          </button>
        </div>
      </div>
    </header>

    <!-- ナビゲーションバー（月切り替え・表示モード） -->
    <div class="bg-white border-b border-gray-100 flex-shrink-0 px-3 py-2">
      <div class="max-w-screen-xl mx-auto flex items-center justify-between gap-2">
        <!-- 月ナビ -->
        <div class="flex items-center gap-1.5">
          <button onclick="changeMonth(-1)" class="nav-btn" aria-label="前月">
            <i class="fas fa-chevron-left text-xs text-gray-600"></i>
          </button>
          <span id="month-label" class="text-sm font-bold text-gray-800 min-w-[100px] text-center">
            \${State.currentYear}年\${State.currentMonth}月
          </span>
          <button onclick="changeMonth(1)" class="nav-btn" aria-label="翌月">
            <i class="fas fa-chevron-right text-xs text-gray-600"></i>
          </button>
          <button onclick="goToToday()" class="nav-btn text-xs text-gray-600 px-2">今日</button>
        </div>

        <!-- 表示モード -->
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

    <!-- コンテンツ -->
    <div id="cal-content" class="flex-1 overflow-auto min-h-0"></div>
  </div>

  <div id="modal-root"></div>\`;
}

// ============================================================
// タブ・ラベルの個別更新（カレンダー全体を再描画しない）
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
      <span class="ml-0.5">\${c.name}</span></button>\`;
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
    if (!el) return;
    el.classList.toggle('active', m === State.viewMode);
  });
}

// ============================================================
// コンテンツ描画（月・週・一覧）
// ============================================================
function renderContent() {
  const el = document.getElementById('cal-content');
  if (!el) return;
  if (State.loading) {
    el.innerHTML = \`<div class="flex items-center justify-center h-40"><div class="spinner"></div></div>\`;
    return;
  }
  if (State.viewMode === 'month') el.innerHTML = renderMonthView();
  else if (State.viewMode === 'week') el.innerHTML = renderWeekView();
  else el.innerHTML = renderListView();
}

// ---------- 動物種別グループ化ヘルパー ----------
function groupByAnimal(shifts) {
  const g = { dog: [], cat: [], other: [] };
  shifts.forEach(s => { const k = s.animal_type || 'other'; (g[k] || (g[k]=[])).push(s); });
  return g;
}

function shiftBadgesHtml(shifts, showAnimalGroups = true) {
  if (!shifts || shifts.length === 0) return '';
  if (!showAnimalGroups) {
    return shifts.slice(0,4).map(s => singleBadgeHtml(s)).join('') +
      (shifts.length > 4 ? \`<span class="text-xs text-gray-400 pl-1">+\${shifts.length-4}</span>\` : '');
  }
  // 動物種別でグループ化して表示
  const g = groupByAnimal(shifts);
  let html = '';
  ['dog','cat','other'].forEach(type => {
    if (!g[type] || g[type].length === 0) return;
    const at = ANIMAL_TYPES[type];
    html += \`<div class="animal-group-header"><span>\${at.emoji}</span></div>\`;
    const max = 3;
    g[type].slice(0, max).forEach(s => { html += singleBadgeHtml(s); });
    if (g[type].length > max) html += \`<span class="text-xs pl-1" style="color:\${at.color}">+\${g[type].length-max}</span>\`;
  });
  return html;
}

function singleBadgeHtml(s) {
  const color = s.calendar_color || '#4f8ef7';
  const at = ANIMAL_TYPES[s.animal_type || 'other'];
  const time = s.start_time ? s.start_time.slice(0,5) : '';
  const label = (time ? time + ' ' : '') + s.user_name;
  const safeS = encodeURIComponent(JSON.stringify(s));
  return \`<span class="shift-badge"
    style="background:\${color}18;color:\${color};border:1px solid \${color}40"
    onclick="event.stopPropagation();showDetail(decodeURIComponent('\${safeS}'))"
    title="\${s.user_name}\${time?' ('+time+(s.end_time?' ～ '+s.end_time.slice(0,5):'')+')':''} [\${at.label}]">
    <span style="font-size:9px">\${at.emoji}</span><span class="truncate">\${label}</span>
  </span>\`;
}

// ============================================================
// 月表示
// ============================================================
function renderMonthView() {
  const {currentYear:y, currentMonth:m} = State;
  const firstDay = new Date(y, m-1, 1).getDay();
  const lastDate = new Date(y, m, 0).getDate();
  const today = new Date();
  const days = ['日','月','火','水','木','金','土'];

  // 日別シフトマップ
  const map = {};
  State.shifts.forEach(s => { (map[s.shift_date] = map[s.shift_date] || []).push(s); });

  const rows = Math.ceil((firstDay + lastDate) / 7);
  let html = \`<div class="p-2 max-w-screen-xl mx-auto">
  <table class="w-full border-collapse table-fixed">
    <thead><tr>\${days.map((d,i)=>\`<th class="py-1.5 text-xs font-semibold \${i===0?'text-red-500':i===6?'text-blue-500':'text-gray-500'} text-center">\${d}</th>\`).join('')}</tr></thead>
    <tbody>\`;

  for (let row = 0; row < rows; row++) {
    html += '<tr>';
    for (let col = 0; col < 7; col++) {
      const day = row*7 + col - firstDay + 1;
      if (day < 1 || day > lastDate) { html += '<td class="cal-cell other-month"></td>'; continue; }
      const ds = \`\${y}-\${String(m).padStart(2,'0')}-\${String(day).padStart(2,'0')}\`;
      const isToday = today.getFullYear()===y && today.getMonth()+1===m && today.getDate()===day;
      const shifts = map[ds] || [];
      html += \`<td class="cal-cell \${isToday?'today':''}" onclick="openShiftForm('\${ds}')">
        <div class="flex items-center justify-between mb-0.5">
          <span class="\${isToday?'bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold':'text-xs font-semibold '+((col===0)?'text-red-500':(col===6)?'text-blue-500':'text-gray-700')}">\${day}</span>
          \${shifts.length > 0 ? \`<span class="text-xs text-gray-300">\${shifts.length}</span>\` : ''}
        </div>
        \${shiftBadgesHtml(shifts, true)}
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

  let html = '<div class="p-3 max-w-screen-xl mx-auto space-y-3">';
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
          const shifts = map[ds] || [];
          return \`<td class="week-cell" onclick="openShiftForm('\${ds}')">\${shiftBadgesHtml(shifts, true)}</td>\`;
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
  if (State.shifts.length === 0) {
    return \`<div class="flex flex-col items-center justify-center h-64 text-center p-8">
      <div class="text-5xl mb-4">📅</div>
      <p class="text-gray-400 mb-4">この月のシフトはありません</p>
      <button onclick="openShiftForm()"
        class="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors">
        シフトを登録する
      </button>
    </div>\`;
  }

  // 日付グループ化
  const grp = {};
  State.shifts.forEach(s => { (grp[s.shift_date] = grp[s.shift_date] || []).push(s); });
  const todayStr = new Date().toISOString().split('T')[0];
  const dayNames = ['日','月','火','水','木','金','土'];

  let html = '<div class="max-w-screen-xl mx-auto p-4 space-y-5">';
  Object.keys(grp).sort().forEach(date => {
    const d = new Date(date + 'T12:00:00');
    const dn = dayNames[d.getDay()];
    const isToday = date === todayStr;
    const animalGrp = groupByAnimal(grp[date]);

    html += \`<div>
      <div class="flex items-center gap-2 mb-2">
        <h3 class="text-sm font-bold \${isToday?'text-blue-600':'text-gray-700'}">\${date.replace(/-/g,'/')}（\${dn}）</h3>
        \${isToday?'<span class="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">今日</span>':''}
        <span class="text-xs text-gray-400">\${grp[date].length}件</span>
      </div>\`;

    // 動物種別ごとにまとめて表示
    ['dog','cat','other'].forEach(type => {
      const arr = animalGrp[type];
      if (!arr || arr.length === 0) return;
      const at = ANIMAL_TYPES[type];
      html += \`<div class="mb-2">
        <div class="flex items-center gap-1 mb-1">
          <span class="text-base">\${at.emoji}</span>
          <span class="text-xs font-bold" style="color:\${at.color}">\${at.label.split(' ')[1]}</span>
          <span class="text-xs text-gray-400">(\${arr.length}名)</span>
        </div>
        <div class="space-y-1 pl-5">\`;

      arr.forEach(s => {
        const color = s.calendar_color || '#4f8ef7';
        const timeStr = s.start_time ? s.start_time.slice(0,5) + (s.end_time?' ～ '+s.end_time.slice(0,5):'') : '';
        const stMap = { pending:'未確認', approved:'承認済', rejected:'却下' };
        const stColor = { pending:'yellow', approved:'green', rejected:'red' };
        const safeS = encodeURIComponent(JSON.stringify(s));
        html += \`<div class="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow"
          style="border-left-color:\${color}"
          onclick="showDetail(decodeURIComponent('\${safeS}'))">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-gray-800 text-sm">\${s.user_name}</span>
              <span class="text-xs font-medium" style="color:\${color}">\${s.calendar_name}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-\${stColor[s.status]||'gray'}-100 text-\${stColor[s.status]||'gray'}-700">\${stMap[s.status]||s.status}</span>
            </div>
            \${timeStr?\`<div class="text-xs text-gray-500 mt-0.5"><i class="fas fa-clock mr-1"></i>\${timeStr}</div>\`:''}
            \${s.note?\`<div class="text-xs text-gray-400 truncate"><i class="fas fa-sticky-note mr-1"></i>\${s.note}</div>\`:''}
          </div>
          \${s.user_id === (State.user && State.user.id) ? \`
          <button onclick="event.stopPropagation();deleteShift(\${s.id})"
            class="text-red-300 hover:text-red-500 text-xs p-1 flex-shrink-0 transition-colors">
            <i class="fas fa-trash"></i>
          </button>\` : ''}
        </div>\`;
      });
      html += '</div></div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ============================================================
// シフト登録モーダル
// ============================================================
function openShiftForm(defaultDate = null) {
  const dateVal = defaultDate || new Date().toISOString().split('T')[0];
  const cal = State.calendars;
  const defaultCalId = State.currentCalendarSlug
    ? (cal.find(c => c.slug === State.currentCalendarSlug) || cal[0] || {}).id
    : (cal[0] || {}).id;

  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-calendar-plus text-blue-500 mr-2"></i>シフトを登録</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times"></i></button>
      </div>
      <div id="sf-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      <form id="sf-form" class="space-y-4">

        <!-- カレンダー選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">カレンダー <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-3 gap-2">
            \${cal.map(c => \`
            <label class="cursor-pointer">
              <input type="radio" name="cal_id" value="\${c.id}" class="sr-only" \${c.id===defaultCalId?'checked':''}>
              <div class="cal-opt border-2 rounded-xl p-2.5 text-center transition-all \${c.id===defaultCalId?'':'border-gray-200'}"
                style="\${c.id===defaultCalId?'border-color:'+c.color+';background:'+c.color+'14':''}">
                <div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:\${c.color}"></div>
                <div class="text-xs font-medium text-gray-700 leading-tight">\${c.name}</div>
              </div>
            </label>\`).join('')}
          </div>
        </div>

        <!-- 動物種別 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">担当動物 <span class="text-red-500">*</span></label>
          <div class="flex gap-2">
            \${Object.entries(ANIMAL_TYPES).map(([k,v]) => \`
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="animal_type" value="\${k}" class="sr-only" \${k==='dog'?'checked':''}>
              <div class="animal-btn \${k==='dog'?'selected-dog':''}" id="ab-\${k}">
                <div class="text-2xl">\${v.emoji}</div>
                <div class="text-xs font-semibold mt-1" style="color:\${v.color}">\${v.label.split(' ')[1]}</div>
              </div>
            </label>\`).join('')}
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

  // カレンダーオプションのクリック
  document.querySelectorAll('.cal-opt').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.cal-opt').forEach(o => {
        o.style.borderColor = ''; o.style.background = '';
        const rad = o.closest('label').querySelector('input');
        const c = State.calendars.find(c => c.id == rad.value);
        if (c) o.style.borderColor = '#e5e7eb';
      });
      const label = el.closest('label');
      const rad = label.querySelector('input');
      rad.checked = true;
      const c = State.calendars.find(c => c.id == rad.value);
      if (c) { el.style.borderColor = c.color; el.style.background = c.color + '14'; }
    });
  });

  // 動物種別ラジオクリック
  document.querySelectorAll('input[name="animal_type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      ['dog','cat','other'].forEach(k => {
        const ab = document.getElementById('ab-' + k);
        if (ab) { ab.className = 'animal-btn' + (radio.value === k ? ' selected-' + k : ''); }
      });
    });
  });

  // フォーム送信
  document.getElementById('sf-form').addEventListener('submit', async e => {
    e.preventDefault();
    const calId  = document.querySelector('input[name="cal_id"]:checked')?.value;
    const animal = document.querySelector('input[name="animal_type"]:checked')?.value || 'dog';
    const date   = document.getElementById('sf-date').value;
    const start  = document.getElementById('sf-start').value || null;
    const end    = document.getElementById('sf-end').value || null;
    const note   = document.getElementById('sf-note').value || null;

    if (!calId) { showSfError('カレンダーを選択してください'); return; }

    const btn = document.getElementById('sf-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner w-4 h-4"></div>';

    const r = await API.post('/shifts', { calendar_id: +calId, shift_date: date, start_time: start, end_time: end, note, animal_type: animal });
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
// シフト詳細モーダル
// ============================================================
function showDetail(shiftStr) {
  let s;
  try { s = typeof shiftStr === 'string' ? JSON.parse(shiftStr) : shiftStr; } catch { return; }

  const color = s.calendar_color || '#4f8ef7';
  const at = ANIMAL_TYPES[s.animal_type || 'other'];
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
          <span class="font-semibold text-gray-800">\${s.calendar_name}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xl">\${at.emoji}</span>
          <span class="font-semibold" style="color:\${at.color}">\${at.label}</span>
        </div>
        <div class="flex items-center gap-3 text-gray-600">
          <i class="fas fa-user w-5 text-center text-gray-400"></i><span>\${s.user_name}</span>
        </div>
        <div class="flex items-center gap-3 text-gray-600">
          <i class="fas fa-calendar w-5 text-center text-gray-400"></i><span>\${s.shift_date.replace(/-/g,'/')}</span>
        </div>
        <div class="flex items-center gap-3 text-gray-600">
          <i class="fas fa-clock w-5 text-center text-gray-400"></i><span>\${timeStr}</span>
        </div>
        \${s.note?\`<div class="flex items-start gap-3 text-gray-600"><i class="fas fa-sticky-note w-5 text-center text-gray-400 mt-0.5"></i><span>\${s.note}</span></div>\`:''}
        <div class="flex items-center gap-3">
          <i class="fas fa-info-circle w-5 text-center text-gray-400"></i>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-\${stColor[s.status]||'gray'}-100 text-\${stColor[s.status]||'gray'}-700">\${stMap[s.status]||s.status}</span>
        </div>
      </div>
      \${isOwner || isAdmin ? \`
      <div class="flex gap-2">
        <button onclick="openEditForm('\${safeS}')"
          class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-1">
          <i class="fas fa-edit"></i>\${isOwner?'編集':'管理者として編集'}
        </button>
        \${isOwner?\`<button onclick="deleteShift(\${s.id})"
          class="flex-1 border border-red-200 text-red-500 py-2 rounded-lg text-sm hover:bg-red-50 flex items-center justify-center gap-1">
          <i class="fas fa-trash"></i>削除
        </button>\`:''}
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

  document.getElementById('modal-root').innerHTML = \`
  <div class="modal-overlay" onclick="closeModalOuter(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-edit text-blue-500 mr-2"></i>シフトを編集</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 p-1"><i class="fas fa-times"></i></button>
      </div>
      <div id="ef-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>

      <!-- 動物種別変更 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">担当動物</label>
        <div class="flex gap-2">
          \${Object.entries(ANIMAL_TYPES).map(([k,v]) => \`
          <label class="flex-1 cursor-pointer">
            <input type="radio" name="edit_animal" value="\${k}" class="sr-only" \${(s.animal_type||'other')===k?'checked':''}>
            <div class="animal-btn \${(s.animal_type||'other')===k?'selected-'+k:''}" id="eab-\${k}">
              <div class="text-2xl">\${v.emoji}</div>
              <div class="text-xs font-semibold mt-1" style="color:\${v.color}">\${v.label.split(' ')[1]}</div>
            </div>
          </label>\`).join('')}
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
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none">\${s.note||''}</textarea>
        </div>
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

  // 動物種別ラジオ
  document.querySelectorAll('input[name="edit_animal"]').forEach(radio => {
    radio.addEventListener('change', () => {
      ['dog','cat','other'].forEach(k => {
        const ab = document.getElementById('eab-'+k);
        if (ab) ab.className = 'animal-btn' + (radio.value===k ? ' selected-'+k : '');
      });
    });
  });

  document.getElementById('ef-form').addEventListener('submit', async e => {
    e.preventDefault();
    const animalType = document.querySelector('input[name="edit_animal"]:checked')?.value || s.animal_type || 'other';
    const start = document.getElementById('ef-start').value || null;
    const end   = document.getElementById('ef-end').value || null;
    const note  = document.getElementById('ef-note').value || null;

    const btn = document.getElementById('ef-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner w-4 h-4"></div>';

    const r = await API.put('/shifts/' + s.id, { start_time: start, end_time: end, note, animal_type: animalType });
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
// ナビ操作（月切り替え・表示モード・カレンダー選択）
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

// ナビUI更新（カレンダー全体を再描画しない）
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
      <span class="ml-0.5">\${c.name}</span></button>\`;
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
// モーダル
// ============================================================
function closeModalOuter(e) { if (e.target === e.currentTarget) closeModal(); }
function closeModal() { const el = document.getElementById('modal-root'); if (el) el.innerHTML = ''; }

// ============================================================
// 認証イベント
// ============================================================
function bindLoginEvents() {
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

function bindRegisterEvents() {
  document.getElementById('reg-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pw   = document.getElementById('reg-password').value;
    const pw2  = document.getElementById('reg-pw2').value;
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
