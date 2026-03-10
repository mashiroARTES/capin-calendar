const fs = require('fs');
const path = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(path, 'utf8');

// ============================================================
// 1. State.dayNotes コメント変更
// ============================================================
code = code.replace(
  `dayNotes: {},    // { 'YYYY-MM-DD': { content, updated_by_name, updated_at } }`,
  `dayNotes: {},    // { 'YYYY-MM-DD': { 'null': note, '<calId>': note, ... } }`
);

// ============================================================
// 2. loadAndRenderShifts でのdayNotes格納方法を変更
// ============================================================
code = code.replace(
  `      if (rNotes.ok) (rNotes.data.notes || []).forEach(n => { State.dayNotes[n.note_date] = n; });`,
  `      if (rNotes.ok) (rNotes.data.notes || []).forEach(n => {
        if (!State.dayNotes[n.note_date]) State.dayNotes[n.note_date] = {};
        const key = n.calendar_id == null ? 'null' : String(n.calendar_id);
        State.dayNotes[n.note_date][key] = n;
      });`
);

// logout時のクリア（そのままでOK）

// ============================================================
// 3. dayNoteSectionHtml を場所ごとタブ形式に全面置換
// ============================================================
const oldDayNoteSection = `function dayNoteSectionHtml(dateStr) {
  const note = State.dayNotes[dateStr];
  const content = note ? note.content : '';
  // 3行に分割（改行で区切り、最大3行）
  const lines = content ? content.split('\\n').slice(0, 3) : ['', '', ''];
  while (lines.length < 3) lines.push('');
  const updater = note && note.updated_by_name ? note.updated_by_name : '';
  const isGuest = State.guestMode || !State.user;

  const updaterHtml = updater ? '<span class=\"text-xs text-amber-500 ml-auto\">最終更新: '+escHtml(updater)+'</span>' : '';`;

// find the end of the function
const dnsStart = code.indexOf('function dayNoteSectionHtml(dateStr) {');
let braceDepth = 0;
let dnsEnd = dnsStart;
let inFunc = false;
for (let i = dnsStart; i < code.length; i++) {
  if (code[i] === '{') { braceDepth++; inFunc = true; }
  if (code[i] === '}') { braceDepth--; }
  if (inFunc && braceDepth === 0) { dnsEnd = i + 1; break; }
}
const oldDnsFunc = code.slice(dnsStart, dnsEnd);

