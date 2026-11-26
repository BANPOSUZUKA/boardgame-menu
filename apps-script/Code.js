// 데이터 창구: 비공개 구매 기록 + 메뉴판 시트를 읽어 방문객용 칸만 JSON으로 넘긴다.
// 화면은 GitHub Pages(SITE_URL)에 있고, 이 웹앱 주소는 같은 화면을 iframe으로 보여 준다.
// MENU_ID, PURCHASE_ID, ADMIN_SECRET은 Secret.js에 있다(공개 저장소 제외).
const PURCHASE_TABS = ['웨이트 2.5이상', '1시간 언더'];
const SITE_URL = 'https://banposuzuka.github.io/boardgame-menu/';
const WRITABLE = ['전체 게임', '표지 관리'];

function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') return json_(getGames());
  const html = '<style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style>' +
    '<iframe src="' + SITE_URL + '" title="우리집 보드게임"></iframe>';
  return HtmlService.createHtmlOutput(html).setTitle('우리집 보드게임')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 관리 작업(자동 수집기 전용): 빈 칸만 채우고, 없는 게임은 행을 추가한다. 이미 적힌 값은 덮어쓰지 않는다.
// 예외: op.overwrite에 적은 관리용 칸(저장 상태 등)만 갱신한다.
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (!body || body.secret !== ADMIN_SECRET) return json_({ ok: false, error: 'forbidden' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const menu = SpreadsheetApp.openById(MENU_ID);
    const results = (body.ops || []).map(op => fillBlanks_(menu, op));
    return json_({ ok: true, results });
  } finally { lock.releaseLock(); }
}

function fillBlanks_(ss, op) {
  if (WRITABLE.indexOf(op.sheet) < 0 || !key_(op.name)) return { name: op.name, error: 'invalid op' };
  const tab = ss.getSheetByName(op.sheet);
  const width = tab.getLastColumn();
  const rows = tab.getRange(1, 1, Math.max(1, tab.getLastRow()), width).getValues();
  const headers = rows[0].map(v => String(v).trim());
  const nameCol = headers.indexOf('게임');
  let r = rows.findIndex((row, i) => i > 0 && key_(row[nameCol]) === key_(op.name));
  const filled = [];
  if (r < 0) {
    // appendRow는 빈 문자열만 든 아래쪽 칸까지 '내용'으로 쳐서 500행 뒤에 붙인다. 마지막 게임 바로 아래에 쓴다.
    let last = 0;
    rows.forEach((row, i) => { if (key_(row[nameCol])) last = i; });
    r = last + 1;
    const row = new Array(width).fill('');
    row[nameCol] = String(op.name).trim();
    if (r >= tab.getMaxRows()) tab.insertRowAfter(tab.getMaxRows());
    tab.getRange(r + 1, 1, 1, width).setValues([row]);
    rows[r] = row;
    filled.push('행 추가');
  }
  for (const [header, value] of Object.entries(op.fields || {})) {
    const c = headers.indexOf(header);
    if (c < 0 || value === '' || value == null) continue;
    if (String(rows[r][c]).trim() !== '' && !(op.overwrite || []).includes(header)) continue;
    tab.getRange(r + 1, c + 1).setValue(value);
    filled.push(header);
  }
  return { name: op.name, filled };
}

function getGames() {
  const menu = SpreadsheetApp.openById(MENU_ID);
  const purchases = SpreadsheetApp.openById(PURCHASE_ID);
  // 판매가가 비어 있는 기록이 하나라도 있으면 보유 중(재구매 포함). 판매가만 있는 게임은 판매로 본다.
  const owned = new Map();
  for (const tab of PURCHASE_TABS) {
    const rows = read_(purchases, tab);
    const headers = rows[0].map(v => String(v).trim());
    const nameCol = headers.indexOf('게임');
    const soldCol = headers.findIndex(v => v.indexOf('판매가') === 0);
    if (nameCol < 0 || soldCol < 0) throw new Error('구매 기록 헤더 확인 필요: ' + tab);
    for (const row of rows.slice(1)) {
      const name = String(row[nameCol] || '').trim();
      if (!name) continue;
      const sale = String(row[soldCol] || '').trim();
      if ((sale === '' || sale === '-' || sale === '—') && !owned.has(key_(name))) owned.set(key_(name), name);
    }
    // '제외게임' 칸: 본전 계산에서만 뺀 보유 게임. 위에서부터 빈 칸이 나올 때까지 읽는다(아래쪽에 합계 이름표가 있음).
    const exCol = headers.indexOf('제외게임');
    for (let i = 1; exCol >= 0 && i < rows.length; i++) {
      const name = String(rows[i][exCol] || '').trim();
      if (!name || /^(총 |본전)/.test(name)) break;
      if (!owned.has(key_(name))) owned.set(key_(name), name);
    }
  }
  const menuMap = table_(read_(menu, '전체 게임'));
  const coverMap = table_(read_(menu, '표지 관리'));
  const games = [];
  for (const [key, purchaseName] of owned) {
    const m = menuMap.get(key) || {};
    const c = coverMap.get(key) || {};
    const source = m['참고 자료'] || '';
    const bggFromUrl = (source.match(/boardgamegeek\.com\/boardgame\/(\d+)/) || [])[1] || '';
    games.push({
      key,
      name: m['게임'] || purchaseName,
      inMenu: menuMap.has(key),
      level: Number((String(m['난이도'] || '').match(/^[1-7]/) || [0])[0]),
      rules: m['룰 학습 부담 (1~5)'] || '',
      strategy: m['전략 깊이 (1~5)'] || '',
      players: m['인원'] || '',
      time: m['플레이 시간 (예상)'] || '',
      type: m['게임 유형'] || '',
      weight: m['BGG 웨이트 (조회분)'] || '',
      recPlayers: m['BGG 추천 인원'] || '',
      bestPlayers: m['BGG 최적 인원'] || '',
      english: m['영어 원제'] || c['BGG 조회명 (후보)'] || '',
      bggId: m['BGG ID'] || c['BGG 확인 ID'] || bggFromUrl || c['BGG 후보 ID'] || '',
      links: (source + ' ' + (m['BGG 인원 투표 출처'] || '')).split(/\s+/).filter(s => /^https?:\/\//i.test(s)),
      coverSrc: c['표지 원본 URL'] || '',
      coverPage: c['표지 검색 출처'] || ''
    });
  }
  return { games, syncedAt: new Date().toISOString() };
}

function table_(rows) {
  const headers = rows[0].map(v => String(v).trim());
  const map = new Map();
  for (const row of rows.slice(1)) {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = String(row[i] == null ? '' : row[i]).trim(); });
    if (key_(obj['게임'])) map.set(key_(obj['게임']), obj);
  }
  return map;
}
function read_(ss, title) {
  const tab = ss.getSheetByName(title);
  if (!tab) throw new Error('시트를 찾을 수 없습니다: ' + title);
  return tab.getRange(1, 1, Math.max(1, tab.getLastRow()), Math.max(1, tab.getLastColumn())).getDisplayValues();
}
function key_(name) { return String(name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
