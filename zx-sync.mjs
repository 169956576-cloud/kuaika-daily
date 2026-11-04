import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export const sourceURL='https://tool.zxfps.com';
export const chinaDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
export function normalizeZXBuilds(raw,lv){
 if(!['0','1','2','3','5'].includes(String(lv)))throw Error('来源战备档位无效');
 const stamp=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw?.time??'')?new Date(raw.time.replace(' ','T')+'+08:00').toISOString():null;
 return (raw?.data??[]).filter(b=>Number.isFinite(b.price)&&Number.isFinite(b.jz)&&Number.isFinite(b.cz)&&Array.isArray(b.data)).map(b=>({name:b.name,cost:b.price,value:b.jz,threshold:b.price-b.cz,lv:String(lv),sourceTime:stamp,items:b.data.map(i=>({name:i.name,price:i.price,type:i.type})),source:'准星工具站'})).sort((a,b)=>a.cost-b.cost);
}
export function normalizeZXCrafts(raw,station){return raw.filter(x=>Number.isFinite(x.price)&&Number.isFinite(x.price_hour)&&Number.isFinite(x.period)&&x.period>0).map(x=>({name:x.name,station,profit:x.price,hourly:x.price_hour,hours:x.period,level:null,sourceTime:null,source:'准星工具站'}));}
async function getPlaywright(){
 const local=createRequire(import.meta.url);try{return local('playwright');}catch{}
 const bundled=path.join(process.env.USERPROFILE??'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.cjs');
 try{return createRequire(bundled)('playwright');}catch{throw Error('未找到浏览器组件。请安装 playwright，或在当前 Codex 电脑中运行。');}
}
export async function syncZX(){
 const {chromium}=await getPlaywright();
 const candidates=[process.env.EDGE_PATH,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
 let executablePath;for(const p of candidates.filter(Boolean)){try{await fs.access(p);executablePath=p;break;}catch{}}
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const context=await browser.newContext({timezoneId:'Asia/Shanghai'}),builds=[],crafts=[],stations=['技术中心','工作台','制药台','防具台'];
 try{
  const page=await context.newPage();
  await page.goto(sourceURL+'/sjz/v/zb_ss',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>[0,1,2,3,5].every(lv=>window.GunVue?.['zb_'+lv]?.data?.length>0),null,{timeout:35000});
  const raw=await page.evaluate(()=>Object.fromEntries([0,1,2,3,5].map(lv=>[lv,JSON.parse(JSON.stringify(window.GunVue['zb_'+lv]))])));
  for(const [lv,g] of Object.entries(raw))builds.push(...normalizeZXBuilds(g,lv));
  for(let t=1;t<=4;t++){
   await page.goto(sourceURL+'/sjz/v/manufacture?t='+t,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#app')?.__vue__?.$data?.data?.length>0,null,{timeout:35000});
   const items=await page.evaluate(()=>JSON.parse(JSON.stringify(document.querySelector('#app').__vue__.$data.data)));
   const rows=normalizeZXCrafts(items,stations[t-1]);if(!rows.length)throw Error(stations[t-1]+'未取得有效数据');crafts.push(...rows);
  }
 }finally{await browser.close();}
 if(builds.length<5||crafts.length<4)throw Error('来源数据不完整，未替换已有记录');
 const fetchedAt=new Date().toISOString(),snapshot={mode:'live',provider:'zxfps',source:'准星工具站',sourceURL,fetchedAt,builds,crafts,errors:[],levelUnknown:true,feeUnknown:true};
 const dir=path.join(root,'data');await fs.mkdir(dir,{recursive:true});
 const json=JSON.stringify(snapshot,null,2);await fs.writeFile(path.join(dir,'zxfps-latest.tmp'),json);await fs.rename(path.join(dir,'zxfps-latest.tmp'),path.join(dir,'zxfps-latest.json'));
 await fs.writeFile(path.join(dir,`zxfps-${chinaDay(fetchedAt)}.json`),json);
 return snapshot;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const s=await syncZX();console.log(JSON.stringify({success:true,fetchedAt:s.fetchedAt,builds:s.builds.length,crafts:s.crafts.length}));}catch(e){console.error('准星同步失败：'+e.message);process.exitCode=1;}
