const fs = require('fs');
let code = fs.readFileSync('public/static/app.js','utf8');

// ===============================================================
// 修正3: 管理者モードに/区切り一括登録機能を追加
// ===============================================================

// 1) 管理者パネル内の「ユーザー一覧」セクションの前に「一括登録」セクションを挿入
const bulkSectionHtml = `
  // ── 一括登録 ──────────────────────────────────────────────
  + '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">'
  + '<h4 class="text-sm font-semibold text-blue-700 mb-3"><i class="fas fa-users mr-1"></i>シフト一括登録（/区切り）</h4>'
  + '<div class="grid grid-cols-1 gap-2">'
  + '<div class="flex gap-2 items-center">'
  + '<label class="text-xs text-gray-600 w-12 flex-shrink-0">日付</label>'
  + '<input type="date" id="bulk-date" value="' + todayStr + '" class="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">'
  + '</div>'
  + '<div class="flex gap-2 items-center">'
  + '<label class="text-xs text-gray-600 w-12 flex-shrink-0">場所</label>'
  + '<select id="bulk-calendar" class="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm">' + calOptions + '</select>'
  + '</div>'
  + '<div class="flex gap-2 items-center">'
  + '<label class="text-xs text-gray-600 w-12 flex-shrink-0">活動</label>'
  + '<select id="bulk-activity" class="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-sm">' + actOptions + '</select>'
  + '</div>'
  + '<div class="flex gap-2 items-center">'
  + '<label class="text-xs text-gray-600 w-12 flex-shrink-0">時間帯</label>'
  + '<div class="flex gap-2 flex-1">'
  + '<button type="button" id="bulk-slot-morning" onclick="setBulkSlot(\\'morning\\')" class="flex-1 py-1.5 rounded-lg text-sm font-bold border-2 border-yellow-300 bg-yellow-50 text-yellow-700">午前</button>'
  + '<button type="button" id="bulk-slot-night" onclick="setBulkSlot(\\'night\\')" class="flex-1 py-1.5 rounded-lg text-sm font-bold border-2 border-indigo-200 bg-white text-gray-500">午後</button>'
  + '<button type="button" id="bulk-slot-none" onclick="setBulkSlot(\\'none\\')" class="flex-1 py-1.5 rounded-lg text-sm font-bold border-2 border-gray-200 bg-white text-gray-500">指定なし</button>'
  + '</div>'
  + '</div>'
  + '<div class="flex gap-2 items-start">'
  + '<label class="text-xs text-gray-600 w-12 flex-shrink-0 pt-2">名前</label>'
  + '<div class="flex-1">'
  + '<input type="text" id="bulk-names" placeholder="例：田中/鈴木/佐藤" class="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">'
  + '<div class="text-xs text-gray-400 mt-1">/ (スラッシュ) で区切って複数名を入力</div>'
  + '</div>'
  + '</div>'
  + '</div>'
  + '<button onclick="adminBulkRegister()" class="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors">'
  + '<i class="fas fa-plus-circle mr-1"></i>一括登録する</button>'
  + '<div id="bulk-msg" class="hidden mt-2 p-2 rounded text-sm"></div>'
  + '</div>'

`;

// 挿入ターゲット: 「ユーザー一覧」セクションの直前（「権限変更」セクションの後）
const insertTarget = `  // ── ユーザー一覧 ──────────────────────────────────────
  + '<div>'
  + '<h4 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-users mr-1"></i>ユーザー一覧</h4>'`;

const replacement = bulkSectionHtml + `  // ── ユーザー一覧 ──────────────────────────────────────
  + '<div>'
  + '<h4 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-users mr-1"></i>ユーザー一覧</h4>'`;

if (code.includes(insertTarget)) {
  code = code.replace(insertTarget, replacement);
  console.log('✓ 一括登録UIセクション挿入OK');
} else {
  console.error('✗ insertTarget not found');
}

// 2) setBulkSlot と adminBulkRegister 関数を追加
// adminDeleteSos関数の後に挿入
const insertAfter = `// SOS バッジ削除
async function adminDeleteSos(id) {
  const r = await API.delete('/sos-badges/' + id);
  if (r.ok) {
    showAdminMsg('SOSマークを削除しました', 'success');
    State.sosBadges = State.sosBadges.filter(b => b.id !== id);
    loadAdminSosList();
    renderContent();
  } else {
    showAdminMsg(r.data.error || '削除に失敗しました', 'error');
  }
}`;