const newDnsFunc = `function dayNoteSectionHtml(dateStr) {
  const isGuest = State.guestMode || !State.user;
  const cals = State.calendars;

  // カレンダーごとのメモUIを生成
  const calSections = cals.map(cal => {
    const key  = String(cal.id);
    const noteMap = State.dayNotes[dateStr] || {};
    const note = noteMap[key];
    const content = note ? note.content : '';
    const lines = content ? content.split('\\n').slice(0, 3) : ['', '', ''];
    while (lines.length < 3) lines.push('');
    const updater = note && note.updated_by_name ? note.updated_by_name : '';
    const updaterHtml = updater ? '<span class=\"text-xs text-amber-500 ml-auto\">最終更新: '+escHtml(updater)+'</span>' : '';
    const inputId = 'day-note-cal-' + cal.id;

    let bodyHtml;
    if (isGuest) {
      const displayLines = lines.filter(l => l.trim());
      if (displayLines.length > 0) {
        bodyHtml = displayLines.map(function(l) {
          return '<div class=\"text-sm text-amber-700 leading-relaxed\">📌 '+escHtml(l)+'</div>';
        }).join('');
      } else {
        bodyHtml = '<div class=\"text-sm text-amber-700 opacity-50 italic\">まだメモがありません</div>';
      }
      bodyHtml += '<p class=\"text-xs text-amber-500 mt-1.5\"><i class=\"fas fa-lock mr-1\"></i>書き込みにはログインが必要です</p>';
    } else {
      const charCount = lines.join('\\n').replace(/\\n$/, '').length;
      bodyHtml =
        '<div class=\"space-y-1.5 mb-2\">'
        + '<div class=\"flex items-center gap-1.5\"><span class=\"text-xs text-amber-500 w-10 flex-shrink-0\">1行目</span>'
        + '<input id=\"'+inputId+'-1\" type=\"text\" maxlength=\"100\" value=\"'+escHtml(lines[0])+'\"'
        + ' class=\"flex-1 text-sm border border-amber-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-amber-400\" placeholder=\"1行目（100文字以内）\"></div>'
        + '<div class=\"flex items-center gap-1.5\"><span class=\"text-xs text-amber-500 w-10 flex-shrink-0\">2行目</span>'
        + '<input id=\"'+inputId+'-2\" type=\"text\" maxlength=\"100\" value=\"'+escHtml(lines[1])+'\"'
        + ' class=\"flex-1 text-sm border border-amber-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-amber-400\" placeholder=\"2行目（任意）\"></div>'
        + '<div class=\"flex items-center gap-1.5\"><span class=\"text-xs text-amber-500 w-10 flex-shrink-0\">3行目</span>'
        + '<input id=\"'+inputId+'-3\" type=\"text\" maxlength=\"100\" value=\"'+escHtml(lines[2])+'\"'
        + ' class=\"flex-1 text-sm border border-amber-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-amber-400\" placeholder=\"3行目（任意）\"></div>'
        + '</div>'
        + '<div class=\"flex items-center justify-between mt-1.5\">'
        + '<span id=\"'+inputId+'-count\" class=\"text-xs text-amber-400\">'+charCount+'/300文字</span>'
        + '<button onclick=\"saveDayNote(\\'' + dateStr + '\\','+cal.id+')\"'
        + ' class=\"text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1\">'
        + '<i class=\"fas fa-save\"></i>保存</button>'
        + '</div>';
    }

    return '<div class=\"mb-3 border border-amber-100 rounded-lg p-2.5\" style=\"border-left:3px solid '+escHtml(cal.color||'#f59e0b')+'\">'
      + '<div class=\"flex items-center gap-2 mb-2\">'
      + '<span style=\"display:inline-block;width:8px;height:8px;border-radius:50%;background:'+escHtml(cal.color||'#f59e0b')+'\"></span>'
      + '<span class=\"text-xs font-bold text-amber-800\">'+escHtml(cal.name)+'</span>'
      + updaterHtml
      + '</div>'
      + bodyHtml
      + '</div>';
  }).join('');

  return '<div class=\"bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4\" id=\"day-note-section\">'
    + '<div class=\"flex items-center gap-2 mb-2\">'
    + '<span class=\"text-base\">📌</span>'
    + '<span class=\"text-sm font-bold text-amber-800\">場所ごとひとこと掲示板</span>'
    + '</div>'
    + calSections
    + '</div>';
}`;

code = code.replace(oldDnsFunc, newDnsFunc);
console.log('dayNoteSectionHtml replaced:', code.includes('場所ごとひとこと掲示板'));

// ============================================================
// 4. saveDayNote を calendar_id 対応に変更
// ============================================================
const saveDayNoteStart = code.indexOf('async function saveDayNote(dateStr) {');
let saveEnd = saveDayNoteStart;
let saveDepth = 0;
let saveIn = false;
for (let i = saveDayNoteStart; i < code.length; i++) {
  if (code[i] === '{') { saveDepth++; saveIn = true; }
  if (code[i] === '}') { saveDepth--; }
  if (saveIn && saveDepth === 0) { saveEnd = i + 1; break; }
}
const oldSaveFunc = code.slice(saveDayNoteStart, saveEnd);

