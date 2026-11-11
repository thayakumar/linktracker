import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const password=process.env.ADMIN_PASSWORD;
if(!password || password.length<16) throw Error('Set ADMIN_PASSWORD to at least 16 characters.');
const dir=process.env.DATA_DIR||'data'; mkdirSync(dir,{recursive:true,mode:0o700});
const db=new DatabaseSync(`${dir}/links.sqlite`);
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE IF NOT EXISTS links(id TEXT PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS clicks(id INTEGER PRIMARY KEY,link TEXT NOT NULL,at TEXT NOT NULL,visitor TEXT NOT NULL,ip TEXT,ua TEXT,referrer TEXT,language TEXT,bot INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS click_link ON clicks(link,at);`);
let secret=db.prepare("SELECT value FROM settings WHERE key='secret'").get()?.value;
if(!secret){secret=randomBytes(32).toString('hex');db.prepare('INSERT INTO settings VALUES (?,?)').run('secret',secret);}
const sessions=new Map(),attempts=new Map();
const mac=s=>createHmac('sha256',secret).update(s).digest('hex');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const botRE=/bot|crawler|spider|preview|facebookexternalhit|slackbot|headless|curl|wget/i;
const html=readFileSync(fileURLToPath(new URL('./index.html',import.meta.url)));
const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Request too large');}return JSON.parse(raw||'{}');}
const safeEqual=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function ipOf(req){return process.env.TRUST_PROXY==='true'?(req.headers['x-forwarded-for']?.split(',')[0].trim()||req.socket.remoteAddress):req.socket.remoteAddress;}
function originOf(req){return process.env.PUBLIC_ORIGIN||`http://${req.headers.host}`;}
function authed(req){const id=/\bls_session=([a-f0-9]+)/.exec(req.headers.cookie||'')?.[1];const expiry=sessions.get(id);return expiry && expiry>Date.now();}
const server=http.createServer(async(req,res)=>{try{
res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
const u=new URL(req.url,'http://local'); const ip=ipOf(req)||'unknown';
if(['POST','DELETE'].includes(req.method)&&req.headers.origin!==originOf(req))return json(res,403,{error:'Origin not allowed'});
if(u.pathname==='/api/login'&&req.method==='POST'){
const now=Date.now(),a=attempts.get(ip)||{n:0,until:now+900000};if(a.until<now){a.n=0;a.until=now+900000;}if(a.n>=10)return json(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
const b=await body(req);if(!safeEqual(String(b.password||''),password)){a.n++;attempts.set(ip,a);return json(res,401,{error:'Incorrect password'});}
attempts.delete(ip);const token=randomBytes(32).toString('hex');sessions.set(token,now+28800000);res.setHeader('Set-Cookie',`ls_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${originOf(req).startsWith('https:')?'; Secure':''}`);return json(res,200,{ok:true});}
if(u.pathname==='/api/logout'&&req.method==='POST'){const id=/\bls_session=([a-f0-9]+)/.exec(req.headers.cookie||'')?.[1];sessions.delete(id);res.setHeader('Set-Cookie','ls_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
if(u.pathname.startsWith('/api/')){
if(!authed(req))return json(res,401,{error:'Sign in required'});
if(u.pathname==='/api/links'&&req.method==='GET'){const links=db.prepare(`SELECT l.*,COUNT(c.id) AS requests,COALESCE(SUM(CASE WHEN c.bot=0 THEN 1 ELSE 0 END),0) AS clicks,COUNT(DISTINCT CASE WHEN c.bot=0 THEN c.visitor END) AS uniqueClicks,MAX(c.at) AS lastClick FROM links l LEFT JOIN clicks c ON c.link=l.id GROUP BY l.id ORDER BY l.created DESC`).all();return json(res,200,{links,origin:originOf(req)});}
if(u.pathname==='/api/links'&&req.method==='POST'){const b=await body(req);let target;try{target=new URL(b.url);}catch{return json(res,400,{error:'Enter a valid URL'});}if(!['http:','https:'].includes(target.protocol)||target.username||target.password)return json(res,400,{error:'Use an HTTP or HTTPS URL without embedded credentials'});
const id=b.slug?.trim()||randomBytes(6).toString('base64url');if(!/^[a-zA-Z0-9_-]{3,60}$/.test(id))return json(res,400,{error:'Alias needs 3–60 letters, numbers, underscores or hyphens'});if(db.prepare('SELECT id FROM links WHERE id=?').get(id))return json(res,409,{error:'Alias already exists'});
db.prepare('INSERT INTO links VALUES (?,?,?,?)').run(id,String(b.title||target.hostname).slice(0,120),target.href,new Date().toISOString());return json(res,201,{id});}
const m=/^\/api\/links\/([\w-]+)(\/export)?$/.exec(u.pathname);if(m){if(!db.prepare('SELECT id FROM links WHERE id=?').get(m[1]))return json(res,404,{error:'Link not found'});
if(req.method==='DELETE'){db.exec('BEGIN');try{db.prepare('DELETE FROM clicks WHERE link=?').run(m[1]);db.prepare('DELETE FROM links WHERE id=?').run(m[1]);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});}
if(req.method==='GET'){const rows=db.prepare('SELECT at,ip,ua,referrer,language,bot FROM clicks WHERE link=? ORDER BY id DESC LIMIT 10000').all(m[1]);if(m[2]){const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';res.writeHead(200,{'Content-Type':'text/csv','Content-Disposition':`attachment; filename="${m[1]}-clicks.csv"`});return res.end(['timestamp,ip,user_agent,referrer,language,likely_bot',...rows.map(r=>Object.values(r).map(cell).join(','))].join('\r\n'));}return json(res,200,{clicks:rows});}}
return json(res,404,{error:'Not found'});}
const m=/^\/r\/([\w-]+)$/.exec(u.pathname);
if(m&&['GET','HEAD'].includes(req.method)){
const link=db.prepare('SELECT * FROM links WHERE id=?').get(m[1]);if(!link){res.writeHead(404);return res.end('This tracking link is unavailable.');}
if(req.method==='HEAD'){res.writeHead(200,{'Content-Type':'text/html'});return res.end();}
const ua=String(req.headers['user-agent']||'').slice(0,2048),isBot=botRE.test(ua)?1:0;
db.prepare('INSERT INTO clicks(link,at,visitor,ip,ua,referrer,language,bot) VALUES (?,?,?,?,?,?,?,?)').run(link.id,new Date().toISOString(),mac(`${link.id}\0${ip}\0${ua}`),ip,ua,String(req.headers.referer||'').slice(0,2048),String(req.headers['accept-language']||'').slice(0,256),isBot);
res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Continue to ${esc(new URL(link.url).hostname)}</title><style>body{font:17px system-ui;background:#f4f6f3;color:#19372c;padding:10vh 24px}main{max-width:540px;margin:auto;background:white;padding:36px;border-radius:20px}a{display:inline-block;background:#195c43;color:white;padding:14px 22px;border-radius:10px;text-decoration:none}p{line-height:1.6;overflow-wrap:anywhere}</style><main><p>LINKSCOPE · TRACKED LINK</p><h1>You’re heading to ${esc(new URL(link.url).hostname)}</h1><p>This visit has been logged, including its timestamp, IP address, browser information, language and referring page when provided. No precise location or device name is available.</p><a rel="noreferrer noopener" href="${esc(link.url)}">Continue to destination ↗</a><p>Destination: ${esc(link.url)}</p></main>`);}
if(u.pathname==='/'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html);}res.writeHead(404);res.end('Not found');
}catch(e){console.error(e.message);if(!res.headersSent)json(res,500,{error:'Unable to complete request'});else res.end();}});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('LinkScope listening'));
setInterval(()=>{const now=Date.now();for(const [k,v] of sessions)if(v<now)sessions.delete(k);for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);},60000).unref();
