/* LinkScope JSON API — only Code.gs is needed. Frontend runs on GitHub Pages. */
const SPREADSHEET_ID = '1eJcZCHT2Yw3C0voFxr265Kfsj2Ic0oV6IFz4Hk-R_zk';
const LINK_HEADERS_ = ['id', 'label', 'destination', 'created_utc'];
const CLICK_HEADERS_ = ['event_id', 'link_id', 'timestamp_utc', 'visitor_hash', 'identity_quality', 'user_agent', 'platform', 'language', 'timezone', 'screen', 'likely_bot', 'ip_address'];
const MAX_ROWS_ = 50000;

// Initialization runs automatically on the first dashboard request. No password is needed.
function setup() {
  config_();
  locked_(function () {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    [['Links', LINK_HEADERS_], ['Clicks', CLICK_HEADERS_]].forEach(function (pair) {
      let s = ss.getSheetByName(pair[0]);
      if (!s) s = ss.insertSheet(pair[0]);
      if (s.getLastRow() === 0) {
        s.getRange(1, 1, 1, pair[1].length).setValues([pair[1]]).setFontWeight('bold').setBackground('#183e30').setFontColor('#ffffff');
        s.setFrozenRows(1);
        s.autoResizeColumns(1, pair[1].length);
      }
      validate_(s, pair[1]);
    });
  });
  return 'Ready: Links and Clicks tabs verified. Existing tabs were preserved.';
}
// Personal-use version: all API operations are public, as requested.
function doGet(e) {
  const action = e && e.parameter && e.parameter.action || 'health';
  if (action !== 'health') return json_({ success: false, error: 'Use POST for this action.' });
  return json_({ success: true, data: { api: 'linkscope', version: 4 } });
}
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents || '{}';
    if (raw.length > 12000) throw new Error('Request too large.');
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Invalid request.');
    let data;
    switch (p.action) {
      case 'getAll': setup(); data = getDashboard(); break;
      case 'createLink': data = createLink(p.input); break;
      case 'getActivity': data = getActivity(p.id); break;
      case 'deleteLink': data = deleteLink(p.id); break;
      case 'getLink': data = getLink_(p.id); break;
      case 'recordClick': data = recordClick(p.id, p.info); break;
      default: throw new Error('Unknown action.');
    }
    return json_({ success: true, data: data });
  } catch (error) { return json_({ success: false, error: String(error.message || error) }); }
}
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function getLink_(id) {
  return locked_(function () {
    const row = rows_('Links', LINK_HEADERS_).find(function (l) { return String(l[0]) === String(id); });
    if (!row) throw new Error('This tracking link is unavailable.');
    return { id: row[0], label: untext_(row[1]), url: validUrl_(row[2]) };
  });
}
function getDashboard() {
  return locked_(function () {
    const links = rows_('Links', LINK_HEADERS_);
    const clicks = rows_('Clicks', CLICK_HEADERS_);
    const totals = Object.create(null);
    clicks.forEach(function (c) {
      const id = String(c[1]);
      if (!totals[id]) totals[id] = { clicks: 0, bots: 0, unique: {} };
      if (String(c[10]) === 'true') totals[id].bots++;
      else { totals[id].clicks++; totals[id].unique[String(c[3])] = true; }
    });
    return links.reverse().map(function (l) {
      const x = totals[String(l[0])] || { clicks: 0, bots: 0, unique: {} };
      return { id: l[0], label: untext_(l[1]), url: l[2], created: l[3], clicks: x.clicks, bots: x.bots, unique: Object.keys(x.unique).length };
    });
  });
}
function createLink(input) {
  input = input || {};
  const url = validUrl_(input.url);
  const id = String(input.alias || Utilities.getUuid().replace(/-/g, '').slice(0, 12)).trim();
  if (!/^[a-zA-Z0-9_-]{3,60}$/.test(id)) throw new Error('Use 3–60 letters, numbers, underscores or hyphens for the alias.');
  return locked_(function () {
    const existing = rows_('Links', LINK_HEADERS_);
    if (existing.some(function (l) { return String(l[0]) === id; })) throw new Error('This alias already exists.');
    append_('Links', [id, text_(String(input.label || url).slice(0, 120)), url, new Date().toISOString()]);
    return { id: id };
  });
}
function getActivity(id) {
  return locked_(function () {
    return rows_('Clicks', CLICK_HEADERS_).filter(function (c) { return String(c[1]) === String(id); }).slice(-1000).reverse().map(function (c) {
      return { time: c[2], identity: c[4], userAgent: untext_(c[5]), platform: untext_(c[6]), language: untext_(c[7]), timezone: untext_(c[8]), screen: untext_(c[9]), bot: String(c[10]) === 'true', ip: c[11] };
    });
  });
}
function deleteLink(id) {
  return locked_(function () {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    [['Links', LINK_HEADERS_, 0], ['Clicks', CLICK_HEADERS_, 1]].forEach(function (spec) {
      const data = rows_(spec[0], spec[1]);
      const sheet = ss.getSheetByName(spec[0]);
      for (let i = data.length - 1; i >= 0; i--) if (String(data[i][spec[2]]) === String(id)) sheet.deleteRow(i + 2);
    });
    return true;
  });
}
// Public function. Called only after the visitor chooses Continue.
function recordClick(id, info) {
  const cfg = config_();
  info = info || {};
  const visitor = String(info.visitorId || '');
  const event = String(info.eventId || '');
  if (!/^[a-f0-9-]{16,80}$/i.test(visitor) || !/^[a-f0-9-]{16,80}$/i.test(event)) throw new Error('Invalid visit identifier.');
  const ua = String(info.ua || '').slice(0, 1500);
  return locked_(function () {
    const link = rows_('Links', LINK_HEADERS_).find(function (l) { return String(l[0]) === String(id); });
    if (!link) throw new Error('This link is unavailable.');
    const url = validUrl_(link[2]);
    const data = rows_('Clicks', CLICK_HEADERS_);
    // Idempotent retries: a browser retry does not create another click.
    if (!data.some(function (c) { return String(c[0]) === event && String(c[1]) === String(id); })) {
      append_('Clicks', [event, String(id), new Date().toISOString(), hash_(String(id) + ':' + visitor, cfg.secret), info.persistent === true ? 'browser-storage estimate' : 'per-visit fallback', text_(ua), text_(String(info.platform || '').slice(0, 100)), text_(String(info.language || '').slice(0, 100)), text_(String(info.timezone || '').slice(0, 100)), text_(String(info.screen || '').slice(0, 80)), /bot|crawler|spider|headless|preview/i.test(ua) ? 'true' : 'false', 'Unavailable in Apps Script']);
    }
    return { url: url };
  });
}
function config_() {
  const p = PropertiesService.getScriptProperties();
  let secret = p.getProperty('SIGNING_SECRET');
  if (!secret) locked_(function () { secret = p.getProperty('SIGNING_SECRET'); if (!secret) { secret = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SIGNING_SECRET', secret); } });
  return { secret: secret };
}
function hash_(value, secret) { return Utilities.computeHmacSha256Signature(value, secret).map(function (n) { return ('0' + ((n + 256) % 256).toString(16)).slice(-2); }).join(''); }
function locked_(fn) { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { return fn(); } finally { lock.releaseLock(); } }
function validate_(s, headers) { const actual = s.getRange(1, 1, 1, headers.length).getValues()[0]; if (actual.join('\0') !== headers.join('\0')) throw new Error('Unexpected headers in ' + s.getName() + '. No data was overwritten.'); }
function rows_(name, headers) {
  const s = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!s) throw new Error('Run setup in the Apps Script editor first.');
  validate_(s, headers);
  const count = s.getLastRow() - 1;
  if (count > MAX_ROWS_) throw new Error('Archive old records before continuing (50,000-row limit).');
  return count > 0 ? s.getRange(2, 1, count, headers.length).getValues().map(function (row) { return row.map(function (value) { return value instanceof Date ? value.toISOString() : value; }); }) : [];
}
function append_(name, row) {
  const s = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (s.getLastRow() >= MAX_ROWS_ + 1) throw new Error('Archive old records before continuing (50,000-row limit).');
  s.appendRow(row);
  SpreadsheetApp.flush();
}
// Prevent values supplied by visitors from becoming spreadsheet formulas.
function text_(s) { return /^[=+@\-\t\r']/.test(s) ? "'" + s : s; }
function untext_(s) { s = String(s || ''); return /^'[=+@\-\t\r']/.test(s) ? s.slice(1) : s; }
function validUrl_(value) {
  const url = String(value || '').trim();
  // Apps Script has no browser URL constructor. Reject credentials and unsafe schemes.
  if (url.length > 2048 || !/^https?:\/\/[a-z0-9\[\]][^\s<>"'\\]*$/i.test(url) || /^https?:\/\/[^/?#]*@/i.test(url)) throw new Error('Enter an HTTP(S) URL without spaces or embedded credentials.');
  return url;
}