const newSaveFunc = `async function saveDayNote(dateStr, calendarId) {
  const inputId = 'day-note-cal-' + calendarId;
  const l1 = document.getElementById(inputId + '-1');
  const l2 = document.getElementById(inputId + '-2');
  const l3 = document.getElementById(inputId + '-3');
  // 保存ボタン（クリックされたbutton要素を特定するため、closest使用）
  // inline onclickで呼ばれるため event は使えない。代わりにquerySelectorで探す
  const btnSel = 'button[onclick*=\"saveDayNote(\\'' + dateStr + '\\','+calendarId+')\"]';
  const btn = document.querySelector(btnSel);
  if (!l1) return;
  const lines = [l1.value.trim(), l2 ? l2.value.trim() : '', l3 ? l3.value.trim() : ''];
  while (lines.length > 0 && lines[lines.length-1] === '') lines.pop();
  const content = lines.join('\\n');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class=\"spinner w-3 h-3\"></div>'; }
  const r = await API.put('/day-notes/' + dateStr, { content, calendar_id: calendarId });
  if (r.ok) {
    if (!State.dayNotes[dateStr]) State.dayNotes[dateStr] = {};
    State.dayNotes[dateStr][String(calendarId)] = r.data.note;
    showToast('掲示板を更新しました', 'success', 2000);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class=\"fas fa-save\"></i>保存'; }
    const cnt = document.getElementById(inputId + '-count');
    if (cnt) cnt.textContent = content.length + '/300文字';
    if (State.viewMode === 'month') renderContent();
  } else {
    showToast(r.data.error || '保存に失敗しました', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class=\"fas fa-save\"></i>保存'; }
  }
}`;

code = code.replace(oldSaveFunc, newSaveFunc);
console.log('saveDayNote replaced:', code.includes('async function saveDayNote(dateStr, calendarId)'));

// ============================================================
// 5. listNoteBannerHtml を場所ごとに対応
// ============================================================
const listNoteBannerStart = code.indexOf('function listNoteBannerHtml(dateStr) {');
let lnbEnd = listNoteBannerStart;
let lnbDepth = 0;
let lnbIn = false;
for (let i = listNoteBannerStart; i < code.length; i++) {
  if (code[i] === '{') { lnbDepth++; lnbIn = true; }
  if (code[i] === '}') { lnbDepth--; }
  if (lnbIn && lnbDepth === 0) { lnbEnd = i + 1; break; }
}
const oldLnbFunc = code.slice(listNoteBannerStart, lnbEnd);

const newLnbFunc = `function listNoteBannerHtml(dateStr, calendarId) {
  const noteMap = State.dayNotes[dateStr] || {};
  const key = calendarId == null ? 'null' : String(calendarId);
  const note = noteMap[key];
  const hasContent = note && note.content && note.content.trim();
  const isGuest = State.guestMode || !State.user;
  if (!hasContent && isGuest) return '';
  const previewText = hasContent ? note.content.split('\\n')[0] : '';
  const editIcon = !isGuest ? '<span style=\"font-size:15px;color:#d97706;flex-shrink:0\"><i class=\"fas fa-pencil-alt\"></i></span>' : '';
  const inner = hasContent
    ? '<span class=\"note-text\">' + escHtml(previewText) + '</span>'
    : '<span class=\"note-empty\">この日のひとことを書く…</span>';
  return '<div class=\"day-note-bar mb-2\" onclick=\"openDayView(\\'' + dateStr + '\\',true)\">'
    + '<span class=\"note-icon\">📌</span>'
    + inner
    + editIcon
    + '</div>';
}`;

code = code.replace(oldLnbFunc, newLnbFunc);
console.log('listNoteBannerHtml replaced:', code.includes('function listNoteBannerHtml(dateStr, calendarId)'));

// ============================================================
// 6. buildQuickDetail: メモをカレンダーごと・合計人数削除・活動文字色黒
// ============================================================

// 6a. 活動内容の文字色 at.color → #111827（黒固定）
// buildQuickDetail内の activity label の色
code = code.replace(
  `+ '<span style=\"font-size:13px;font-weight:700;color:' + at.color + '\">'
        + at.label.replace(/^[^\\s]+\\s/,'') + '</span>'
        + '</div>'
        + innerHtml
        + '</div>';`,
  `+ '<span style=\"font-size:13px;font-weight:700;color:#111827\">'
        + at.label.replace(/^[^\\s]+\\s/,'') + '</span>'
        + '</div>'
        + innerHtml
        + '</div>';`
);

