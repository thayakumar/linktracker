import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function moduleAt(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace('import.meta.env.VITE_GOOGLE_SCRIPT_URL', 'undefined');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
}
const { createSheetsApi, DEFAULT_SCRIPT_URL } = await moduleAt('../src/lib/sheets-api.ts');
const { trackingUrl, activityCsv, classify } = await moduleAt('../src/lib/analytics.ts');
test('Apps Script fetch uses preflight-free POST bodies without login or tokens', async () => {
  const calls = [];
  const api = createSheetsApi(DEFAULT_SCRIPT_URL, async (url, init) => { calls.push({ url, ...init }); return new Response(JSON.stringify({ success: true, data: [] })); });
  await api.dashboard(); await api.create( { label: 'Test', alias: 'test', url: 'https://example.com' }); await api.activity( 'test'); await api.delete( 'test'); await api.link('test'); await api.record('test', { eventId: 'event' });
  assert.deepEqual(calls.map(c => JSON.parse(c.body).action), ['getAll','createLink','getActivity','deleteLink','getLink','recordClick']);
  for (const call of calls) { assert.equal(call.method, 'POST'); assert.equal(call.headers, undefined); assert.equal(call.credentials, 'omit'); assert.equal(call.url.includes('password'), false); assert.equal(call.url.includes('token'), false); }
  for (const call of calls) assert.equal('token' in JSON.parse(call.body),false);
});
test('API failures never report a confirmed save', async () => {
  for (const [response, expected] of [[new Response('<html>Old deployment</html>'), /web page instead of JSON/], [new Response(JSON.stringify({ success: false, error: 'Backend error' })), /Backend error/], [new Response('{}'), /did not confirm/], [new Response('',{status:403}), /403/]]) {
    await assert.rejects(createSheetsApi(DEFAULT_SCRIPT_URL, async () => response).dashboard(), expected);
  }
  await assert.rejects(createSheetsApi(DEFAULT_SCRIPT_URL, async () => { throw Error('network') }).dashboard(), /Could not reach/);
});
test('tracking URLs use GitHub Pages frontend and do not leak existing queries', () => {
  assert.equal(trackingUrl('summer_launch', 'https://thayakumar.github.io/linktracker/?old=secret#hash'), 'https://thayakumar.github.io/linktracker/?r=summer_launch');
});
test('CSV neutralizes formula values and classification handles common browsers', () => {
  const csv = activityCsv([{ time: '2026-11-11T00:00:00Z', userAgent: '=IMPORTXML("bad")', language: 'en', identity: 'browser', platform: 'Linux', timezone: 'UTC', screen: '1×1', bot: false, ip: 'Unavailable' }]);
  assert.ok(csv.includes('"\'=IMPORTXML(""bad"")"'));
  assert.equal(classify('Mozilla Windows Chrome/120 Edg/120'), 'Desktop / other · Windows · Edge');
});

test('old password backend shows deployment instructions',async()=>{
const api=createSheetsApi(DEFAULT_SCRIPT_URL,async()=>new Response(JSON.stringify({success:false,error:'Set ADMIN_PASSWORD'})));
await assert.rejects(api.dashboard(),/older login version/);
});

const { createRedirectRequest } = await moduleAt('../src/lib/redirect.ts');
test('automatic redirect shares one recording request and uses its destination', async () => {
  let calls=0;
  const info={eventId:'same-event'};
  const resolve=createRedirectRequest('test',info,async(id,event)=>{calls++;assert.equal(event,info);return {url:'https://example.com/path'}},async()=>{throw Error('unneeded lookup')});
  const [a,b]=await Promise.all([resolve(),resolve()]);assert.equal(calls,1);assert.equal(a,'https://example.com/path');assert.equal(b,a);
});
test('automatic redirect falls back when logging fails and rejects unsafe destinations', async () => {
  const resolve=createRedirectRequest('test',{},async()=>{throw Error('logging unavailable')},async()=>({url:'https://example.com/fallback'}));assert.equal(await resolve(),'https://example.com/fallback');
  const invalid=createRedirectRequest('test',{},async()=>({url:'javascript:alert(1)'}),async()=>({url:'https://example.com'}));await assert.rejects(invalid(),/Invalid destination/);
});
