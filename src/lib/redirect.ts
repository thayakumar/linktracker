import type { VisitorInfo } from './sheets-api';
// Reuse the pending request across React effect replays. A retry retains its event ID.
export function createRedirectRequest(
  id: string,
  info: VisitorInfo,
  record: (id: string, info: VisitorInfo) => Promise<{ url: string }>,
  lookup: (id: string) => Promise<{ url: string }>,
) {
  let pending: Promise<string> | undefined;
  const validate = (value: string) => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid destination.');
    return url.href;
  };
  return () => {
    if (!pending) pending = record(id, info).catch(() => lookup(id)).then(result => validate(result.url)).catch(error => { pending = undefined; throw error; });
    return pending;
  };
}