// 6b. 場所ヘッダーの人数表示を削除
code = code.replace(
  `+ '<span style=\"font-size:12px;color:#9ca3af;margin-left:2px\">' + loc.shifts.length + '人</span>'
      + '</div>'
      + slotRowsHtml
      + '</div>';`,
  `+ '</div>'
      + slotRowsHtml
      + '</div>';`
);

// 6c. dateHeaderの "N名参加" を削除
code = code.replace(
  `+ '<span style=\"font-size:16px;font-weight:800;color:' + (isToday?'#1d4ed8':'#1f2937') + '\">' + dateLabel + '</span>'
    + '<span style=\"font-size:15px;color:#9ca3af\">' + dayShifts.length + '名参加</span>'`,
  `+ '<span style=\"font-size:16px;font-weight:800;color:' + (isToday?'#1d4ed8':'#1f2937') + '\">' + dateLabel + '</span>'`
);
console.log('人数削除 done');

// 6d. クイックビューのメモをカレンダーごとに表示（旧noteHtml置換）
code = code.replace(
  `  // メモ（一言ボード）
  const note     = State.dayNotes[sd];
  const lines    = note && note.content
    ? note.content.split('\\n').filter(l => l.trim())
    : [];
  const noteHtml = lines.length
    ? \`<div style=\"margin:4px 8px 2px;padding:6px 10px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b\">\` +
      lines.map(l => \`<div style=\"font-size:15px;color:#92400e;line-height:1.5\">📌 \${escHtml(l)}</div>\`).join('') +
      \`</div>\`
    : '';`,
  `  // メモ（場所ごと）
  const noteMap  = State.dayNotes[sd] || {};
  const isGuest  = State.guestMode || !State.user;
  const noteHtml = State.calendars.map(cal => {
    const note   = noteMap[String(cal.id)];
    const lines  = note && note.content ? note.content.split('\\n').filter(l => l.trim()) : [];
    const inputId = 'qv-note-cal-' + cal.id + '-' + sd;
    if (isGuest) {
      if (!lines.length) return '';
      return '<div style=\"margin:2px 8px;padding:5px 10px;background:#fffbeb;border-radius:8px;border-left:3px solid ' + (cal.color||'#f59e0b') + '\">'
        + '<div style=\"font-size:11px;font-weight:700;color:#92400e;margin-bottom:2px\">' + escHtml(cal.name) + '</div>'
        + lines.map(l => '<div style=\"font-size:13px;color:#92400e;line-height:1.5\">📌 ' + escHtml(l) + '</div>').join('')
        + '</div>';
    }
    // ログイン済み：編集フォーム
    const content = note ? note.content : '';
    const ls = content ? content.split('\\n').slice(0,3) : ['','',''];
    while (ls.length < 3) ls.push('');
    return '<div style=\"margin:2px 8px;padding:5px 10px;background:#fffbeb;border-radius:8px;border-left:3px solid ' + (cal.color||'#f59e0b') + '\">'
      + '<div style=\"display:flex;align-items:center;gap:4px;margin-bottom:4px\">'
      + '<span style=\"display:inline-block;width:7px;height:7px;border-radius:50%;background:' + (cal.color||'#f59e0b') + '\"></span>'
      + '<span style=\"font-size:11px;font-weight:700;color:#92400e\">' + escHtml(cal.name) + '</span>'
      + (note && note.updated_by_name ? '<span style=\"font-size:10px;color:#d97706;margin-left:auto\">' + escHtml(note.updated_by_name) + '</span>' : '')
      + '</div>'
      + ['1行目','2行目','3行目'].map((lbl,i) =>
          '<div style=\"display:flex;align-items:center;gap:4px;margin-bottom:2px\">'
          + '<span style=\"font-size:10px;color:#d97706;width:28px;flex-shrink:0\">' + lbl + '</span>'
          + '<input id=\"' + inputId + '-' + (i+1) + '\" type=\"text\" maxlength=\"100\" value=\"' + escHtml(ls[i]) + '\"'
          + ' style=\"flex:1;font-size:12px;border:1px solid #fde68a;border-radius:4px;padding:2px 6px;background:#fff;outline:none\"'
          + ' placeholder=\"' + (i===0?'メモ（100文字以内）':'任意') + '\">'
          + '</div>'
        ).join('')
      + '<div style=\"display:flex;justify-content:flex-end;margin-top:3px\">'
      + '<button onclick=\"saveQuickViewNote(\\'' + sd + '\\',' + cal.id + ',\\'' + inputId + '\\')\"\\'\"'
      + ' style=\"font-size:11px;background:#f59e0b;color:#fff;border:none;border-radius:5px;padding:2px 10px;cursor:pointer;font-weight:600\">'
      + '💾 保存</button>'
      + '</div>'
      + '</div>';
  }).join('');`
);
console.log('quickview noteHtml replaced');

