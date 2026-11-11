import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { sheetsApi, type Activity, type LinkRecord, type VisitorInfo } from './lib/sheets-api';
import { activityCsv, classify, makeVisitorInfo, trackingUrl } from './lib/analytics';
import './style.css';

function App() {
  const linkId = new URLSearchParams(location.search).get('r');
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activity, setActivity] = useState<{ id: string; rows: Activity[] } | null>(null);
  const [destination, setDestination] = useState<{ label: string; url: string } | null>(null);
  const [loadingLink, setLoadingLink] = useState(!!linkId);
  const [recorded, setRecorded] = useState(false);
  const visitorInfo = useRef<VisitorInfo | null>(null);
  const inFlight = useRef(false);
  const activityPanel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!linkId) {
      let active = true; setBusy(true);
      sheetsApi.dashboard().then(rows => { if (active) setLinks(rows); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
      return () => { active = false; };
    }
    let active = true;
    sheetsApi.link(linkId).then(link => { if (active) setDestination(link); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoadingLink(false); });
    return () => { active = false; };
  }, [linkId]);

  async function run(fn: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function refresh() { setLinks(await sheetsApi.dashboard()); }
  async function copy(id: string) {
    const value = trackingUrl(id);
    try { await navigator.clipboard.writeText(value); setMessage('Tracking link copied.'); }
    catch { setMessage('Copy this link: ' + value); }
  }
  function download() {
    if (!activity) return;
    const objectUrl = URL.createObjectURL(new Blob([activityCsv(activity.rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = objectUrl; a.download = activity.id + '-activity.csv'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }

  return <><header><a className="brand" href={import.meta.env.BASE_URL}>↗ Link<span>Scope</span></a><span className="header-note">A clearer picture of every click</span></header><main>
    {linkId ? <section className="panel narrow">
      <div className="eyebrow">TRACKED LINK</div><h1>{loadingLink ? 'Finding your destination…' : destination ? 'One step to your destination.' : 'Link unavailable.'}</h1>
      {destination && <><p>You’re heading to <strong>{new URL(destination.url).hostname}</strong>.</p><p>When you press Continue, we record the timestamp, browser and device information, language, timezone and screen size. A random ID saved in this browser helps estimate unique visits.</p><p className="note">Your IP address, precise location and exact device name are unavailable. You can close this page without recording a visit.</p>
        {recorded ? <a className="button" href={destination.url} rel="noreferrer noopener">Open destination ↗</a> : <button disabled={busy} onClick={() => run(async () => {
          if (!visitorInfo.current) visitorInfo.current = makeVisitorInfo();
          const result = await sheetsApi.record(linkId, visitorInfo.current);
          if (!/^https?:\/\//i.test(result.url)) throw new Error('The destination URL is invalid.');
          setDestination({ ...destination, url: result.url }); setRecorded(true); setMessage('Visit recorded. Opening your destination…'); window.location.assign(result.url);
        })}>{busy ? 'Recording your visit…' : 'Continue to destination ↗'}</button>}
        <p className="url">Destination: {destination.url}</p></>}
      {!destination && !loadingLink && <p>This link may have been deleted, or the backend may need updating. {error ? 'See the message below.' : ''}</p>}
    </section> : <>
      <div className="eyebrow">LINK ANALYTICS</div><h1>Every link has a story.</h1><p>Create a custom link. See when and how people continue to your destination.</p>
      <div className="stats"><div className="stat"><strong>{links.length}</strong><span>Active links</span></div><div className="stat"><strong>{links.reduce((n, l) => n + l.clicks, 0)}</strong><span>Tracked continuations</span></div><div className="stat"><strong>{links.reduce((n, l) => n + l.unique, 0)}</strong><span>Estimated uniques across links*</span></div></div>
      <div className="grid"><section className="panel"><h2>Create a tracking link</h2><form onSubmit={e => { e.preventDefault(); run(async () => {
        const target = new URL(url); if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Use an HTTP(S) URL without embedded credentials.');
        const link = await sheetsApi.create( { label, url: target.href, alias }); setLabel(''); setUrl(''); setAlias(''); setMessage('Created: ' + trackingUrl(link.id)); await refresh();
      }); }}><label htmlFor="label">Link label</label><input id="label" placeholder="My campaign" maxLength={120} value={label} onChange={e => setLabel(e.target.value)} disabled={busy}/><label htmlFor="url">Destination URL</label><input id="url" type="url" placeholder="https://example.com" required value={url} onChange={e => setUrl(e.target.value)} disabled={busy}/><label htmlFor="alias">Custom alias <small>(optional)</small></label><input id="alias" placeholder="my-campaign" pattern="[a-zA-Z0-9_-]{3,60}" value={alias} onChange={e => setAlias(e.target.value)} disabled={busy}/><button className="full" disabled={busy}>Create tracking link ↗</button></form><p className="note">Visits are counted after the visitor presses Continue on the tracking notice. Initial opens are not counted.</p></section>
      <section className="panel"><div className="top"><h2>Your links</h2><button className="secondary" disabled={busy} onClick={() => run(refresh)}>Refresh</button></div>
        {links.length ? links.map(l => <article className="link" key={l.id}><strong>{l.label}</strong><p className="url">{trackingUrl(l.id)}</p><p className="url">→ {l.url}</p><div className="counts">{l.clicks} continuations · {l.unique} unique · {l.bots} likely bots</div><div className="actions"><button className="secondary" disabled={busy} onClick={() => copy(l.id)}>Copy link</button><button disabled={busy} onClick={() => run(async () => { const rows = await sheetsApi.activity( l.id); setActivity({ id: l.id, rows }); requestAnimationFrame(() => activityPanel.current?.scrollIntoView({ behavior: 'smooth' })); })}>View activity</button><button className="danger" disabled={busy} onClick={() => { if (confirm('Delete this link and all its recorded activity?')) run(async () => { await sheetsApi.delete( l.id); setActivity(null); await refresh(); }); }}>Delete</button></div></article>) : <div className="empty"><h2>Your next click starts here.</h2><p>Create your first link to begin collecting activity.</p></div>}
      </section></div><p className="note">*Unique browsers are estimated per link from a random browser ID. The total sums each link’s unique visitors; it is not a global person count. Different browsers or cleared storage count separately. If storage is blocked, each visit may count as unique. Bots that do not continue are not counted. Browser details can be spoofed.</p>
      {activity && <section className="panel activity" ref={activityPanel}><div className="top"><h2>Activity · {activity.id}</h2><button className="secondary" onClick={download}>Export CSV ↗</button></div><p className="note">Latest 1,000 continuations. Times display in your timezone; CSV uses UTC. IP addresses are unavailable in Apps Script.</p>{activity.rows.length ? <table><thead><tr><th>Time</th><th>Device / browser</th><th>Language / timezone / screen</th><th>Identity quality</th><th>Type</th></tr></thead><tbody>{activity.rows.map((c, i) => <tr key={i}><td>{new Date(c.time).toLocaleString()}</td><td>{classify(c.userAgent)}<details><summary>Raw user agent</summary>{c.userAgent}</details>{c.platform}</td><td>{c.language}<br/>{c.timezone}<br/>{c.screen}</td><td>{c.identity}</td><td>{c.bot ? 'Likely bot' : 'Browser'}</td></tr>)}</tbody></table> : <p>No visits yet.</p>}</section>}
    </>}
    <div className="messages" aria-live="polite" role="status">{error && <p className="error">{error}</p>}{message && <p>{message}</p>}</div>
  </main><footer>LinkScope · Built for useful insights, with Google Sheets.</footer></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
