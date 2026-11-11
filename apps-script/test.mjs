import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
function runtime(){
const properties=new Map([['ADMIN_PASSWORD','long-test-password-123']]),cache=new Map();
class Sheet{constructor(name){this.name=name;this.rows=[]}getName(){return this.name}getLastRow(){return this.rows.length}getRange(r,c,n,m){const self=this;return {getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>self.rows[r-1+i]?.[c-1+j]??''))},setValues(v){for(let i=0;i<n;i++){self.rows[r-1+i]??=[];for(let j=0;j<m;j++)self.rows[r-1+i][c-1+j]=v[i][j]}return this},setFontWeight(){return this},setBackground(){return this},setFontColor(){return this}}}setFrozenRows(){}autoResizeColumns(){}appendRow(row){this.rows.push(row)}deleteRow(i){this.rows.splice(i-1,1)}}
const sheets=new Map([['Sheet1',new Sheet('Sheet1')]]);sheets.get('Sheet1').rows=[['preserve me']];
let locked=false;
const context=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false,'nested lock');locked=true},releaseLock(){locked=false}})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet(n);sheets.set(n,s);return s}}),flush(){}},Utilities:{getUuid:randomUUID,computeHmacSha256Signature:(s,key)=>Array.from(createHmac('sha256',key).update(s).digest()),base64EncodeWebSafe:s=>Buffer.from(s).toString('base64url'),base64DecodeWebSafe:s=>Buffer.from(s,'base64url'),newBlob:b=>({getDataAsString:()=>b.toString()})}});
vm.runInContext(readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),context);return {context,sheets,properties};}
test('Apps Script storage, auth, idempotency, uniques and deletion',()=>{
const {context:c,sheets,properties}=runtime();c.setup();c.setup();assert.equal(sheets.get('Sheet1').rows[0][0],'preserve me');assert.throws(()=>c.getDashboard(''),/sign in/);assert.throws(()=>c.login('wrong'),/Incorrect/);const token=c.login('long-test-password-123');
assert.throws(()=>c.createLink(token,{url:'javascript:alert(1)'}),/HTTP/);assert.throws(()=>c.createLink(token,{url:'https://user:pass@example.com'}),/HTTP/);
const url=c.createLink(token,{url:'https://example.com',alias:'campaign',label:'=IMPORTXML("bad")'});assert.match(url,/\?r=campaign$/);assert.equal(sheets.get('Links').rows[1][1].startsWith("'="),true);assert.throws(()=>c.createLink(token,{url:'https://example.com',alias:'campaign'}),/already exists/);
const v={visitorId:randomUUID(),eventId:randomUUID(),persistent:true,ua:'Mozilla Chrome',platform:'Linux',timezone:'Asia/Kuala_Lumpur',screen:'1920×1080'};
assert.equal(c.recordClick('campaign',v).url,'https://example.com');c.recordClick('campaign',v);c.recordClick('campaign',{...v,eventId:randomUUID()});c.recordClick('campaign',{...v,eventId:randomUUID(),visitorId:randomUUID(),ua:'headless bot'});
const d=c.getDashboard(token)[0];assert.equal(d.clicks,2);assert.equal(d.unique,1);assert.equal(d.bots,1);assert.equal(c.getActivity(token,'campaign').length,3);assert.equal(c.getActivity(token,'campaign')[0].ip,'Unavailable in Apps Script');
properties.set('ADMIN_PASSWORD','rotated-password-1234');assert.throws(()=>c.getDashboard(token),/sign in/);const next=c.login('rotated-password-1234');c.deleteLink(next,'campaign');assert.equal(c.getDashboard(next).length,0);assert.equal(sheets.get('Clicks').rows.length,1);assert.throws(()=>c.recordClick('campaign',v),/unavailable/);
});
test('Apps Script refuses unexpected existing headers',()=>{const {context:c,sheets}=runtime();c.setup();sheets.get('Links').rows[0][0]='wrong';assert.throws(()=>c.setup(),/Unexpected headers/);assert.equal(sheets.get('Links').rows[0][0],'wrong')});
test('browser script syntax and hostile query escaping',()=>{let html=readFileSync(new URL('./Index.html',import.meta.url),'utf8');assert.equal((html.match(/<\?/g)||[]).length,1);const code=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/<\?!=.*?\?>/,JSON.stringify('</script><script>alert(1)</script>').replace(/</g,'\\u003c'));new Function(code);assert.equal(code.includes('</script>'),false)});