// ============================================================
// 7. saveQuickViewNote 関数追加（buildQuickDetail後、selectQuickDate前）
// ============================================================
const qvNoteFunc = `
// クイックビューのメモ保存
async function saveQuickViewNote(dateStr, calendarId, inputId) {
  const l1 = document.getElementById(inputId + '-1');
  const l2 = document.getElementById(inputId + '-2');
  const l3 = document.getElementById(inputId + '-3');
  if (!l1) return;
  const lines = [l1.value.trim(), l2 ? l2.value.trim() : '', l3 ? l3.value.trim() : ''];
  while (lines.length > 0 && lines[lines.length-1] === '') lines.pop();
  const content = lines.join('\\n');
  const r = await API.put('/day-notes/' + dateStr, { content, calendar_id: calendarId });
  if (r.ok) {
    if (!State.dayNotes[dateStr]) State.dayNotes[dateStr] = {};
    State.dayNotes[dateStr][String(calendarId)] = r.data.note;
    showToast('掲示板を更新しました', 'success', 2000);
    if (State.viewMode === 'month') renderContent();
  } else {
    showToast(r.data.error || '保存に失敗しました', 'error');
  }
}

`;

code = code.replace(
  '// クイックビューで日付を選択（全体再描画）\nfunction selectQuickDate(ds) {',
  qvNoteFunc + '// クイックビューで日付を選択（全体再描画）\nfunction selectQuickDate(ds) {'
);
console.log('saveQuickViewNote added:', code.includes('async function saveQuickViewNote'));

// ============================================================
// 8. renderListView を週単位ナビゲーション付きに全面置換
// ============================================================
const listViewStart = code.indexOf('// 一覧表示\n// ============================================================\nfunction renderListView()');
let listViewEnd = listViewStart;
let lvDepth = 0;
let lvIn = false;
// find "function renderListView" opening brace
const funcOpen = code.indexOf('function renderListView() {', listViewStart);
for (let i = funcOpen; i < code.length; i++) {
  if (code[i] === '{') { lvDepth++; lvIn = true; }
  if (code[i] === '}') { lvDepth--; }
  if (lvIn && lvDepth === 0) { listViewEnd = i + 1; break; }
}
const oldListView = code.slice(listViewStart, listViewEnd);