const insertAfterNew = `// SOS バッジ削除
async function adminDeleteSos(id) {
  const r = await API.delete('/sos-badges/' + id);
  if (r.ok) {
    showAdminMsg('SOSマークを削除しました', 'success');
    State.sosBadges = State.sosBadges.filter(b => b.id !== id);
    loadAdminSosList();
    renderContent();
  } else {
    showAdminMsg(r.data.error || '削除に失敗しました', 'error');
  }
}

// 一括登録スロット選択
window.setBulkSlot = function(slot) {
  ['morning','night','none'].forEach(k => {
    const btn = document.getElementById('bulk-slot-' + k);
    if (!btn) return;
    const isSelected = k === slot;
    if (k === 'morning') {
      btn.style.borderColor = isSelected ? '#d97706' : '#fde68a';
      btn.style.background  = isSelected ? '#fef3c7' : '#fff';
      btn.style.color       = isSelected ? '#92400e' : '#9ca3af';
    } else if (k === 'night') {
      btn.style.borderColor = isSelected ? '#4f46e5' : '#c7d2fe';
      btn.style.background  = isSelected ? '#e0e7ff' : '#fff';
      btn.style.color       = isSelected ? '#312e81' : '#9ca3af';
    } else {
      btn.style.borderColor = isSelected ? '#6b7280' : '#d1d5db';
      btn.style.background  = isSelected ? '#f3f4f6' : '#fff';
      btn.style.color       = isSelected ? '#374151' : '#9ca3af';
    }
  });
};

// 一括登録実行
async function adminBulkRegister() {
  const dateEl     = document.getElementById('bulk-date');
  const calEl      = document.getElementById('bulk-calendar');
  const actEl      = document.getElementById('bulk-activity');
  const namesEl    = document.getElementById('bulk-names');
  const bulkMsgEl  = document.getElementById('bulk-msg');

  if (!dateEl || !calEl || !actEl || !namesEl) return;

  const shift_date    = dateEl.value;
  const calendar_id   = parseInt(calEl.value);
  const activity_type = actEl.value;
  const namesRaw      = namesEl.value;

  // スロット判定: ハイライトされているボタンから取得
  let slot = null;
  const morningBtn = document.getElementById('bulk-slot-morning');
  const nightBtn   = document.getElementById('bulk-slot-night');
  if (morningBtn && morningBtn.style.background && morningBtn.style.background.includes('fef3c7')) slot = 'morning';
  else if (nightBtn && nightBtn.style.background && nightBtn.style.background.includes('e0e7ff')) slot = 'night';

  const showBulkMsg = (msg, type) => {
    if (!bulkMsgEl) return;
    bulkMsgEl.textContent = msg;
    bulkMsgEl.className = 'mt-2 p-2 rounded text-sm ' + (type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700');
    bulkMsgEl.classList.remove('hidden');
  };

  if (!shift_date) { showBulkMsg('日付を入力してください', 'error'); return; }
  if (!namesRaw.trim()) { showBulkMsg('名前を入力してください', 'error'); return; }

  const names = namesRaw.split('/').map(n => n.trim()).filter(n => n.length > 0);
  if (names.length === 0) { showBulkMsg('有効な名前がありません', 'error'); return; }

  const calObj = State.calendars.find(c => c.id === calendar_id);
  const location_type = calObj?.slug || null;

  const btn = document.querySelector('[onclick="adminBulkRegister()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner w-4 h-4 inline-block"></div> 登録中...'; }

  let successCount = 0;
  let errorCount   = 0;

  for (const name of names) {
    const payload = {
      calendar_id,
      shift_date,
      start_time: slot,
      end_time: null,
      note: null,
      activity_type,
      location_type,
      override_user_name: name,
    };
    const r = await API.post('/shifts', payload);
    if (r.ok) successCount++;
    else errorCount++;
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus-circle mr-1"></i>一括登録する'; }

  if (errorCount === 0) {
    showBulkMsg(names.length + '件の登録が完了しました 🎉', 'success');
    namesEl.value = '';
    await App.loadAndRenderShifts();
  } else {
    showBulkMsg(successCount + '件成功、' + errorCount + '件失敗しました', errorCount > 0 ? 'error' : 'success');
    await App.loadAndRenderShifts();
  }
}`;

if (code.includes(insertAfter)) {
  code = code.replace(insertAfter, insertAfterNew);
  console.log('✓ setBulkSlot/adminBulkRegister 関数追加OK');
} else {
  console.error('✗ insertAfter target not found');
}

fs.writeFileSync('public/static/app.js', code);
console.log('Done step3!');
