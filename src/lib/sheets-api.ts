export const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoHl0lEeGCeMOlOX8JDBvjy8NypwmnQaNRM_ZtRPHwtzAtFbwS_c34av24GahIfNz3/exec';
export type LinkRecord = { id: string; label: string; url: string; created: string; clicks: number; bots: number; unique: number };
export type Activity = { time: string; identity: string; userAgent: string; platform: string; language: string; timezone: string; screen: string; bot: boolean; ip: string };
export type VisitorInfo = { visitorId: string; eventId: string; persistent: boolean; ua: string; platform: string; language: string; timezone: string; screen: string };
export function createSheetsApi(scriptUrl: string, fetcher: typeof fetch = fetch) {
  async function request<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(scriptUrl)) throw new Error('Configure a valid Google Apps Script /exec URL.');
    let response: Response;
    try {
      // A string body uses text/plain. No application/json header or CORS preflight.
      // Admin credentials stay in POST bodies, never URLs or frontend environment variables.
      response = await fetcher(scriptUrl, { method: 'POST', body: JSON.stringify({ action, ...payload }), credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(25000) });
    } catch {
      throw new Error('Could not reach Apps Script. Check your connection and that its web app is deployed for Anyone. Retry if needed.');
    }
    if (!response.ok) throw new Error(`Apps Script request failed (${response.status}).`);
    let result: { success?: boolean; data?: T; error?: string };
    try { result = await response.json(); }
    catch { throw new Error('Apps Script returned a web page instead of JSON. Replace Code.gs with the API version and deploy a new version.'); }
    if (result?.success !== true) throw new Error(result?.error || 'Apps Script did not confirm this request. Update its Code.gs and redeploy.');
    return result.data as T;
  }
  return {
    login: (password: string) => request<string>('login', { password }),
    dashboard: (token: string) => request<LinkRecord[]>('getAll', { token }),
    create: (token: string, input: { label: string; url: string; alias: string }) => request<{ id: string }>('createLink', { token, input }),
    activity: (token: string, id: string) => request<Activity[]>('getActivity', { token, id }),
    delete: (token: string, id: string) => request<boolean>('deleteLink', { token, id }),
    link: (id: string) => request<{ id: string; label: string; url: string }>('getLink', { id }),
    record: (id: string, info: VisitorInfo) => request<{ url: string }>('recordClick', { id, info }),
  };
}
export const sheetsApi = createSheetsApi(import.meta.env.VITE_GOOGLE_SCRIPT_URL || DEFAULT_SCRIPT_URL);
