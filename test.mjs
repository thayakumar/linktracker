import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
test('protected analytics, tracking, uniqueness, bot exclusion, export and deletion',async()=>{
const dir=mkdtempSync(tmpdir()+'/linkscope-'),origin='http://127.0.0.1:31991';
const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'31991',ADMIN_PASSWORD:'test-password-long-enough',DATA_DIR:dir,PUBLIC_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
child.stderr.on('data', b=>process.stderr.write(b));
try{await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited')})]);
let r=await fetch(origin+'/api/links');assert.equal(r.status,401);
r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'});assert.equal(r.status,403);
r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({password:'test-password-long-enough'})});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];const headers={Origin:origin,Cookie:cookie};
r=await fetch(origin+'/api/links',{method:'POST',headers,body:JSON.stringify({url:'javascript:alert(1)'})});assert.equal(r.status,400);
r=await fetch(origin+'/api/links',{method:'POST',headers,body:JSON.stringify({url:'https://example.com',slug:'launch'})});assert.equal(r.status,201);
await fetch(origin+'/r/launch',{method:'HEAD'});
for(let i=0;i<2;i++){r=await fetch(origin+'/r/launch',{headers:{'User-Agent':'Mozilla/5.0 Chrome/120'}});assert.equal(r.status,200);assert.match(await r.text(),/This visit has been logged/);}
await fetch(origin+'/r/launch',{headers:{'User-Agent':'Slackbot preview'}});
r=await fetch(origin+'/api/links',{headers});let b=await r.json();assert.equal(b.links[0].uniqueClicks,1);assert.equal(b.links[0].clicks,2);assert.equal(b.links[0].requests,3);
r=await fetch(origin+'/api/links/launch',{headers});b=await r.json();assert.equal(b.clicks.length,3);assert.ok(b.clicks[0].ip);assert.ok(b.clicks[0].at);
r=await fetch(origin+'/api/links/launch/export',{headers});assert.equal(r.headers.get('content-type'),'text/csv');assert.match(await r.text(),/user_agent/);
r=await fetch(origin+'/api/links/launch',{method:'DELETE',headers});assert.equal(r.status,200);assert.equal((await fetch(origin+'/r/launch')).status,404);
}finally{child.kill();await once(child,'exit');rmSync(dir,{recursive:true,force:true});}});
