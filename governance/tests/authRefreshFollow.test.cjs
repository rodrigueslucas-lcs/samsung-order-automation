const {test}=require('node:test'),assert=require('node:assert/strict');
const {followActiveRecovery}=require('../../utils/authRefreshFollow.cjs');
const {refreshAll}=require('../../utils/authRefreshAllRunner.cjs');
function fixture(states){let time=0,index=0;const logs=[];return{logs,deps:{find:()=>({startedAt:'cycle',read:()=>states[Math.min(index,states.length-1)]}),now:()=>time,pause:async()=>{time+=3000;index++;},log:s=>logs.push(s)}};}
const cycle=(status,bundle=null,extra={})=>({startedAt:'cycle',state:'RUNNING',identities:[{market:'mx',slot:'second',status}],finalized:bundle?[{market:'mx',...bundle}]:[],...extra});

test('real observer correlates its live owner PID and rejects unrelated, completed or foreign ownership',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{activeRecovery}=require('../../utils/authRefreshFollow.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'auth-follow-test-')),leases=path.join(root,'leases'),observations=path.join(root,'cycles');
 try{
  fs.mkdirSync(path.join(leases,'s2-mx.lock'),{recursive:true});fs.mkdirSync(observations);
  const now=Date.now(),ownerFile=path.join(leases,'s2-mx.lock','owner.json'),file=path.join(observations,`cycle-${now}-${crypto.randomUUID()}.json`);
  const owner={hostname:os.hostname(),pid:process.pid,token:'synthetic-only'},record={schemaVersion:1,environment:'S2',ownerPid:process.pid,startedAt:new Date(now).toISOString(),state:'RUNNING',identities:[{market:'mx',slot:'primary',status:'VERIFYING'}]};
  const env={AUTH_COORDINATION_DIR:leases,AUTH_OPERATIONS_DIR:observations};fs.writeFileSync(ownerFile,JSON.stringify(owner));fs.writeFileSync(file,JSON.stringify(record));
  assert.ok(activeRecovery('mx','S2',env));
  fs.writeFileSync(file,JSON.stringify({...record,ownerPid:process.pid+1}));assert.equal(activeRecovery('mx','S2',env),null);
  fs.writeFileSync(file,JSON.stringify({...record,state:'COMPLETE'}));assert.equal(activeRecovery('mx','S2',env),null);
  fs.writeFileSync(file,JSON.stringify(record));fs.writeFileSync(ownerFile,JSON.stringify({...owner,hostname:'foreign-host'}));assert.equal(activeRecovery('mx','S2',env),null);
 }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});
test('SECOND follows FIRST human gates and the same recovery until verified bundle ACK',async()=>{const f=fixture([cycle('WAITING_PRIMARY',null,{identities:[{market:'mx',slot:'primary',status:'HUMAN_REQUIRED'}]}),cycle('HUMAN_REQUIRED'),cycle('RECOVERED',{status:'READY',synchronized:true})]);const r=await followActiveRecovery('mx','S2','second',{JENKINS_AUTH_PUBLISH:'1'},f.deps);assert.equal(r.status,'READY');assert.equal(r.followedExisting,true);assert.ok(f.logs.some(s=>s.includes('WAITING_FIRST')));});
test('healthy identity alone does not complete a requested Jenkins refresh',async()=>{const f=fixture([cycle('HEALTHY'),cycle('HEALTHY',{status:'READY',synchronized:false}),cycle('HEALTHY',{status:'READY',synchronized:true})]);const r=await followActiveRecovery('mx','S2','second',{JENKINS_AUTH_PUBLISH:'1'},f.deps);assert.equal(r.status,'READY');assert.equal(r.elapsedMs,6000);});
test('publication failure stays failed; previous successful cycles cannot supply READY',async()=>{const f=fixture([cycle('RECOVERED',{status:'PUBLISH_FAILED'},{state:'COMPLETE'})]);assert.equal((await followActiveRecovery('mx','S2','second',{},f.deps)).status,'FAILED');f.deps.find=()=>({startedAt:'new',read:()=>cycle('HEALTHY',{status:'READY'})});assert.equal(await followActiveRecovery('mx','S2','second',{},f.deps),null);});
test('unknown ownership is not taken over and human timeout remains explicit',async()=>{assert.equal(await followActiveRecovery('mx','S2','second',{}, {find:()=>null}),null);const f=fixture([cycle('HUMAN_REQUIRED')]);assert.equal((await followActiveRecovery('mx','S2','second',{AUTH_REFRESH_FOLLOW_TIMEOUT_MS:'1000'},f.deps)).status,'HUMAN_REQUIRED');});
test('regional SECOND joins existing recovery without spawning another login',async()=>{const s=await refreshAll({markets:['mx','co'],slot:'second',env:{}},{runMarket:()=>assert.fail('no duplicate login'),followActive:async(market,environment,slot)=>({market,environment,slot,status:'READY',code:0,elapsedMs:1,followedExisting:true}),log(){},error(){}});assert.equal(s.ready,2);});
test('owner appearing during launch is followed after BUSY rather than retried',async()=>{let calls=0,launched=0;const s=await refreshAll({markets:['mx'],slot:'second',env:{}},{runMarket:async()=>{launched++;return{status:'BUSY',elapsedMs:1};},followActive:async(market,environment,slot)=>++calls===1?null:{market,environment,slot,status:'READY',code:0,elapsedMs:1},log(){},error(){}});assert.equal(launched,1);assert.equal(s.ready,1);});