const newListView = `// 一覧表示（週単位ナビゲーション）
// ============================================================

// 一覧ビューの週オフセット（0 = 当日を含む週）
if (typeof State.listWeekOffset === 'undefined') State.listWeekOffset = 0;

function getWeekRange(offset) {
  const today = new Date(todayLocal() + 'T12:00:00');
  // 当日を含む週の月曜日を起点とする
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = (dow === 0 ? -6 : 1 - dow);
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  return { start: fmt(monday), end: fmt(sunday), startDate: monday, endDate: sunday };
}

function renderListView() {
  const isGuest = State.guestMode || !State.user;
  const todayStr = todayLocal();
  const dayNames = ['日','月','火','水','木','金','土'];
  const isAdmin  = State.user && State.user.role === 'admin';

  const { start, end, startDate, endDate } = getWeekRange(State.listWeekOffset);

  // 表示期間内のシフトのみ抽出
  const weekShifts = State.shifts.filter(s => s.shift_date >= start && s.shift_date <= end);

  // 表示期間内の全日付を生成（シフトがなくても当日は表示）
  const allDates = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate()+1)) {
    const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    allDates.push(ds);
  }

  // 時間帯定義
  const SLOT_DEFS = [
    {key:'morning',  label:'午前', hc:'#d97706', bg:'#fffbeb', bc:'#fde68a'},
    {key:'night',    label:'午後', hc:'#4f46e5', bg:'#eef2ff', bc:'#c7d2fe'},
  ];
  const toSlot = t => {
    if (!t) return 'night';
    if (t === 'morning')   return 'morning';
    if (t === 'afternoon' || t === 'noon') return 'night';
    if (t === 'night' || t === 'evening') return 'night';
    const h = parseInt(t.slice(0,2),10);
    if (h>=3&&h<12)  return 'morning';
    return 'night';
  };
  const ACT_KEY_ORDER = Object.keys(ACTIVITY_TYPES);

  // 週ヘッダーラベル
  const fmtDate = d => { const o = new Date(d+'T12:00:00'); return (o.getMonth()+1)+'月'+o.getDate()+'日'; };
  const weekLabel = fmtDate(start) + '（' + dayNames[startDate.getDay()] + '）〜' + fmtDate(end) + '（' + dayNames[endDate.getDay()] + '）';

  // ナビゲーションHTML
  const navHtml = '<div style=\"display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:10\">'
    + '<button onclick=\"changeListWeek(-1)\" style=\"background:#f3f4f6;border:none;border-radius:8px;padding:5px 14px;font-size:15px;cursor:pointer;color:#374151\">← 前の週</button>'
    + '<div style=\"text-align:center\">'
    + '<div style=\"font-size:13px;font-weight:700;color:#374151\">' + weekLabel + '</div>'
    + (State.listWeekOffset !== 0 ? '<button onclick=\"changeListWeek(0,true)\" style=\"font-size:11px;color:#3b82f6;background:none;border:none;cursor:pointer;text-decoration:underline\">今週に戻る</button>' : '')
    + '</div>'
    + '<button onclick=\"changeListWeek(1)\" style=\"background:#f3f4f6;border:none;border-radius:8px;padding:5px 14px;font-size:15px;cursor:pointer;color:#374151\">次の週 →</button>'
    + '</div>';

  // 日付カードHTML生成
  const grp = {};
  weekShifts.forEach(s => { (grp[s.shift_date] = grp[s.shift_date]||[]).push(s); });

  let daysHtml = allDates.map(date => {
    const d       = new Date(date + 'T12:00:00');
    const dn      = dayNames[d.getDay()];
    const isToday = date === todayStr;
    const sorted  = (grp[date]||[]).sort((a,b) => (a.start_time||'99:99') < (b.start_time||'99:99') ? -1 : 1);

    const locMap = {};
    sorted.forEach(s => {
      const locKey   = getLocationLabel(s) || '（場所未設定）';
      const locLabel = getLocationLabel(s) || '（場所未設定）';
      const calColor = s.calendar_color || '#9ca3af';
      if (!locMap[locKey]) locMap[locKey] = { label: locLabel, color: calColor, shifts: [], sortKey: s.calendar_id, calendarId: s.calendar_id };
      locMap[locKey].shifts.push(s);
    });

    const locEntries = Object.values(locMap).filter(loc => loc.shifts.length > 0).sort((a,b) => a.sortKey - b.sortKey);

    const locSectionsHtml = locEntries.map(loc => {
      const slotActMap = { morning:{}, afternoon:{}, night:{} };
      loc.shifts.forEach(s => {
        const sk = toSlot(s.start_time);
        const ak = s.activity_type || s.animal_type || 'other_custom';
        if (!slotActMap[sk][ak]) slotActMap[sk][ak] = [];
        slotActMap[sk][ak].push(s);
      });

      const slotSectionsHtml = SLOT_DEFS.map(({key, label, hc, bg, bc}) => {
        const actGroups = slotActMap[key];
        const actKeys   = ACT_KEY_ORDER.filter(ak => actGroups[ak] && actGroups[ak].length > 0);
        if (!actKeys.length) return '';

        const actRowsHtml = actKeys.map(ak => {
          const at     = ACTIVITY_TYPES[ak] || ACTIVITY_TYPES.other_custom;
          const shifts = actGroups[ak];
          const userChips = shifts.map(s => {
            const isMine   = State.user && s.user_id === State.user.id;
            const sid      = s.id;
            const memoChip = s.note
              ? '<span style=\"font-size:12px;color:#6b7280;margin-left:3px;font-style:italic;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">' + escHtml(s.note) + '</span>'
              : '';
            return '<span onclick=\"event.stopPropagation();showDetailById(' + sid + ')\"'
              + ' style=\"display:inline-flex;align-items:center;gap:3px;'
              + 'background:' + (isMine ? '#eff6ff' : '#fff') + ';'
              + 'border:1.5px solid ' + (isMine ? '#93c5fd' : '#e5e7eb') + ';'
              + 'border-radius:20px;padding:3px 10px;cursor:pointer;white-space:nowrap;'
              + '-webkit-tap-highlight-color:transparent\">'
              + '<span style=\"font-size:15px;font-weight:' + (isMine ? '700' : '500') + ';color:#111827\">' + escHtml(s.user_name) + '</span>'
              + memoChip
              + '</span>';
          }).join('');

          return '<div style=\"display:flex;align-items:flex-start;gap:6px;margin-bottom:5px\">'
            + '<div style=\"display:inline-flex;align-items:center;gap:3px;flex-shrink:0;'
            + 'background:' + at.bg + ';border:1.5px solid ' + at.color + '33;'
            + 'border-radius:6px;padding:3px 8px;min-width:52px;justify-content:center\">'
            + '<span style=\"font-size:16px\">' + at.emoji + '</span>'
            + '<span style=\"font-size:13px;font-weight:700;color:#111827\">'
            + at.label.replace(/^[^\s]+\s/,'') + '</span>'
            + '</div>'
            + '<div style=\"display:flex;flex-wrap:wrap;gap:5px;align-items:center\">' + userChips + '</div>'
            + '</div>';
        }).join('');

        return '<div style=\"padding:4px 10px 5px;border-bottom:1px solid #f3f4f6\">'
          + '<div style=\"display:inline-flex;align-items:center;gap:4px;'
          + 'background:' + bg + ';border:1.5px solid ' + bc + ';'
          + 'border-radius:8px;padding:2px 10px;margin-bottom:5px\">'
          + '<span style=\"font-size:15px;font-weight:800;color:' + hc + '\">' + label + '</span>'
          + '</div>'
          + actRowsHtml
          + '</div>';
      }).filter(Boolean).join('');

      // 場所ごとメモバナー
      const calObj = State.calendars.find(c => c.id === loc.calendarId);
      const noteBanner = calObj ? listNoteBannerHtml(date, calObj.id) : '';

      return '<div style=\"margin-bottom:6px;border:1.5px solid ' + loc.color + '44;border-radius:10px;overflow:hidden\">'
        + '<div style=\"display:flex;align-items:center;gap:6px;padding:5px 12px;'
        + 'background:' + loc.color + '18;border-bottom:1px solid ' + loc.color + '44\">'
        + '<span style=\"display:inline-block;width:10px;height:10px;border-radius:50%;'
        + 'background:' + loc.color + ';flex-shrink:0\"></span>'
        + '<span style=\"font-size:15px;font-weight:700;color:#1f2937\">' + escHtml(loc.label) + '</span>'
        + '</div>'
        + (noteBanner ? '<div style=\"padding:4px 8px 0\">' + noteBanner + '</div>' : '')
        + slotSectionsHtml
        + '</div>';
    }).join('');

    const emptyMsg = sorted.length === 0
      ? '<div style=\"color:#9ca3af;font-size:13px;padding:6px 2px\">シフトなし</div>'
      : '';

    const todayAnchorId = isToday ? 'list-today-anchor' : '';
    return '<div id=\"' + todayAnchorId + '\" style=\"margin-bottom:12px;'
      + (isToday ? 'padding:2px;border-radius:12px;border:2px solid #3b82f6;background:#f0f7ff' : '') + '\">'
      + '<div style=\"display:flex;align-items:center;gap:6px;padding:' + (isToday?'6px 10px 4px':'4px 2px') + ';\">'
      + '<span style=\"font-size:14px;font-weight:800;color:' + (isToday?'#1d4ed8':(d.getDay()===0?'#ef4444':d.getDay()===6?'#3b82f6':'#374151')) + '\">'
      + date.replace(/-/g,'/') + '（' + dn + '）</span>'
      + (isToday ? '<span style=\"background:#3b82f6;color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px\">今日</span>' : '')
      + (!isGuest ? '<button onclick=\"openShiftForm(\\'' + date + '\\')\"\' style=\"margin-left:auto;font-size:12px;background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:2px 10px;cursor:pointer\">＋ 登録</button>' : '')
      + '</div>'
      + (emptyMsg ? '<div style=\"padding:0 4px\">' + emptyMsg + '</div>' : locSectionsHtml)
      + '</div>';
  }).join('');

  return '<div style=\"background:#f9fafb;min-height:100%\">'
    + navHtml
    + '<div class=\"max-w-screen-xl mx-auto p-3\" id=\"list-view-content\">'
    + daysHtml
    + '</div>'
    + '</div>';
}`;

