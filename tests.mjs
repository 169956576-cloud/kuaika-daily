import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,normalizeBuilds} from './logic.mjs';
import {server} from './server.mjs';
import {normalizeZXBuilds,normalizeZXCrafts,chinaDay} from './zx-sync.mjs';
test('批量产出只对总销售额扣费，损益和小时收益一致',()=>{
 const x=calculate({sale:10000,quantity:3,cost:20000,fee:10,hours:2});
 assert.equal(x.profit,7000);assert.equal(x.hourly,3500);assert.equal(x.roi,35);
});
test('保留亏损结果而非误报利润',()=>{
 const x=calculate({sale:10000,quantity:1,cost:12000,fee:10,hours:1.5});assert.equal(x.profit,-3000);assert.equal(x.hourly,-2000);
});
test('零材料成本不产生无限收益率',()=>assert.equal(calculate({sale:100,quantity:1,cost:0,fee:0,hours:1}).roi,null));
test('拒绝零时长、无穷值、负成本和无效费率',()=>{for(const patch of [{hours:0},{sale:Infinity},{cost:-1},{fee:101},{quantity:0},{sale:NaN}])assert.throws(()=>calculate({sale:100,quantity:1,cost:50,fee:10,hours:1,...patch}));});
test('配装排除兑换、去重，按买入价而非差价排序，并保留源时间',()=>{
 const a={price:100,jz:150,data:[{name:'A',price:100}]},b={price:80,jz:120,data:[{name:'B',price:80}]};
 const x=normalizeBuilds([{name:'实用',zb:110,date:1778664129,list:[a,b]},{name:'低成本',zb:110,date:1778664129,list:[a]},{name:'兑换',list:[{price:1,jz:150,data:[]}]}]);
 assert.equal(x.length,2);assert.equal(x[0].cost,80);assert.equal(x[0].threshold,110);assert.equal(x[0].sourceTime,'2026-05-13T09:22:09.000Z');
});
test('准星配装保留真实来源时间并从来源数据计算战备门槛',()=>{
 const raw={time:'2026-11-04 10:26:43',data:[{name:'均衡套装',price:89743,jz:112746,cz:-22757,data:[{name:'AKM',price:75102,type:'枪1'}]}]};
 const [b]=normalizeZXBuilds(raw,0);assert.equal(b.threshold,112500);assert.equal(b.sourceTime,'2026-11-04T02:26:43.000Z');assert.equal(b.items[0].name,'AKM');assert.throws(()=>normalizeZXBuilds(raw,4));
});
test('准星制造收益展示来源原值并明确没有等级和采集时间',()=>{
 const [c]=normalizeZXCrafts([{name:'配件',price:12000,price_hour:3000,period:4},{name:'坏值',price:1,price_hour:1,period:0}], '技术中心');
 assert.equal(c.profit,12000);assert.equal(c.hourly,3000);assert.equal(c.level,null);assert.equal(c.sourceTime,null);assert.equal(c.source,'准星工具站');assert.equal(chinaDay('2026-11-04T02:30:00Z'),'2026-11-04');
});
test('网站提供页面和当天来源数据，拒绝私有文件与穿越路径',async()=>{
 delete process.env.DELTA_API_TOKEN;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/每日卡战备/);
  const j=await(await fetch(base+'/api/daily')).json();assert.equal(j.provider,'zxfps');assert.ok(j.builds.length>0);assert.ok(['live','stale'].includes(j.mode));assert.equal(j.mode==='live',j.crafts.length>0);if(j.mode==='stale')assert.equal(j.crafts.length,0);
  for(const p of ['/.env','/server.mjs','/README.md','/%2e%2e%2fserver.mjs'])assert.equal((await fetch(base+p)).status,404);
  for(const p of ['/app.mjs','/logic.mjs','/style.css'])assert.equal((await fetch(base+p)).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
