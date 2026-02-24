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

// ミドルウェア
app.use('*', logger())
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// APIルート
app.route('/api/auth', authRoutes)
app.route('/api/shifts', shiftsRoutes)
app.route('/api/calendars', calendarsRoutes)
app.route('/api/users', usersRoutes)

// ヘルスチェック
app.get('/api/health', (c) => c.json({ status: 'ok', app: 'CAPINカレンダー' }))

// 静的ファイル（/static/*）
app.use('/static/*', serveStatic({ root: './' }))

// メインHTML（全ルートをSPAに）
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
    :root {
      --shelter1: #4f8ef7;
      --shelter2: #22c55e;
      --hospital: #f97316;
    }
    * { box-sizing: border-box; }
    body { font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', sans-serif; }
    
    /* カレンダーセルのスタイル */
    .calendar-cell {
      min-height: 90px;
      vertical-align: top;
      border: 1px solid #e5e7eb;
      padding: 4px;
      position: relative;
    }
    .calendar-cell.today { background: #fffbeb; }
    .calendar-cell.other-month { background: #f9fafb; opacity: 0.7; }
    
    /* シフトバッジ */
    .shift-badge {
      display: block;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 9999px;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .shift-badge:hover { opacity: 0.8; }
    
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
      border-radius: 12px;
      max-width: 480px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    
    /* タブ切り替え */
    .tab-btn { transition: all 0.2s; }
    .tab-btn.active {
      background: #4f8ef7;
      color: white;
    }
    
    /* スクロールバー */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    
    /* リスト表示モード */
    .list-shift-item {
      border-left: 4px solid var(--color);
      padding: 8px 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 0 8px 8px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    /* 週表示モード */
    .week-cell {
      min-height: 60px;
      border: 1px solid #e5e7eb;
      padding: 4px;
      vertical-align: top;
    }
    
    /* アニメーション */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-in { animation: fadeIn 0.2s ease-out; }
    
    /* レスポンシブ */
    @media (max-width: 640px) {
      .calendar-cell { min-height: 60px; padding: 2px; }
      .shift-badge { font-size: 9px; padding: 1px 4px; }
    }
    
    /* ローディング */
    .spinner {
      border: 3px solid #f3f4f6;
      border-top-color: #4f8ef7;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* トースト通知 */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      min-width: 200px;
      max-width: 360px;
    }
    .toast-item {
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadeIn 0.2s ease-out;
    }
    .toast-success { background: #22c55e; color: white; }
    .toast-error { background: #ef4444; color: white; }
    .toast-info { background: #4f8ef7; color: white; }
    
    /* ヘッダー */
    .paw-icon { display: inline-block; animation: bounce 2s infinite; }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    /* カレンダーナビゲーション */
    .nav-btn {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .nav-btn:hover { background: #f1f5f9; }

    /* 表示モードボタン */
    .view-btn {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      border: 1px solid #e5e7eb;
      transition: all 0.15s;
      background: white;
    }
    .view-btn.active {
      background: #1e40af;
      color: white;
      border-color: #1e40af;
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

<!-- トースト通知コンテナ -->
<div id="toast"></div>

<!-- アプリケーション本体 -->
<div id="app">
  <!-- ローディング -->
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <div class="text-5xl mb-4">🐾</div>
      <div class="spinner mx-auto"></div>
      <p class="text-gray-500 mt-3 text-sm">読み込み中...</p>
    </div>
  </div>
</div>

<script>
// ==========================================
// CAPINカレンダー フロントエンドアプリケーション
// ==========================================

const API = {
  base: '/api',
  
  getToken() {
    return localStorage.getItem('capin_token');
  },
  
  setToken(token) {
    localStorage.setItem('capin_token', token);
  },
  
  removeToken() {
    localStorage.removeItem('capin_token');
    localStorage.removeItem('capin_user');
  },
  
  getUser() {
    const u = localStorage.getItem('capin_user');
    return u ? JSON.parse(u) : null;
  },
  
  setUser(user) {
    localStorage.setItem('capin_user', JSON.stringify(user));
  },
  
  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    
    const res = await fetch(this.base + path, opts);
    const data = await res.json();
    
    if (res.status === 401) {
      this.removeToken();
      App.showLogin();
    }
    
    return { ok: res.ok, status: res.status, data };
  },
  
  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body),
  put: (path, body) => API.request('PUT', path, body),
  delete: (path) => API.request('DELETE', path),
};

// ==========================================
// トースト通知
// ==========================================
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast');
  const div = document.createElement('div');
  div.className = 'toast-item toast-' + type;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transition = 'opacity 0.3s';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

// ==========================================
// アプリケーション状態管理
// ==========================================
const State = {
  user: null,
  calendars: [],
  shifts: [],
  currentCalendarSlug: null, // null = 全カレンダー
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  viewMode: 'month', // 'month', 'week', 'list'
  loading: false,
};

// ==========================================
// メインアプリ
// ==========================================
const App = {
  
  async init() {
    State.user = API.getUser();
    const token = API.getToken();
    
    if (!token || !State.user) {
      this.showLogin();
      return;
    }
    
    // トークン確認
    const res = await API.get('/auth/me');
    if (!res.ok) {
      this.showLogin();
      return;
    }
    
    State.user = res.data.user;
    API.setUser(State.user);
    
    await this.loadCalendars();
    this.showCalendar();
  },
  
  async loadCalendars() {
    const res = await API.get('/calendars');
    if (res.ok) {
      State.calendars = res.data.calendars;
    }
  },
  
  showLogin() {
    document.getElementById('app').innerHTML = renderLogin();
    bindLoginEvents();
  },
  
  showRegister() {
    document.getElementById('app').innerHTML = renderRegister();
    bindRegisterEvents();
  },
  
  showCalendar() {
    document.getElementById('app').innerHTML = renderCalendarApp();
    bindCalendarEvents();
    this.loadAndRenderShifts();
  },
  
  async loadAndRenderShifts() {
    State.loading = true;
    renderCalendarContent();
    
    let path = '/shifts?year=' + State.currentYear + '&month=' + State.currentMonth;
    if (State.currentCalendarSlug) {
      path += '&calendar=' + State.currentCalendarSlug;
    }
    
    const res = await API.get(path);
    if (res.ok) {
      State.shifts = res.data.shifts;
    }
    
    State.loading = false;
    renderCalendarContent();
  },
  
  async logout() {
    API.removeToken();
    State.user = null;
    State.shifts = [];
    showToast('ログアウトしました', 'info');
    this.showLogin();
  }
};

// ==========================================
// ログイン画面
// ==========================================
function renderLogin() {
  return \`
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- ロゴ -->
      <div class="text-center mb-8">
        <div class="text-6xl mb-3 paw-icon">🐾</div>
        <h1 class="text-3xl font-bold text-gray-800">CAPINカレンダー</h1>
        <p class="text-gray-500 mt-1 text-sm">動物保護団体ボランティアシフト管理</p>
      </div>
      
      <!-- ログインフォーム -->
      <div class="bg-white rounded-2xl shadow-lg p-8 fade-in">
        <h2 class="text-xl font-semibold text-gray-700 mb-6">ログイン</h2>
        
        <div id="login-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
        
        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input type="email" id="login-email" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="your@email.com">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <div class="relative">
              <input type="password" id="login-password" required
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                placeholder="パスワードを入力">
              <button type="button" onclick="togglePasswordVisibility('login-password', this)"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <i class="fas fa-eye text-sm"></i>
              </button>
            </div>
          </div>
          
          <button type="submit" id="login-btn"
            class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-sign-in-alt"></i>
            ログイン
          </button>
        </form>
        
        <div class="mt-4 pt-4 border-t border-gray-100 text-center space-y-2">
          <button onclick="App.showRegister()"
            class="text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors">
            <i class="fas fa-user-plus mr-1"></i>
            新規アカウントを作成する
          </button>
          <br>
          <button onclick="showForgotPassword()"
            class="text-gray-400 hover:text-gray-600 text-xs transition-colors">
            <i class="fas fa-key mr-1"></i>
            パスワードをお忘れの方
          </button>
        </div>
      </div>
      
      <p class="text-center text-xs text-gray-400 mt-6">
        🐾 CAPIN（キャピン）動物保護団体
      </p>
    </div>
  </div>
  \`;
}

function renderRegister() {
  return \`
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="text-6xl mb-3">🐾</div>
        <h1 class="text-3xl font-bold text-gray-800">CAPINカレンダー</h1>
        <p class="text-gray-500 mt-1 text-sm">動物保護団体ボランティアシフト管理</p>
      </div>
      
      <div class="bg-white rounded-2xl shadow-lg p-8 fade-in">
        <h2 class="text-xl font-semibold text-gray-700 mb-6">新規アカウント作成</h2>
        
        <div id="register-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
        <div id="register-success" class="hidden bg-green-50 border border-green-200 text-green-600 rounded-lg p-3 mb-4 text-sm"></div>
        
        <form id="register-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">お名前（ユーザー名）</label>
            <input type="text" id="reg-name" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="山田 花子">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input type="email" id="reg-email" required
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="your@email.com">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">パスワード <span class="text-gray-400 text-xs">(8文字以上)</span></label>
            <div class="relative">
              <input type="password" id="reg-password" required minlength="8"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                placeholder="パスワード（8文字以上）">
              <button type="button" onclick="togglePasswordVisibility('reg-password', this)"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <i class="fas fa-eye text-sm"></i>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input type="password" id="reg-password2" required minlength="8"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="パスワードを再入力">
          </div>
          
          <button type="submit" id="register-btn"
            class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-user-plus"></i>
            アカウントを作成する
          </button>
        </form>
        
        <div class="mt-4 pt-4 border-t border-gray-100 text-center">
          <button onclick="App.showLogin()"
            class="text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors">
            <i class="fas fa-arrow-left mr-1"></i>
            ログイン画面に戻る
          </button>
        </div>
      </div>
    </div>
  </div>
  \`;
}

// ==========================================
// カレンダーアプリ本体
// ==========================================
function renderCalendarApp() {
  const cal = State.calendars;
  
  return \`
  <div class="flex flex-col h-screen">
    <!-- ヘッダー -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="text-3xl paw-icon">🐾</span>
          <div>
            <h1 class="text-lg font-bold text-gray-800 leading-tight">CAPINカレンダー</h1>
            <p class="text-xs text-gray-400 leading-tight hidden sm:block">ボランティアシフト管理</p>
          </div>
        </div>
        
        <!-- カレンダー選択タブ -->
        <div class="flex items-center gap-1 flex-1 justify-center overflow-x-auto px-2">
          <button onclick="selectCalendar(null)"
            class="tab-btn px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 whitespace-nowrap \${State.currentCalendarSlug === null ? 'active' : 'bg-white text-gray-600 hover:bg-gray-50'}"
            >
            <i class="fas fa-layer-group mr-1"></i>全て
          </button>
          \${cal.map(c => \`
          <button onclick="selectCalendar('\${c.slug}')"
            class="tab-btn px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 whitespace-nowrap"
            style="\${State.currentCalendarSlug === c.slug ? 'background:' + c.color + ';color:white;border-color:' + c.color : 'background:white;color:#4b5563'}"
            >
            <span style="color:\${State.currentCalendarSlug === c.slug ? 'white' : c.color}">●</span>
            <span class="ml-1">\${c.name}</span>
          </button>
          \`).join('')}
        </div>
        
        <!-- ユーザーメニュー -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 hidden sm:block">
            <i class="fas fa-user mr-1"></i>\${State.user.name}
          </span>
          <button onclick="openShiftForm()"
            class="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
            <i class="fas fa-plus"></i>
            <span class="hidden sm:inline">シフト登録</span>
          </button>
          <button onclick="App.logout()"
            class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors" title="ログアウト">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </header>
    
    <!-- ナビゲーション・表示モード切り替え -->
    <div class="bg-white border-b border-gray-100 px-4 py-2">
      <div class="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
        <!-- 月ナビゲーション -->
        <div class="flex items-center gap-2">
          <button onclick="changeMonth(-1)" class="nav-btn">
            <i class="fas fa-chevron-left text-sm text-gray-600"></i>
          </button>
          <span class="text-base font-semibold text-gray-800 min-w-[120px] text-center">
            \${State.currentYear}年\${State.currentMonth}月
          </span>
          <button onclick="changeMonth(1)" class="nav-btn">
            <i class="fas fa-chevron-right text-sm text-gray-600"></i>
          </button>
          <button onclick="goToToday()" class="nav-btn text-xs text-gray-600">今日</button>
        </div>
        
        <!-- 表示モード切り替え -->
        <div class="flex items-center gap-1">
          <button onclick="setViewMode('month')" class="view-btn \${State.viewMode === 'month' ? 'active' : ''}">
            <i class="fas fa-th mr-1"></i>月
          </button>
          <button onclick="setViewMode('week')" class="view-btn \${State.viewMode === 'week' ? 'active' : ''}">
            <i class="fas fa-calendar-week mr-1"></i>週
          </button>
          <button onclick="setViewMode('list')" class="view-btn \${State.viewMode === 'list' ? 'active' : ''}">
            <i class="fas fa-list mr-1"></i>一覧
          </button>
        </div>
      </div>
    </div>
    
    <!-- カレンダーコンテンツ -->
    <div id="calendar-content" class="flex-1 overflow-auto">
      <div class="flex items-center justify-center h-32">
        <div class="spinner"></div>
      </div>
    </div>
  </div>
  
  <!-- モーダルコンテナ -->
  <div id="modal-container"></div>
  \`;
}

// ==========================================
// カレンダーコンテンツレンダリング
// ==========================================
function renderCalendarContent() {
  const container = document.getElementById('calendar-content');
  if (!container) return;
  
  if (State.loading) {
    container.innerHTML = \`
      <div class="flex items-center justify-center h-32">
        <div class="spinner"></div>
      </div>
    \`;
    return;
  }
  
  if (State.viewMode === 'month') {
    container.innerHTML = renderMonthView();
  } else if (State.viewMode === 'week') {
    container.innerHTML = renderWeekView();
  } else {
    container.innerHTML = renderListView();
  }
}

// ==========================================
// 月表示
// ==========================================
function renderMonthView() {
  const year = State.currentYear;
  const month = State.currentMonth;
  
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const today = new Date();
  
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  
  // 日付ごとのシフトマップ
  const shiftMap = {};
  State.shifts.forEach(s => {
    if (!shiftMap[s.shift_date]) shiftMap[s.shift_date] = [];
    shiftMap[s.shift_date].push(s);
  });
  
  let html = \`
  <div class="max-w-screen-xl mx-auto p-3">
    <table class="w-full border-collapse">
      <thead>
        <tr>
          \${days.map((d, i) => \`
          <th class="p-2 text-xs font-semibold \${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'} text-center">
            \${d}
          </th>
          \`).join('')}
        </tr>
      </thead>
      <tbody>
  \`;
  
  let dayCount = 1;
  const rows = Math.ceil((firstDay + lastDate) / 7);
  
  for (let row = 0; row < rows; row++) {
    html += '<tr>';
    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      const day = cellIndex - firstDay + 1;
      
      if (day < 1 || day > lastDate) {
        html += '<td class="calendar-cell other-month"></td>';
        continue;
      }
      
      const dateStr = \`\${year}-\${String(month).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
      const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
      const shifts = shiftMap[dateStr] || [];
      
      html += \`<td class="calendar-cell \${isToday ? 'today' : ''}" onclick="openShiftForm('\${dateStr}')">\`;
      
      // 日付番号
      html += \`<div class="flex items-center justify-between mb-1">
        <span class="text-xs font-semibold \${col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : 'text-gray-700'} \${isToday ? 'bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs' : ''}">
          \${day}
        </span>
        <span class="text-xs text-gray-300">\${shifts.length > 0 ? shifts.length + '件' : ''}</span>
      </div>\`;
      
      // シフト表示
      const maxDisplay = 3;
      shifts.slice(0, maxDisplay).forEach(s => {
        const color = s.calendar_color || '#4f8ef7';
        const timeStr = s.start_time ? s.start_time.substring(0, 5) : '';
        const label = timeStr ? \`\${timeStr} \${s.user_name}\` : s.user_name;
        html += \`<span class="shift-badge" 
          style="background:\${color}22;color:\${color};border:1px solid \${color}44"
          onclick="event.stopPropagation();showShiftDetail(\${JSON.stringify(s).replace(/"/g, '&quot;')})"
          title="\${s.user_name} \${timeStr ? '(' + timeStr + (s.end_time ? '-' + s.end_time.substring(0,5) : '') + ')' : ''}"
          >\${label}</span>\`;
      });
      
      if (shifts.length > maxDisplay) {
        html += \`<span class="text-xs text-gray-400">+\${shifts.length - maxDisplay}件</span>\`;
      }
      
      html += '</td>';
    }
    html += '</tr>';
  }
  
  html += '</tbody></table></div>';
  return html;
}

// ==========================================
// 週表示
// ==========================================
function renderWeekView() {
  const year = State.currentYear;
  const month = State.currentMonth;
  
  // 今月の全週を計算
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  // 週ごとのグループ
  const weeks = [];
  let currentWeek = [];
  
  // 月初の曜日まで埋める
  for (let i = 0; i < firstDay.getDay(); i++) {
    const d = new Date(year, month - 1, 1 - firstDay.getDay() + i);
    currentWeek.push({ date: d, otherMonth: true });
  }
  
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month - 1, d);
    currentWeek.push({ date, otherMonth: false });
    if (date.getDay() === 6 || d === lastDay.getDate()) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const today = new Date();
  
  // シフトマップ
  const shiftMap = {};
  State.shifts.forEach(s => {
    if (!shiftMap[s.shift_date]) shiftMap[s.shift_date] = [];
    shiftMap[s.shift_date].push(s);
  });
  
  let html = '<div class="max-w-screen-xl mx-auto p-3 space-y-4">';
  
  weeks.forEach((week, wi) => {
    html += \`
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      <div class="bg-gray-50 px-4 py-2 border-b border-gray-100">
        <span class="text-xs font-semibold text-gray-500">第\${wi + 1}週</span>
      </div>
      <table class="w-full">
        <thead>
          <tr>
            \${week.map((cell, ci) => {
              const isToday = cell.date.toDateString() === today.toDateString();
              return \`<th class="week-cell text-center \${ci === 0 ? 'text-red-500' : ci === 6 ? 'text-blue-500' : 'text-gray-600'}">
                <div class="text-xs font-medium">\${days[cell.date.getDay()]}</div>
                <div class="text-sm font-bold \${isToday ? 'bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' : ''}">\${cell.otherMonth ? '' : cell.date.getDate()}</div>
              </th>\`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            \${week.map(cell => {
              if (cell.otherMonth) return '<td class="week-cell bg-gray-50"></td>';
              const dateStr = cell.date.toISOString().split('T')[0];
              const shifts = shiftMap[dateStr] || [];
              return \`<td class="week-cell" onclick="openShiftForm('\${dateStr}')">
                \${shifts.map(s => {
                  const color = s.calendar_color || '#4f8ef7';
                  const timeStr = s.start_time ? s.start_time.substring(0,5) : '';
                  return \`<span class="shift-badge" 
                    style="background:\${color}22;color:\${color};border:1px solid \${color}44"
                    onclick="event.stopPropagation();showShiftDetail(\${JSON.stringify(s).replace(/"/g, '&quot;')})"
                    >\${timeStr ? timeStr + ' ' : ''}\${s.user_name}</span>\`;
                }).join('')}
              </td>\`;
            }).join('')}
          </tr>
        </tbody>
      </table>
    </div>
    \`;
  });
  
  html += '</div>';
  return html;
}

// ==========================================
// 一覧表示
// ==========================================
function renderListView() {
  if (State.shifts.length === 0) {
    return \`
    <div class="max-w-screen-xl mx-auto p-8 text-center">
      <div class="text-5xl mb-4">📅</div>
      <p class="text-gray-400">この月のシフトはありません</p>
      <button onclick="openShiftForm()"
        class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors">
        シフトを登録する
      </button>
    </div>
    \`;
  }
  
  // 日付でグループ化
  const grouped = {};
  State.shifts.forEach(s => {
    if (!grouped[s.shift_date]) grouped[s.shift_date] = [];
    grouped[s.shift_date].push(s);
  });
  
  const sortedDates = Object.keys(grouped).sort();
  const today = new Date().toISOString().split('T')[0];
  
  let html = '<div class="max-w-screen-xl mx-auto p-4 space-y-4">';
  
  sortedDates.forEach(date => {
    const d = new Date(date + 'T00:00:00');
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = dayNames[d.getDay()];
    const isToday = date === today;
    
    html += \`
    <div>
      <div class="flex items-center gap-2 mb-2">
        <h3 class="text-sm font-bold text-gray-700 \${isToday ? 'text-blue-600' : ''}">
          \${date.replace(/-/g, '/')} (\${dayName})
          \${isToday ? '<span class="ml-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">今日</span>' : ''}
        </h3>
        <span class="text-xs text-gray-400">\${grouped[date].length}件</span>
      </div>
      <div class="space-y-1.5">
    \`;
    
    grouped[date].forEach(s => {
      const color = s.calendar_color || '#4f8ef7';
      const timeStr = s.start_time
        ? s.start_time.substring(0,5) + (s.end_time ? ' ～ ' + s.end_time.substring(0,5) : '')
        : '';
      const statusBadge = {
        pending: '<span class="bg-yellow-100 text-yellow-600 text-xs px-1.5 py-0.5 rounded">未確認</span>',
        approved: '<span class="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded">承認済</span>',
        rejected: '<span class="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded">却下</span>'
      }[s.status] || '';
      
      html += \`
      <div class="list-shift-item cursor-pointer hover:shadow-md transition-shadow"
        style="--color:\${color};border-left-color:\${color}"
        onclick="showShiftDetail(\${JSON.stringify(s).replace(/"/g, '&quot;')})">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-gray-800 text-sm">\${s.user_name}</span>
              <span class="text-xs font-medium" style="color:\${color}">\${s.calendar_name}</span>
              \${statusBadge}
            </div>
            \${timeStr ? \`<div class="text-xs text-gray-500 mt-0.5"><i class="fas fa-clock mr-1"></i>\${timeStr}</div>\` : ''}
            \${s.note ? \`<div class="text-xs text-gray-400 mt-0.5 truncate"><i class="fas fa-sticky-note mr-1"></i>\${s.note}</div>\` : ''}
          </div>
          \${s.user_id === State.user.id ? \`
          <button onclick="event.stopPropagation();deleteShift(\${s.id})"
            class="text-red-400 hover:text-red-600 text-xs p-1 flex-shrink-0">
            <i class="fas fa-trash"></i>
          </button>
          \` : ''}
        </div>
      </div>
      \`;
    });
    
    html += '</div></div>';
  });
  
  html += '</div>';
  return html;
}

// ==========================================
// シフト登録フォームモーダル
// ==========================================
function openShiftForm(defaultDate = null) {
  const today = defaultDate || new Date().toISOString().split('T')[0];
  const cal = State.calendars;
  
  // デフォルトカレンダー設定
  const defaultCalId = State.currentCalendarSlug
    ? cal.find(c => c.slug === State.currentCalendarSlug)?.id
    : cal[0]?.id;
  
  const modal = document.getElementById('modal-container');
  modal.innerHTML = \`
  <div class="modal-overlay" onclick="closeModal(event)">
    <div class="modal-content fade-in" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800">
          <i class="fas fa-calendar-plus text-blue-500 mr-2"></i>
          シフトを登録
        </h3>
        <button onclick="closeModalForce()" class="text-gray-400 hover:text-gray-600 p-1">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div id="shift-form-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      
      <form id="shift-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">カレンダー <span class="text-red-500">*</span></label>
          <div class="grid grid-cols-3 gap-2">
            \${cal.map(c => \`
            <label class="relative cursor-pointer">
              <input type="radio" name="calendar_id" value="\${c.id}" class="sr-only"
                \${c.id === defaultCalId ? 'checked' : ''}>
              <div class="cal-option border-2 rounded-lg p-2 text-center transition-all"
                style="\${c.id === defaultCalId ? 'border-color:' + c.color + ';background:' + c.color + '11' : 'border-color:#e5e7eb'}"
                onclick="selectCalendarOption(this, '\${c.color}')">
                <div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:\${c.color}"></div>
                <div class="text-xs font-medium text-gray-700">\${c.name}</div>
              </div>
            </label>
            \`).join('')}
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">日付 <span class="text-red-500">*</span></label>
          <input type="date" id="shift-date" value="\${today}" required
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        </div>
        
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
            <input type="time" id="shift-start"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
            <input type="time" id="shift-end"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea id="shift-note" rows="2"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            placeholder="備考・メモ（任意）"></textarea>
        </div>
        
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModalForce()"
            class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            キャンセル
          </button>
          <button type="submit" id="shift-submit-btn"
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            <i class="fas fa-check"></i>
            登録する
          </button>
        </div>
      </form>
    </div>
  </div>
  \`;
  
  bindShiftFormEvents();
}

function selectCalendarOption(el, color) {
  // 全オプションをリセット
  document.querySelectorAll('.cal-option').forEach(o => {
    o.style.borderColor = '#e5e7eb';
    o.style.background = '';
  });
  // 選択されたオプションをハイライト
  el.style.borderColor = color;
  el.style.background = color + '11';
}

function bindShiftFormEvents() {
  const form = document.getElementById('shift-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const calendarId = document.querySelector('input[name="calendar_id"]:checked')?.value;
    const shiftDate = document.getElementById('shift-date').value;
    const startTime = document.getElementById('shift-start').value || null;
    const endTime = document.getElementById('shift-end').value || null;
    const note = document.getElementById('shift-note').value || null;
    
    if (!calendarId) {
      document.getElementById('shift-form-error').textContent = 'カレンダーを選択してください';
      document.getElementById('shift-form-error').classList.remove('hidden');
      return;
    }
    
    const btn = document.getElementById('shift-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner w-4 h-4"></div>';
    
    const res = await API.post('/shifts', {
      calendar_id: parseInt(calendarId),
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      note
    });
    
    if (res.ok) {
      closeModalForce();
      showToast('シフトを登録しました', 'success');
      await App.loadAndRenderShifts();
    } else {
      const errEl = document.getElementById('shift-form-error');
      errEl.textContent = res.data.error || '登録に失敗しました';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> 登録する';
    }
  });
}

// ==========================================
// シフト詳細モーダル
// ==========================================
function showShiftDetail(shift) {
  if (typeof shift === 'string') {
    try { shift = JSON.parse(shift); } catch(e) { return; }
  }
  
  const color = shift.calendar_color || '#4f8ef7';
  const isOwner = shift.user_id === State.user.id;
  const isAdmin = State.user.role === 'admin';
  
  const timeStr = shift.start_time
    ? shift.start_time.substring(0,5) + (shift.end_time ? ' ～ ' + shift.end_time.substring(0,5) : '')
    : '時刻未設定';
  
  const statusText = { pending: '未確認', approved: '承認済', rejected: '却下' }[shift.status] || shift.status;
  const statusColor = { pending: 'yellow', approved: 'green', rejected: 'red' }[shift.status] || 'gray';
  
  const modal = document.getElementById('modal-container');
  modal.innerHTML = \`
  <div class="modal-overlay" onclick="closeModal(event)">
    <div class="modal-content fade-in" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-800">
          <i class="fas fa-calendar-check mr-2" style="color:\${color}"></i>
          シフト詳細
        </h3>
        <button onclick="closeModalForce()" class="text-gray-400 hover:text-gray-600 p-1">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="space-y-3">
        <div class="bg-gray-50 rounded-xl p-4 space-y-2">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full flex-shrink-0" style="background:\${color}"></span>
            <span class="font-semibold text-gray-800">\${shift.calendar_name}</span>
          </div>
          <div class="flex items-center gap-2 text-gray-600">
            <i class="fas fa-user w-5 text-center text-gray-400"></i>
            <span>\${shift.user_name}</span>
          </div>
          <div class="flex items-center gap-2 text-gray-600">
            <i class="fas fa-calendar w-5 text-center text-gray-400"></i>
            <span>\${shift.shift_date.replace(/-/g, '/')}</span>
          </div>
          <div class="flex items-center gap-2 text-gray-600">
            <i class="fas fa-clock w-5 text-center text-gray-400"></i>
            <span>\${timeStr}</span>
          </div>
          \${shift.note ? \`
          <div class="flex items-start gap-2 text-gray-600">
            <i class="fas fa-sticky-note w-5 text-center text-gray-400 mt-0.5"></i>
            <span>\${shift.note}</span>
          </div>
          \` : ''}
          <div class="flex items-center gap-2">
            <i class="fas fa-info-circle w-5 text-center text-gray-400"></i>
            <span class="bg-\${statusColor}-100 text-\${statusColor}-700 text-xs px-2 py-0.5 rounded-full font-medium">\${statusText}</span>
          </div>
        </div>
        
        \${isOwner || isAdmin ? \`
        <div class="flex gap-2">
          \${isOwner ? \`
          <button onclick="openEditShiftForm(\${shift.id}, '\${shift.shift_date}', '\${shift.start_time || ''}', '\${shift.end_time || ''}', '\${(shift.note || '').replace(/'/g, "\\\\'")}', \${shift.calendar_id})"
            class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
            <i class="fas fa-edit"></i> 編集
          </button>
          <button onclick="deleteShift(\${shift.id})"
            class="flex-1 border border-red-200 text-red-500 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1">
            <i class="fas fa-trash"></i> 削除
          </button>
          \` : ''}
          \${isAdmin && !isOwner ? \`
          <button onclick="openEditShiftForm(\${shift.id}, '\${shift.shift_date}', '\${shift.start_time || ''}', '\${shift.end_time || ''}', '\${(shift.note || '').replace(/'/g, "\\\\'")}', \${shift.calendar_id})"
            class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
            <i class="fas fa-edit"></i> 管理者として編集
          </button>
          \` : ''}
        </div>
        \` : ''}
      </div>
    </div>
  </div>
  \`;
}

// ==========================================
// シフト編集フォーム
// ==========================================
function openEditShiftForm(id, date, startTime, endTime, note, calendarId) {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = \`
  <div class="modal-overlay" onclick="closeModal(event)">
    <div class="modal-content fade-in" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-800">
          <i class="fas fa-edit text-blue-500 mr-2"></i>
          シフトを編集
        </h3>
        <button onclick="closeModalForce()" class="text-gray-400 hover:text-gray-600 p-1">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div id="edit-form-error" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
      
      <form id="edit-shift-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">日付</label>
          <div class="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5">\${date.replace(/-/g, '/')}</div>
        </div>
        
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
            <input type="time" id="edit-start" value="\${startTime}"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
            <input type="time" id="edit-end" value="\${endTime}"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea id="edit-note" rows="2"
            class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            >\${note}</textarea>
        </div>
        
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModalForce()"
            class="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            キャンセル
          </button>
          <button type="submit" id="edit-submit-btn"
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            <i class="fas fa-save"></i>
            保存する
          </button>
        </div>
      </form>
    </div>
  </div>
  \`;
  
  document.getElementById('edit-shift-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const startTime = document.getElementById('edit-start').value || null;
    const endTime = document.getElementById('edit-end').value || null;
    const noteVal = document.getElementById('edit-note').value || null;
    
    const btn = document.getElementById('edit-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner w-4 h-4"></div>';
    
    const res = await API.put('/shifts/' + id, {
      start_time: startTime,
      end_time: endTime,
      note: noteVal
    });
    
    if (res.ok) {
      closeModalForce();
      showToast('シフトを更新しました', 'success');
      await App.loadAndRenderShifts();
    } else {
      const errEl = document.getElementById('edit-form-error');
      errEl.textContent = res.data.error || '更新に失敗しました';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> 保存する';
    }
  });
}

// ==========================================
// シフト削除
// ==========================================
async function deleteShift(id) {
  if (!confirm('このシフトを削除しますか？')) return;
  
  const res = await API.delete('/shifts/' + id);
  if (res.ok) {
    closeModalForce();
    showToast('シフトを削除しました', 'success');
    await App.loadAndRenderShifts();
  } else {
    showToast(res.data.error || '削除に失敗しました', 'error');
  }
}

// ==========================================
// ユーティリティ
// ==========================================
function closeModal(e) {
  if (e.target === e.currentTarget) closeModalForce();
}

function closeModalForce() {
  const modal = document.getElementById('modal-container');
  if (modal) modal.innerHTML = '';
}

function selectCalendar(slug) {
  State.currentCalendarSlug = slug;
  App.showCalendar();
}

function changeMonth(delta) {
  State.currentMonth += delta;
  if (State.currentMonth > 12) { State.currentMonth = 1; State.currentYear++; }
  if (State.currentMonth < 1) { State.currentMonth = 12; State.currentYear--; }
  App.loadAndRenderShifts();
}

function goToToday() {
  const now = new Date();
  State.currentYear = now.getFullYear();
  State.currentMonth = now.getMonth() + 1;
  App.loadAndRenderShifts();
}

function setViewMode(mode) {
  State.viewMode = mode;
  
  // ボタンのアクティブ状態更新
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // モード別ボタンをアクティブに
  const modeMap = { month: 0, week: 1, list: 2 };
  const btns = document.querySelectorAll('.view-btn');
  if (btns[modeMap[mode]]) btns[modeMap[mode]].classList.add('active');
  
  renderCalendarContent();
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fas fa-eye-slash text-sm"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fas fa-eye text-sm"></i>';
  }
}

function showForgotPassword() {
  const modal = document.getElementById('modal-container') || document.createElement('div');
  if (!modal.id) {
    modal.id = 'modal-container-temp';
    document.body.appendChild(modal);
  }
  
  // ログイン画面ではモーダルがないのでアラート
  if (confirm('パスワードをお忘れですか？\\n\\n新しいアカウントを作成することができます。\\n\\n「OK」を押すと新規登録画面に移動します。')) {
    App.showRegister();
  }
}

// ==========================================
// イベントバインディング
// ==========================================
function bindLoginEvents() {
  const form = document.getElementById('login-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner w-5 h-5"></div>';
    errEl.classList.add('hidden');
    
    const res = await API.post('/auth/login', { email, password });
    
    if (res.ok) {
      API.setToken(res.data.token);
      API.setUser(res.data.user);
      State.user = res.data.user;
      showToast('ログインしました！ようこそ ' + res.data.user.name + 'さん', 'success');
      await App.loadCalendars();
      App.showCalendar();
    } else {
      errEl.textContent = res.data.error || 'ログインに失敗しました';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ログイン';
    }
  });
}

function bindRegisterEvents() {
  const form = document.getElementById('register-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    
    errEl.classList.add('hidden');
    successEl.classList.add('hidden');
    
    if (password !== password2) {
      errEl.textContent = 'パスワードが一致しません';
      errEl.classList.remove('hidden');
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner w-5 h-5"></div>';
    
    const res = await API.post('/auth/register', { name, email, password });
    
    if (res.ok) {
      API.setToken(res.data.token);
      API.setUser(res.data.user);
      State.user = res.data.user;
      showToast('アカウントを作成しました！ようこそ ' + res.data.user.name + 'さん', 'success');
      await App.loadCalendars();
      App.showCalendar();
    } else {
      errEl.textContent = res.data.error || 'アカウント作成に失敗しました';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-user-plus"></i> アカウントを作成する';
    }
  });
}

function bindCalendarEvents() {
  // キーボードショートカット
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModalForce();
    if (e.key === 'ArrowLeft' && !document.querySelector('.modal-overlay')) changeMonth(-1);
    if (e.key === 'ArrowRight' && !document.querySelector('.modal-overlay')) changeMonth(1);
  });
}

// ==========================================
// アプリ起動
// ==========================================
App.init();
</script>
</body>
</html>`;

// 全ルートをSPAに
app.get('*', (c) => {
  return c.html(htmlContent);
});

export default app;