code = code.replace(oldListView, newListView);
console.log('renderListView replaced:', code.includes('getWeekRange'));

// ============================================================
// 9. changeListWeek 関数追加（setViewMode の後に追加）
// ============================================================
const changeWeekFunc = `
function changeListWeek(delta, reset) {
  if (reset) {
    State.listWeekOffset = 0;
  } else {
    State.listWeekOffset = (State.listWeekOffset || 0) + delta;
  }
  renderContent();
  // 当日アンカーへスクロール（offsetが0のとき）
  if (State.listWeekOffset === 0) {
    setTimeout(() => {
      const anchor = document.getElementById('list-today-anchor');
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}
`;

// setViewMode関数の後に追加
code = code.replace(
  'function setViewMode(mode) {',
  changeWeekFunc + 'function setViewMode(mode) {'
);

// setViewMode で list に切り替えたとき offset をリセットしてスクロール
const setViewModeStart = code.indexOf('function setViewMode(mode) {');
let svmEnd = setViewModeStart;
let svmDepth = 0;
let svmIn = false;
for (let i = setViewModeStart; i < code.length; i++) {
  if (code[i] === '{') { svmDepth++; svmIn = true; }
  if (code[i] === '}') { svmDepth--; }
  if (svmIn && svmDepth === 0) { svmEnd = i + 1; break; }
}
const oldSetViewMode = code.slice(setViewModeStart, svmEnd);

const newSetViewMode = oldSetViewMode.replace(
  'function setViewMode(mode) {',
  `function setViewMode(mode) {
  if (mode === 'list') {
    State.listWeekOffset = 0;
  }`
);
code = code.replace(oldSetViewMode, newSetViewMode);

// renderContent後にlistスクロール処理
code = code.replace(
  `  State.viewMode = mode;`,
  `  State.viewMode = mode;`
);
console.log('changeListWeek added:', code.includes('function changeListWeek'));

// renderContentの後、list モード時に today anchor へスクロール
code = code.replace(
  `  if (State.viewMode === 'quick') el.innerHTML = renderQuickView();
  else if (State.viewMode === 'month') el.innerHTML = renderMonthView();
  else el.innerHTML = renderListView();
}`,
  `  if (State.viewMode === 'quick') el.innerHTML = renderQuickView();
  else if (State.viewMode === 'month') el.innerHTML = renderMonthView();
  else {
    el.innerHTML = renderListView();
    if (State.listWeekOffset === 0) {
      setTimeout(() => {
        const anchor = document.getElementById('list-today-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 30);
    }
  }
}`
);
console.log('list scroll added');

fs.writeFileSync(path, code, 'utf8');
console.log('All done. File written.');
