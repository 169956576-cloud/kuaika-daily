import {calculate} from './logic.mjs';
const $=s=>document.querySelector(s), escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(n), day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
const dateText=d=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
const localInput=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
let data={mode:'unconfigured',builds:[],crafts:[],errors:[]},station='全部',requestId=0,toastTimer,records=[],manualBuilds=[];
try{records=JSON.parse(localStorage.getItem('deltaDailyCrafts')||'[]');manualBuilds=JSON.parse(localStorage.getItem('deltaDailyBuilds')||'[]');if(!Array.isArray(records)||!Array.isArray(manualBuilds))throw Error();}catch{records=[];manualBuilds=[];}
function notify(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function persist(){try{localStorage.setItem('deltaDailyCrafts',JSON.stringify(records));localStorage.setItem('deltaDailyBuilds',JSON.stringify(manualBuilds));}catch{notify('浏览器未允许保存，当前记录将在关闭页面后丢失');}}
function validTime(t){const n=Date.parse(t);return Number.isFinite(n)&&n<=Date.now()+300000;}
function current(t){return validTime(t)&&day(t)===day(Date.now());}
function freshness(t){if(!t)return '接口未提供采集时间';if(!validTime(t))return '时间无效，请核对';if(!current(t))return '历史记录 · '+dateText(t);return dateText(t)+(Date.now()-Date.parse(t)>1800000?' · 已超过 30 分钟，请核价':' · 当天记录');}
function manualCrafts(){return records.filter(r=>current(r.sourceTime)).map(r=>({...r,manual:true}));}
function allCrafts(){return [...data.crafts,...manualCrafts()].filter(c=>(station==='全部'||c.station===station)&&(!c.level||c.level<=Number($('#level').value))).sort((a,b)=>$('#sort').value==='hours'?a.hours-b.hours:b[$('#sort').value]-a[$('#sort').value]);}
function allBuilds(){return [...data.builds,...manualBuilds.filter(b=>b.lv===$('#threshold').value)].sort((a,b)=>a.cost-b.cost);}
function usableBuild(b){return b.manual?current(b.sourceTime):data.mode==='live'&&current(b.sourceTime);}
function render(){
 const zx=data.provider==='zxfps';$('#level').disabled=zx;$('#level').hidden=zx;$('#levelLabel').firstChild.textContent=zx?'来源未标明设施等级':'设施等级';$('#level').title=zx?'准星来源未标明设施等级，不进行等级推算':'';
 document.querySelectorAll('.stat-label').forEach(el=>{if(el.textContent.includes('净收益'))el.firstChild.textContent=el.firstChild.textContent.replaceAll('净收益','参考收益');});

 const demo=data.mode==='demo',builds=allBuilds(),crafts=allCrafts();
 const eligible=builds.filter(b=>b.value>=b.threshold&&(demo||usableBuild(b)));
 const min=eligible[0],hour=[...crafts].sort((a,b)=>b.hourly-a.hourly)[0],profit=[...crafts].sort((a,b)=>b.profit-a.profit)[0];
 $('#minCost').innerHTML=min?`${fmt(min.cost)}<small>币</small>`:'—';$('#costFoot').textContent=min?`${demo?'示例 · ':''}战备价值 ${fmt(min.value)}`:'当天有效配装尚未录入';
 $('#maxHourly').innerHTML=hour?`${hour.hourly>0?'+':''}${fmt(hour.hourly)}<small>币 / 时</small>`:'—';$('#maxHourly').classList.toggle('negative',hour?.hourly<0);$('#hourFoot').textContent=hour?(demo?'示例 · ':'')+hour.name:'等待制造数据';
 $('#maxProfit').innerHTML=profit?`${profit.profit>0?'+':''}${fmt(profit.profit)}<small>币</small>`:'—';$('#profitFoot').textContent=profit?(demo?'示例 · ':'')+profit.name:'按当前筛选计算';
 $('#profitable').innerHTML=crafts.length?`${crafts.filter(c=>c.profit>0).length}<small>/ ${crafts.length} 项</small>`:'—';
 $('#status').classList.toggle('live',data.mode==='live');$('#status').textContent=demo?'● 示例体验 · 非当天行情':data.mode==='live'?(data.provider==='zxfps'?'● 准星来源 · 自动同步':'● 已连接接口'):data.mode==='stale'?'● 历史快照 · 待更新':data.mode==='error'?'● 行情连接失败':'● 待接入 · 可手动录入';
 $('#updated').textContent=data.fetchedAt?(data.provider==='zxfps'?'来源快照 ':'本机读取 ')+dateText(data.fetchedAt)+(data.syncing?' · 正在后台更新':''):'尚未获取当天行情';
 $('#notice strong').textContent=demo?'你正在查看示例，以下数据不代表今天的市场。':data.mode==='live'?(data.provider==='zxfps'?'已参考准星工具站自动填入，交易前请核价。':'接口已连接，按实际购买与成交价核对。'):data.mode==='error'?'暂时无法获取行情，请稍后重试。':'连接实际行情，开始今天的决策。';
 $('#notice p').textContent=demo?'示例用来体验配装、排序和筛选，不可据此下单。手动录入的记录仍独立保存在本机。':data.mode==='live'?(data.errors?.length?data.errors.join('；'):(data.provider==='zxfps'?'来源：tool.zxfps.com。云端计划每 30 分钟同步；本机读取时间不是制造物价采集时间。设施等级与手续费口径未披露。':'制造接口未提供物价采集时间；本机获取时间不代表行情采集时间。每 10 分钟自动检查一次。')):data.mode==='stale'?'当前展示的是历史快照，已从当天制造排行移除。':data.error||'请尝试刷新行情；也可录入当天价格自行计算。';
 $('#demo').textContent=demo?'退出示例 →':'体验示例 →';
 $('#builds').innerHTML=builds.length?builds.slice(0,6).map((b,i)=>`<article class="build-card"><div class="build-title"><span class="build-no">${String(i+1).padStart(2,'0')}</span>${escape(b.name)}<span class="tag ${!demo&&!usableBuild(b)?'warn':''}">${demo?'示例':b.manual?'手动录入':usableBuild(b)?'当天采集':'需更新价格'}</span></div><div class="cost-label">实际购入总价</div><div class="build-cost">${fmt(b.cost)}<small>哈夫币</small></div><div class="value-row"><span>战备价值 <b>${fmt(b.value)}</b></span><span>${b.value>=b.threshold?'达到所填门槛':'低于所填门槛'} ${fmt(b.threshold)}</span></div><div class="item-list">${b.items.map(x=>`<div class="item-row"><span>${escape(x.name)}</span><span>${fmt(x.price)}</span></div>`).join('')}</div><div class="card-time">${demo?'示例数据 · 不作为当天推荐':escape(freshness(b.sourceTime))}</div><button class="copy" data-copy="${i}">复制装备清单 ↗</button>${b.manual?`<button class="delete" data-build-delete="${escape(b.id)}">删除此配装</button>`:''}</article>`).join(''):`<div class="empty"><div class="empty-symbol">⌖</div><strong>今天的省钱配装，等你接入</strong><p>自动行情需要个人接口密钥。你也可以在下方输入装备的当天买入价与战备价值。</p><button class="small-button" id="openManualBuild">＋ 录入当天配装</button></div>`;
 $('#crafts').innerHTML=crafts.length?crafts.map((c,i)=>`<tr><td><span class="rank ${i===0?'top':''}">${String(i+1).padStart(2,'0')}</span>${escape(c.name)}<small class="small-meta">${demo&&!c.manual?'示例':c.manual?'手动 · '+escape(freshness(c.sourceTime)):(data.provider==='zxfps'?'准星参考收益 · 等级/费率未知':'数据源计算 · 行情采集时间未知')}</small></td><td>${escape(c.station)}</td><td>${c.hours} 小时</td><td class="${c.profit>=0?'green':'negative'}">${c.profit>0?'+':''}${fmt(c.profit)}</td><td class="${c.hourly>=0?'green':'negative'}">${c.hourly>0?'+':''}${fmt(c.hourly)} <small>/ 时</small></td></tr>`).join(''):`<tr><td colspan="5" class="table-empty">${data.mode==='live'?'当前设施及等级没有可用项目，请更换筛选。':'尚无可用行情。录入下方的当天价格，立即计算制造收益。'}</td></tr>`;
 renderManual();
}
function renderManual(){
 $('#manualList').innerHTML=records.map(r=>`<div class="manual-record"><div><strong>${escape(r.name)} <span class="tag ${current(r.sourceTime)?'':'warn'}">${current(r.sourceTime)?'当天手动价':'历史记录'}</span></strong><p>${escape(r.station)} · ${escape(freshness(r.sourceTime))}</p></div><div class="manual-metrics ${r.profit<0?'negative':''}">${r.profit>0?'+':''}${fmt(r.profit)} 币<small>每小时 ${fmt(r.hourly)} 币 · ${r.hours} 小时</small></div><button class="delete" data-delete="${escape(r.id)}" aria-label="删除 ${escape(r.name)}">删除</button></div>`).join('');
}
async function refresh(){
 const n=++requestId;$('#refresh').disabled=true;$('#refresh').textContent='↻ 获取中…';
 try{
  let next;if(['localhost','127.0.0.1'].includes(location.hostname)){try{const r=await fetch(`/api/daily?lv=${$('#threshold').value}&level=${$('#level').value}`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('本机服务');next=await r.json();}catch{}}
  if(!next){const r=await fetch(`data/zxfps-latest.json?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('云端行情暂不可用');next=await r.json();if(!Array.isArray(next.builds)||!Array.isArray(next.crafts))throw Error('行情文件格式无效');const today=day(next.fetchedAt)===day(Date.now());next={...next,mode:today?'live':'stale',builds:next.builds.filter(b=>b.lv===$('#threshold').value),crafts:today?next.crafts:[],errors:today?[]:['当前是历史快照，已停止计入当天制造排行。']};}
  if(n!==requestId)return;data=next;render();
 }
 catch(e){if(n!==requestId)return;data={mode:'error',builds:[],crafts:[],error:e.name==='TimeoutError'?'行情获取超时，请稍后刷新。':'来源暂时不可用，请稍后刷新；本机服务须保持运行。',errors:[]};render();}
 finally{if(n===requestId){$('#refresh').disabled=false;$('#refresh').textContent='↻ 刷新情报';}}
}
function demoData(){
 const threshold=Number($('#threshold').selectedOptions[0].textContent.match(/\d+/)[0])*10000;
 const baseItems=[{name:'野牛冲锋枪',price:12101},{name:'俄系冲锋枪精密消音器',price:30781},{name:'AKS-74U突击步枪',price:12058},{name:'DTK制退器',price:21757},{name:'X25U斜侧战斗握把',price:24119},{name:'尼龙防弹衣（破损）',price:2164}];
 return {mode:'demo',errors:[],builds:threshold===110000?[{name:'低成本进场 · 示例',cost:102980,value:112508,threshold:112500,items:baseItems},{name:'备选组合 · 示例',cost:102983,value:112668,threshold:112500,items:[...baseItems.slice(0,-1),{name:'奔尼帽',price:2167}]}]:[],crafts:[{name:'OLIGHT WARRIOR 3S战术手电',station:'技术中心',profit:16396,hourly:3643,hours:4.5,level:1},{name:'蜂网遮光罩',station:'技术中心',profit:-7172,hourly:-1593,hours:4.5,level:1}]};
}
function handleFilter(fetchRequired=false){if(data.mode==='demo'){data=demoData();render();}else if(fetchRequired){data={mode:'unconfigured',builds:[],crafts:[],errors:[]};render();refresh();}else render();}
$('#today').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date());
$('#settings').onclick=$('#sourceBtn').onclick=()=>$('#modal').showModal();$('#closeModal').onclick=()=>$('#modal').close();$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#refresh').onclick=refresh;$('#demo').onclick=()=>{if(data.mode==='demo')refresh();else{requestId++;$('#refresh').disabled=false;$('#refresh').textContent='↻ 刷新情报';data=demoData();render();}};
$('#sourceRefresh').onclick=async()=>{const b=$('#sourceRefresh');b.disabled=true;b.textContent='更新中…';try{if(['localhost','127.0.0.1'].includes(location.hostname)){const r=await fetch('/api/source/refresh',{method:'POST',signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error();}await refresh();if(data.mode==='live'||data.mode==='stale'){notify('已读取云端快照；定时同步由云端执行');$('#modal').close();}else throw Error();}catch{notify('云端快照暂不可用，请稍后再试');}finally{b.disabled=false;b.textContent='立即尝试同步 ↻';}};
$('#threshold').onchange=()=>handleFilter(true);$('#level').onchange=()=>handleFilter(true);$('#sort').onchange=()=>handleFilter();
document.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>{station=b.dataset.station;document.querySelectorAll('[data-station]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('#calcForm [name="observedAt"]').value=localInput();
$('#calcForm').onsubmit=e=>{
 e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim(),sourceTime=new Date(f.get('observedAt')).toISOString();
 if(!name){notify('请输入物品名称');return;}if(!validTime(sourceTime)||!current(sourceTime)){notify('请填写今天已实际采集的价格时间，不能使用未来或历史日期');return;}
 try{const input=Object.fromEntries(['sale','quantity','cost','fee','hours'].map(k=>[k,Number(f.get(k))]));const result=calculate(input);records.unshift({...result,...input,name,station:f.get('station'),sourceTime,id:crypto.randomUUID()});records=records.slice(0,100);persist();render();notify('已保存，并加入当天制造排行');}catch(e){notify(e.message);}
};
document.addEventListener('click',async e=>{
 const copy=e.target.closest('[data-copy]');if(copy){const b=allBuilds()[Number(copy.dataset.copy)];const text=`${b.name}\n${data.mode==='demo'?'示例，不是当天行情\n':''}${b.items.map(x=>`${x.name}：${fmt(x.price)}`).join('\n')}\n总花费 ${fmt(b.cost)} / 战备价值 ${fmt(b.value)}\n${freshness(b.sourceTime)}`;try{await navigator.clipboard.writeText(text);notify('装备清单已复制');}catch{notify('浏览器不支持复制，请手动选择装备信息');}}
 const del=e.target.closest('[data-delete]');if(del){records=records.filter(r=>r.id!==del.dataset.delete);persist();render();}
 const bd=e.target.closest('[data-build-delete]');if(bd){manualBuilds=manualBuilds.filter(b=>b.id!==bd.dataset.buildDelete);persist();render();}
 if(e.target.id==='openManualBuild'){$('#manualBuildEntry').open=true;$('#manualBuildEntry').scrollIntoView({behavior:'smooth',block:'center'});}
 const rm=e.target.closest('[data-remove-item]');if(rm&&document.querySelectorAll('.equipment-input').length>1)rm.closest('.equipment-input').remove();
});
const buildMarkup=`<details id="manualBuildEntry" class="manual-build-entry"><summary>＋ 没有密钥？按当天价格录入自己的卡战备配装</summary><form id="buildForm"><div class="form-grid"><label>配装名称<input name="buildName" maxlength="60" required placeholder="例如：今天的低成本方案"></label><label>游戏内实际战备门槛<input name="target" type="number" min="1" step="1" required placeholder="填写游戏当前显示的数值"></label><label>价格采集时间<input name="observedAt" type="datetime-local" required value="${localInput()}"></label></div><div class="equipment-labels"><span>装备名称</span><span>当天买入价</span><span>战备价值</span><span></span></div><div id="equipmentRows"></div><button type="button" class="small-button" id="addItem">＋ 添加装备</button><div class="calc-bottom"><p>逐项填写游戏内价格和战备价值。当前配装归入上方选择的战备档位；达标只校验总战备值。</p><button type="submit" class="primary">保存当天配装 →</button></div></form></details>`;
$('#builds').insertAdjacentHTML('afterend',buildMarkup);
function addRow(){const row=document.createElement('div');row.className='equipment-input';row.innerHTML='<input name="itemName" maxlength="80" required placeholder="装备或配件" aria-label="装备名称"><input name="itemPrice" type="number" min="0" step="1" required placeholder="买入价" aria-label="装备买入价"><input name="itemValue" type="number" min="0" step="1" required placeholder="战备价值" aria-label="装备战备价值"><button type="button" data-remove-item aria-label="移除装备">×</button>';$('#equipmentRows').append(row);}
$('#addItem').onclick=addRow;addRow();addRow();
$('#buildForm').onsubmit=e=>{
 e.preventDefault();const f=new FormData(e.target),sourceTime=new Date(f.get('observedAt')).toISOString();if(!current(sourceTime)){notify('请填写今天已实际采集的价格时间');return;}
 const items=[...document.querySelectorAll('.equipment-input')].map(r=>({name:r.querySelector('[name="itemName"]').value.trim(),price:Number(r.querySelector('[name="itemPrice"]').value),value:Number(r.querySelector('[name="itemValue"]').value)}));
 if(items.some(x=>!x.name||!Number.isFinite(x.price)||!Number.isFinite(x.value)||x.price<0||x.value<0)){notify('请检查装备名称、价格和战备值');return;}
 const b={name:f.get('buildName').trim(),threshold:Number(f.get('target')),items,cost:items.reduce((s,i)=>s+i.price,0),value:items.reduce((s,i)=>s+i.value,0),manual:true,sourceTime,lv:$('#threshold').value,id:crypto.randomUUID()};
 if(!b.name||!Number.isFinite(b.threshold)||b.threshold<=0){notify('请填写名称与有效门槛');return;}
 manualBuilds.unshift(b);manualBuilds=manualBuilds.slice(0,40);persist();render();notify(b.value>=b.threshold?'当天配装已保存，战备总值达标':'配装已保存，但战备总值低于你填写的门槛');
};
render();refresh();setInterval(()=>{if(!document.hidden){if(data.mode==='demo')render();else refresh();}},600000);
