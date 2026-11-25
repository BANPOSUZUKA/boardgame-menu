// ?곗씠??李쎄뎄: 鍮꾧났媛?援щℓ 湲곕줉 + 硫붾돱???쒗듃瑜??쎌뼱 諛⑸Ц媛앹슜 移몃쭔 JSON?쇰줈 ?섍릿??
// ?붾㈃? GitHub Pages(SITE_URL)???덇퀬, ???뱀빋 二쇱냼??媛숈? ?붾㈃??iframe?쇰줈 蹂댁뿬 以??
// MENU_ID, PURCHASE_ID, ADMIN_SECRET은 Secret.js에 있다(공개 저장소 제외).
const PURCHASE_TABS = ['?⑥씠??2.5?댁긽', '1?쒓컙 ?몃뜑'];
const SITE_URL = 'https://banposuzuka.github.io/boardgame-menu/';
const WRITABLE = ['?꾩껜 寃뚯엫', '?쒖? 愿由?];

function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') return json_(getGames());
  const html = '<style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style>' +
    '<iframe src="' + SITE_URL + '" title="?곕━吏?蹂대뱶寃뚯엫"></iframe>';
  return HtmlService.createHtmlOutput(html).setTitle('?곕━吏?蹂대뱶寃뚯엫')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 愿由??묒뾽(?먮룞 ?섏쭛湲??꾩슜): 鍮?移몃쭔 梨꾩슦怨? ?녿뒗 寃뚯엫? ?됱쓣 異붽??쒕떎. ?대? ?곹엺 媛믪? ?덈? ??뼱?곗? ?딅뒗??
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
  const nameCol = headers.indexOf('寃뚯엫');
  let r = rows.findIndex((row, i) => i > 0 && key_(row[nameCol]) === key_(op.name));
  const filled = [];
  if (r < 0) {
    const row = new Array(width).fill('');
    row[nameCol] = String(op.name).trim();
    tab.appendRow(row);
    r = tab.getLastRow() - 1;
    rows[r] = row;
    filled.push('??異붽?');
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
  // ?먮ℓ媛媛 鍮꾩뼱 ?덈뒗 湲곕줉???섎굹?쇰룄 ?덉쑝硫?蹂댁쑀 以??ш뎄留??ы븿). ?먮ℓ媛留??덈뒗 寃뚯엫? ?먮ℓ濡?蹂몃떎.
  const owned = new Map();
  for (const tab of PURCHASE_TABS) {
    const rows = read_(purchases, tab);
    const headers = rows[0].map(v => String(v).trim());
    const nameCol = headers.indexOf('寃뚯엫');
    const soldCol = headers.findIndex(v => v.indexOf('?먮ℓ媛') === 0);
    if (nameCol < 0 || soldCol < 0) throw new Error('援щℓ 湲곕줉 ?ㅻ뜑 ?뺤씤 ?꾩슂: ' + tab);
    for (const row of rows.slice(1)) {
      const name = String(row[nameCol] || '').trim();
      if (!name) continue;
      const sale = String(row[soldCol] || '').trim();
      if (sale === '' || sale === '-' || sale === '??) { if (!owned.has(key_(name))) owned.set(key_(name), name); }
    }
  }
  const menuMap = table_(read_(menu, '?꾩껜 寃뚯엫'));
  const coverMap = table_(read_(menu, '?쒖? 愿由?));
  const games = [];
  for (const [key, purchaseName] of owned) {
    const m = menuMap.get(key) || {};
    const c = coverMap.get(key) || {};
    const source = m['李멸퀬 ?먮즺'] || '';
    const bggFromUrl = (source.match(/boardgamegeek\.com\/boardgame\/(\d+)/) || [])[1] || '';
    games.push({
      key,
      name: m['寃뚯엫'] || purchaseName,
      inMenu: !!menuMap.get(key),
      level: Number(String(m['?쒖씠??] || '').match(/^[1-7]/)?.[0] || 0),
      rules: m['猷??숈뒿 遺??(1~5)'] || '',
      strategy: m['?꾨왂 源딆씠 (1~5)'] || '',
      players: m['?몄썝'] || '',
      time: m['?뚮젅???쒓컙 (?덉긽)'] || '',
      type: m['寃뚯엫 ?좏삎'] || '',
      weight: m['BGG ?⑥씠??(議고쉶遺?'] || '',
      recPlayers: m['BGG 異붿쿇 ?몄썝'] || '',
      bestPlayers: m['BGG 理쒖쟻 ?몄썝'] || '',
      english: m['?곸뼱 ?먯젣'] || c['BGG 議고쉶紐?(?꾨낫)'] || '',
      bggId: m['BGG ID'] || c['BGG ?뺤씤 ID'] || bggFromUrl || c['BGG ?꾨낫 ID'] || '',
      links: (source + ' ' + (m['BGG ?몄썝 ?ы몴 異쒖쿂'] || '')).split(/\s+/).filter(s => /^https?:\/\//i.test(s)),
      coverSrc: c['?쒖? ?먮낯 URL'] || '',
      coverPage: c['?쒖? 寃??異쒖쿂'] || ''
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
    if (key_(obj['寃뚯엫'])) map.set(key_(obj['寃뚯엫']), obj);
  }
  return map;
}
function read_(ss, title) {
  const tab = ss.getSheetByName(title);
  if (!tab) throw new Error('?쒗듃瑜?李얠쓣 ???놁뒿?덈떎: ' + title);
  return tab.getRange(1, 1, Math.max(1, tab.getLastRow()), Math.max(1, tab.getLastColumn())).getDisplayValues();
}
function key_(name) { return String(name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
