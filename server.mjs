import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeBuilds} from './logic.mjs';
import {syncZX,chinaDay} from './zx-sync.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
try {const env=await fs.readFile(path.join(root,'.env'),'utf8');for(const line of env.split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim();}}catch{}
const cache=new Map(),inflight=new Map();
let zxPending=null,zxLastAttempt=0;
async function zxSnapshot(lv){
 let saved;try{saved=JSON.parse(await fs.readFile(path.join(root,'data/zxfps-latest.json'),'utf8'));}catch{}
 const age=saved?Date.now()-Date.parse(saved.fetchedAt):Infinity;
 if((!saved||age>1800000)&&Date.now()-zxLastAttempt>60000&&!zxPending){zxLastAttempt=Date.now();zxPending=syncZX().finally(()=>{zxPending=null;});}
 if(!saved&&zxPending){try{saved=await zxPending;}catch{throw Error('准星同步失败，请稍后重试或查看来源网站');}}
 else if(zxPending)zxPending.catch(()=>{});
 if(!saved)throw Error('尚未取得准星数据，请稍后刷新');
 const today=chinaDay(saved.fetchedAt)===chinaDay(Date.now());
 return {...saved,mode:today?'live':'stale',builds:saved.builds.filter(b=>b.lv===lv),crafts:today?saved.crafts:[],syncing:Boolean(zxPending),errors:today?[]:['当前是历史快照，正在尝试更新；制造数据不计入当天排行。']};
}
async function query(endpoint,params) {
 const url=new URL('https://orzice.com/workApi/v1/sjz_api/'+endpoint);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 url.searchParams.set('token',process.env.DELTA_API_TOKEN);
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'DeltaDaily/1.0'}});
 if(!response.ok)throw Error('数据服务请求失败，请检查密钥和接口权限');
 const j=await response.json();if(j.code!==0||!Array.isArray(j.data))throw Error('数据服务未返回有效行情，请检查密钥、额度和接口权限');
 return j.data;
}
async function snapshot(lv,level) {
 const key=`${lv}:${level}`,old=cache.get(key);if(old&&Date.now()-old.time<600000)return old.value;
 if(inflight.has(key))return inflight.get(key);
 const promise=(async()=>{
  const results=await Promise.allSettled([query('jzv4_zb',{lv}),...[1,2,3,4].map(t=>query('manufacturePro',{t,l:level}))]);
  const stations=['技术中心','工作台','制药台','防具台'],crafts=[],errors=[];
  let builds=[];
  results.forEach((r,i)=>{if(r.status==='rejected'){errors.push(`${i?stations[i-1]:'卡战备'}：${r.reason.message}`);return;}
   if(i===0){builds=normalizeBuilds(r.value);return;}
   for(const x of r.value)if(Number.isFinite(x.price)&&Number.isFinite(x.price_hour)&&Number.isFinite(x.period)&&x.period>0&&x.unlockLevel<=level)crafts.push({name:x.name,station:stations[i-1],profit:x.price,hourly:x.price_hour,hours:x.period,level:x.unlockLevel,sourceTime:null});
  });
  if(results.every(x=>x.status==='rejected'))throw Error('行情获取失败。请检查接口密钥、额度和网络后重试。');
  const value={mode:'live',fetchedAt:new Date().toISOString(),builds,crafts,errors,source:'三角洲数据帝 / manufacturePro + jzv4_zb'};
  cache.set(key,{time:Date.now(),value});return value;
 })();inflight.set(key,promise);try{return await promise;}finally{inflight.delete(key);}
}
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/api/daily'){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const lv=u.searchParams.get('lv')??'0',level=u.searchParams.get('level')??'3';
  if(!['0','1','2','3','5'].includes(lv)||!['1','2','3'].includes(level)){res.writeHead(400);res.end(JSON.stringify({error:'筛选参数无效'}));return;}
  try{res.end(JSON.stringify(process.env.DATA_SOURCE==='orzice'?(process.env.DELTA_API_TOKEN?await snapshot(lv,level):{mode:'unconfigured',builds:[],crafts:[],errors:[]}):await zxSnapshot(lv)));}catch{res.writeHead(502);res.end(JSON.stringify({error:'行情同步失败，请稍后重试或打开数据来源网站核对。'}));}return;
 }
 if(u.pathname==='/api/source/refresh'&&req.method==='POST'){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  try{const s=await refreshZXNow();res.end(JSON.stringify({ok:true,fetchedAt:s.fetchedAt}));}catch{res.writeHead(502);res.end(JSON.stringify({ok:false,error:'同步失败，请稍后重试。'}));}return;
 }
 const files={'/':'index.html','/index.html':'index.html','/app.mjs':'app.mjs','/logic.mjs':'logic.mjs','/style.css':'style.css'};
 const file=files[u.pathname];if(!file){res.writeHead(404);res.end('Not found');return;}
 try{const body=await fs.readFile(path.join(root,file));res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.mjs')?'text/javascript':'text/html; charset=utf-8');res.end(body);}catch{res.writeHead(500);res.end('Unable to load page');}
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 server.listen(Number(process.env.PORT)||3211,process.env.HOST||'127.0.0.1',()=>console.log('kuaika.com：http://localhost:'+(process.env.PORT||3211)));
 if(process.env.DATA_SOURCE!=='orzice'){
  zxSnapshot('0').catch(()=>{});
  setInterval(()=>zxSnapshot('0').catch(()=>{}),1800000).unref();
 }
}
export async function refreshZXNow(){
 if(process.env.DATA_SOURCE==='orzice')throw Error('当前使用的是其他数据源');
 if(!zxPending){zxLastAttempt=Date.now();zxPending=syncZX().finally(()=>{zxPending=null;});}
 return zxPending;
}
