import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
function runtime(){
const properties=new Map(),cache=new Map();
class Sheet{constructor(name){this.name=name;this.rows=[]}getName(){return this.name}getLastRow(){return this.rows.length}getRange(r,c,n,m){const self=this;return {getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>self.rows[r-1+i]?.[c-1+j]??''))},setValues(v){for(let i=0;i<n;i++){self.rows[r-1+i]??=[];for(let j=0;j<m;j++)self.rows[r-1+i][c-1+j]=v[i][j]}return this},setFontWeight(){return this},setBackground(){return this},setFontColor(){return this}}}setFrozenRows(){}autoResizeColumns(){}appendRow(row){this.rows.push(row)}deleteRow(i){this.rows.splice(i-1,1)}}
const sheets=new Map([['Sheet1',new Sheet('Sheet1')]]);sheets.get('Sheet1').rows=[['preserve me']];
let locked=false;
const context=vm.createContext({console,ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({text,setMimeType(){return this}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false,'nested lock');locked=true},releaseLock(){locked=false}})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet(n);sheets.set(n,s);return s}}),flush(){}},Utilities:{getUuid:randomUUID,computeHmacSha256Signature:(s,key)=>Array.from(createHmac('sha256',key).update(s).digest()),base64EncodeWebSafe:s=>Buffer.from(s).toString('base64url'),base64DecodeWebSafe:s=>Buffer.from(s,'base64url'),newBlob:b=>({getDataAsString:()=>b.toString()})}});
vm.runInContext(readFileSync(new URL('./Code.gs',import.meta.url),'utf8'),context);return {context,sheets,properties};}
test('Apps Script storage without a password, idempotency, uniques and deletion',()=>{
const {context:c,sheets,properties}=runtime();c.setup();c.setup();assert.equal(sheets.get('Sheet1').rows[0][0],'preserve me');
assert.throws(()=>c.createLink({url:'javascript:alert(1)'}),/HTTP/);assert.throws(()=>c.createLink({url:'https://user:pass@example.com'}),/HTTP/);
const url=c.createLink({url:'https://example.com',alias:'campaign',label:'=IMPORTXML("bad")'});assert.equal(url.id,'campaign');assert.equal(sheets.get('Links').rows[1][1].startsWith("'="),true);assert.throws(()=>c.createLink({url:'https://example.com',alias:'campaign'}),/already exists/);
const v={visitorId:randomUUID(),eventId:randomUUID(),persistent:true,ua:'Mozilla Chrome',platform:'Linux',timezone:'Asia/Kuala_Lumpur',screen:'1920×1080'};
assert.equal(c.recordClick('campaign',v).url,'https://example.com');c.recordClick('campaign',v);c.recordClick('campaign',{...v,eventId:randomUUID()});c.recordClick('campaign',{...v,eventId:randomUUID(),visitorId:randomUUID(),ua:'headless bot'});
const d=c.getDashboard()[0];assert.equal(d.clicks,2);assert.equal(d.unique,1);assert.equal(d.bots,1);assert.equal(c.getActivity('campaign').length,3);assert.equal(c.getActivity('campaign')[0].ip,'Unavailable in Apps Script');
c.deleteLink('campaign');assert.equal(c.getDashboard().length,0);assert.equal(sheets.get('Clicks').rows.length,1);assert.throws(()=>c.recordClick('campaign',v),/unavailable/);
});
test('Apps Script refuses unexpected existing headers',()=>{const {context:c,sheets}=runtime();c.setup();sheets.get('Links').rows[0][0]='wrong';assert.throws(()=>c.setup(),/Unexpected headers/);assert.equal(sheets.get('Links').rows[0][0],'wrong')});
test('JSON API works without passwords and initializes tabs automatically',()=>{
const {context:c,sheets}=runtime();
const post=p=>JSON.parse(c.doPost({postData:{contents:JSON.stringify(p)}}).text);
assert.equal(JSON.parse(c.doGet({parameter:{}}).text).data.version,4);
assert.equal(JSON.parse(c.doGet({parameter:{action:'getAll'}}).text).success,false);
assert.equal(post({action:'getAll'}).success,true);assert.ok(sheets.get('Links'));assert.ok(sheets.get('Clicks'));
assert.equal(post({action:'unknown'}).success,false);
assert.equal(JSON.parse(c.doPost({postData:{contents:'not-json'}}).text).success,false);
assert.equal(post({action:'createLink',input:{url:'https://example.com',alias:'public'}}).data.id,'public');
assert.equal(post({action:'getLink',id:'public'}).data.url,'https://example.com');
const info={visitorId:randomUUID(),eventId:randomUUID(),persistent:true,ua:'Mozilla Chrome'};
assert.equal(post({action:'recordClick',id:'public',info}).success,true);
const rows=post({action:'getAll'});assert.equal(rows.data[0].clicks,1);assert.equal(rows.data[0].unique,1);
assert.equal(post({action:'getActivity',id:'public'}).data.length,1);
assert.equal(post({action:'deleteLink',id:'public'}).success,true);
});
