const fs=require('node:fs');
const path=require('node:path');
const {runCycle}=require('../utils/eppKeepAlive.cjs');
const {jenkinsBuildsIdle}=require('../utils/authJenkinsActivity.cjs');
const {writeJsonAtomically}=require('../utils/atomicJson');
function parseArgs(args){
  const result={environment:'S2',markets:['MX','PE','CO','CL'],slot:'primary',allowRefresh:false,publish:false,repairDashboard:false};
  for(const arg of args){
    if(arg.startsWith('--environment='))result.environment=arg.slice(14).toUpperCase();
    else if(arg.startsWith('--markets='))result.markets=[...new Set(arg.slice(10).split(',').map(m=>m.toUpperCase()))];
    else if(arg.startsWith('--slot='))result.slot=arg.slice(7);
    else if(arg==='--allow-refresh')result.allowRefresh=true;
    else if(arg==='--publish')result.publish=true;
    else if(arg==='--repair-dashboard')result.repairDashboard=true;
    else if(arg!=='--scheduled')throw new Error('Unsupported EPP keep-alive option.');
  }
  if(!['S1','S2'].includes(result.environment)||!['primary','second'].includes(result.slot)||!result.markets.length||result.markets.some(m=>!['MX','PE','CO','CL'].includes(m)))throw new Error('Invalid EPP identity scope.');
  if(result.slot==='second'&&!args.some(arg=>arg.startsWith('--markets=')))result.markets=['MX','CO'];
  return result;
}
function firstPhaseReady(report,environment,now=Date.now()){
  const expected=new Set(['MX','PE','CO','CL']),stamp=Date.parse(report?.generatedAt);
  return report?.store==='EPP'&&report.environment===environment&&Number.isFinite(stamp)&&stamp<=now&&now-stamp<900000&&report.identities?.length===4&&report.identities.every(r=>expected.delete(r.market)&&r.slot==='primary'&&['KEEP_ALIVE_OK','REFRESHED'].includes(r.status)&&!r.humanPending)&&expected.size===0;
}
async function main({argv=process.argv.slice(2),env=process.env,cycle=runCycle,activity=jenkinsBuildsIdle,log=console.log,save=writeJsonAtomically,readFirst=environment=>JSON.parse(fs.readFileSync(path.resolve('test-results/auth-keepalive',`epp-last-cycle-${environment.toLowerCase()}-primary.json`),'utf8')),repair=async()=>{const r=require('../utils/authOperationsResource.cjs');return r.repairResourceOrigin({apply:true,env,resourceAddress:r.stableResourceAddress()});}}={}){
  const args=parseArgs(argv);
  if(args.slot==='second'&&args.allowRefresh){let ready=false;try{ready=firstPhaseReady(readFirst(args.environment),args.environment);}catch{}if(!ready){log('[EPP] BUSY · FIRST phase not verified complete; SECOND recovery was not opened');return 3;}}
  if(args.repairDashboard){try{const r=await repair();log('[EPP] Dashboard resources: '+(r.changed?'REPAIRED':'UNCHANGED'));}catch{log('[EPP] Dashboard resource origin UNPROVEN; session safety is unchanged');}}
  // Same Jenkins activity guard as Base Store, but no Base Store auth action.
  const active=await activity(env,{markets:args.markets.map(m=>m.toLowerCase())});
  if(!active.idle){log('[EPP] BUSY · market builds active; no session operation started');return 3;}
  const summary=await cycle({...args,env});
  for(const r of summary.identities)log(`[EPP][${r.market}][${r.environment}][${r.slot==='second'?'SECOND':'FIRST'}] session=${r.session||'UNPROVEN'} program=${r.program||'UNSUPPORTED'} users/current=${r.proof?.userAccepted?'AUTHENTICATED':'UNPROVEN'} entitlement=${r.proof?.accessAccepted?'VALID':'UNPROVEN'} action=${r.status} reuse=${r.action||'NONE'} reason=${r.reason||'NONE'} source=${r.blockerSource||'CURRENT'}${r.currentReason?' currentReason='+r.currentReason:''}`);
  const dir=path.resolve('test-results/auth-keepalive');fs.mkdirSync(dir,{recursive:true});
  save(path.join(dir,`epp-last-cycle-${args.environment.toLowerCase()}-${args.slot}.json`),{generatedAt:new Date().toISOString(),...summary});
  return summary.ok?0:summary.identities.some(r=>r.status==='HUMAN_REQUIRED')?2:1;
}
if(require.main===module)main().then(code=>{process.exitCode=code;}).catch(()=>{console.error('[EPP] UNPROVEN · maintenance did not complete; no session declared healthy');process.exitCode=1;});
module.exports={parseArgs,main,firstPhaseReady};
