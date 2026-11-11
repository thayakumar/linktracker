import type { Activity, VisitorInfo } from './sheets-api';
export function trackingUrl(id: string, currentUrl = location.href): string {
  const url = new URL(currentUrl); url.search = ''; url.hash = ''; url.searchParams.set('r', id); return url.href;
}
export function classify(ua: string): string {
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS / iPadOS' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
  return `${/iPad|Tablet/.test(ua) ? 'Tablet' : /Mobile|Android|iPhone/.test(ua) ? 'Mobile' : 'Desktop / other'} · ${os} · ${browser}`;
}
export function makeVisitorInfo(): VisitorInfo {
  let visitorId: string = crypto.randomUUID();
  let persistent = false;
  try {
    const key = 'linkscope-browser-v1'; const old = localStorage.getItem(key);
    if (old && /^[a-f0-9-]{16,80}$/i.test(old)) visitorId = old;
    localStorage.setItem(key, visitorId); persistent = localStorage.getItem(key) === visitorId;
  } catch { /* Without storage, count each visit independently. */ }
  let timezone = 'Unavailable'; try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* Optional browser field. */ }
  return { visitorId, eventId: crypto.randomUUID(), persistent, ua: navigator.userAgent || '', platform: navigator.platform || '', language: navigator.language || '', timezone, screen: `${screen.width}×${screen.height} @${window.devicePixelRatio}` };
}
export function activityCsv(rows: Activity[]): string {
  const keys: (keyof Activity)[] = ['time', 'identity', 'userAgent', 'platform', 'language', 'timezone', 'screen', 'bot', 'ip'];
  const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  return [keys.join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n');
}
