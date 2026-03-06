const fs = require('fs');
let code = fs.readFileSync('public/static/app.js','utf8');

// ===============================================================
// 修正: クイックビューのユーザー名文字色を黒に統一
// ===============================================================

// パターン1: buildQuickDetail の makeUserChips
const old1 = `        + '<span style="font-size:15px;font-weight:' + (isMine ? '700' : '500') + ';'
        + 'color:' + (isMine ? '#1d4ed8' : '#1f2937') + '">' + escHtml(s.user_name) + '</span>'`;
const new1 = `        + '<span style="font-size:15px;font-weight:' + (isMine ? '700' : '500') + ';'
        + 'color:#111827">' + escHtml(s.user_name) + '</span>'`;

if (code.includes(old1)) {
  code = code.replace(old1, new1);
  console.log('✓ makeUserChips (buildQuickDetail) 修正OK');
} else {
  console.error('✗ makeUserChips (buildQuickDetail) not found');
}

// パターン2: renderListView の makeUserChips
const old2 = `              + '<span style="font-size:15px;font-weight:' + (isMine ? '700' : '500') + ';'
              + 'color:' + (isMine ? '#1d4ed8' : '#1f2937') + '">' + escHtml(s.user_name) + '</span>'`;
const new2 = `              + '<span style="font-size:15px;font-weight:' + (isMine ? '700' : '500') + ';'
              + 'color:#111827">' + escHtml(s.user_name) + '</span>'`;

if (code.includes(old2)) {
  code = code.replace(old2, new2);
  console.log('✓ makeUserChips (renderListView) 修正OK');
} else {
  console.error('✗ makeUserChips (renderListView) not found');
}

// スロットバッジの文字色を黒に（hc カラーではなく黒固定に）
// SLOT_DEFのhcは枠色として保持するが、表示テキストは黒に変更済みのはずなので確認
const old3 = `+ '<span style="font-size:13px;font-weight:800;color:' + hc + '">' + label + '</span>'`;
const new3 = `+ '<span style="font-size:13px;font-weight:800;color:#111827">' + label + '</span>'`;

const cnt3 = (code.split(old3)).length - 1;
console.log('slotBadge text count:', cnt3);
if (cnt3 > 0) {
  code = code.split(old3).join(new3);
  console.log('✓ slotBadge text 修正OK (' + cnt3 + '件)');
} else {
  console.log('(slotBadge text already changed or not found)');
}

fs.writeFileSync('public/static/app.js', code);
console.log('Done step2!');
