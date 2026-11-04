export function calculate({sale,quantity,cost,fee,hours}) {
  for (const [k,v] of Object.entries({sale,quantity,cost,fee,hours})) if (!Number.isFinite(v)||v<0) throw Error(`${k} 必须是有效的非负数`);
  if(hours===0||quantity===0||fee>100) throw Error('数量和时长必须大于 0，费率不能超过 100%');
  const revenue=sale*quantity,profit=revenue*(1-fee/100)-cost;
  return {profit,hourly:profit/hours,revenue,cost,hours,roi:cost?profit/cost*100:null};
}
export function normalizeBuilds(groups) {
 const seen=new Set(),out=[];
 for(const g of groups) for(const b of g.list??[]) {
  if(g.name?.includes('兑换'))continue;
  const key=JSON.stringify(b.data);if(seen.has(key))continue;seen.add(key);
  if(!Number.isFinite(b.price)||!Number.isFinite(b.jz))continue;
  out.push({name:b.name||g.name,cost:b.price,value:b.jz,threshold:g.zb,sourceTime:g.date?new Date(g.date*1000).toISOString():null,items:(b.data??[]).map(i=>({name:i.name,price:i.price,type:i.type}))});
 }
 return out.sort((a,b)=>a.cost-b.cost).slice(0,12);
}
