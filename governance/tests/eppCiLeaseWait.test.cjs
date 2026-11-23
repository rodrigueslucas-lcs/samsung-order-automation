const test=require('node:test'),assert=require('node:assert/strict');
const{acquireCampaignLease}=require('../../scripts/run-epp-qst.cjs');
const ci={CI:'1',ENVIRONMENT:'S2',EPP_CI_AUTHORITY_ROOT:'synthetic-dedicated-authority'};
const busy=()=>Object.assign(new Error('owned session'),{code:'AUTH_BUSY'});

test('CI waits before obtaining its own EPP lease and never modifies the active owner',()=>{
 let time=0,attempts=0,ownerActive=true;const events=[],lease={owned:true};
 const result=acquireCampaignLease({market:'MX'},ci,{
  now:()=>time,timeoutMs:10000,log:()=>events.push('waiting'),
  pause:ms=>{assert.equal(ownerActive,true);time+=ms;ownerActive=false;events.push('owner-finished-independently');},
  acquire:()=>{attempts++;if(ownerActive)throw busy();events.push('acquired');return lease;},
 });
 assert.equal(result,lease);assert.equal(attempts,2);
 assert.deepEqual(events,['waiting','owner-finished-independently','acquired']);
});

test('CI wait expires with AUTH_BUSY while the owner remains intact',()=>{
 let time=0,attempts=0;const owner={active:true};
 assert.throws(()=>acquireCampaignLease({},ci,{now:()=>time,pause:ms=>time+=ms,log:()=>{},timeoutMs:7000,
  acquire:()=>{attempts++;throw busy();}}),{code:'AUTH_BUSY'});
 assert.equal(time,7000);assert.equal(attempts,3);assert.equal(owner.active,true);
});

test('non-CI callers and non-contention failures never wait or replay acquisition',()=>{
 for(const [env,error] of [[{},busy()],[{...ci,ENVIRONMENT:'S1'},busy()],[ci,Object.assign(new Error('denied'),{code:'EACCES'})]]){
  let calls=0;assert.throws(()=>acquireCampaignLease({},env,{acquire:()=>{calls++;throw error;},pause:()=>assert.fail('unexpected wait')}),e=>e===error);
  assert.equal(calls,1);
 }
});
