import {syncZX,chinaDay} from './zx-sync.mjs';
try{const s=await syncZX();console.log(JSON.stringify({success:true,day:chinaDay(s.fetchedAt),builds:s.builds.length,crafts:s.crafts.length,fetchedAt:s.fetchedAt}));}
catch(e){console.error('每日行情同步失败：'+e.message);process.exitCode=1;}
