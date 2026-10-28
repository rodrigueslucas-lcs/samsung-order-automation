const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseArgs,main}=require('../../scripts/auth-epp-keepalive-once.cjs');
const {buildEppTaskXml,buildTaskXml}=require('../../utils/authKeepAliveTask.cjs');
const {firstPhaseReady}=require('../../scripts/auth-epp-keepalive-once.cjs');
const {assertRuntimeEvidence}=require('../../scripts/auth-epp-keepalive-task.cjs');
test('EPP task ceiling covers both bounded FIRST human waves and skips interval overlap',()=>{const xml=buildEppTaskXml({userSid:'S-1-5-21-123'});assert.match(xml,/<ExecutionTimeLimit>PT30M<\/ExecutionTimeLimit>/);assert.match(xml,/<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);assert.match(xml,/<Interval>PT15M<\/Interval>/);});
test('SECOND defaults only to MX/CO and cannot open before a proven FIRST phase',async()=>{
  assert.deepEqual(parseArgs(['--slot=second']).markets,['MX','CO']);
  let called=false;assert.equal(await main({argv:['--slot=second','--allow-refresh'],readFirst:()=>({}),cycle:()=>{called=true;},log(){}}),3);assert.equal(called,false);
  const report={store:'EPP',environment:'S2',generatedAt:new Date().toISOString(),identities:['MX','PE','CO','CL'].map(market=>({market,environment:'S2',slot:'primary',status:'KEEP_ALIVE_OK'}))};
  assert.equal(firstPhaseReady(report,'S2'),true);assert.doesNotThrow(()=>assertRuntimeEvidence(report,'S2'));
  report.identities[0].humanPending=true;assert.equal(firstPhaseReady(report,'S2'),false);
  report.generatedAt='invalid';assert.throws(()=>assertRuntimeEvidence(report,'S2'),/evidence/);
  report.generatedAt=new Date(Date.now()+60000).toISOString();assert.throws(()=>assertRuntimeEvidence(report,'S2'),/evidence/);
});
test('EPP defaults to S2 FIRST and never refreshes/publishes implicitly',()=>{assert.deepEqual(parseArgs([]),{environment:'S2',markets:['MX','PE','CO','CL'],slot:'primary',allowRefresh:false,publish:false,repairDashboard:false});assert.throws(()=>parseArgs(['--slot=third']),/Invalid/);assert.equal(parseArgs(['--slot=second']).slot,'second');});
test('active Jenkins market build prevents EPP verify/refresh entirely',async()=>{let called=false;const result=await main({argv:['--allow-refresh'],env:{},activity:async()=>({idle:false}),cycle:async()=>{called=true;},log(){},save(){}});assert.equal(result,3);assert.equal(called,false);});
test('EPP task reuses hidden launcher/logon/15-minute/IgnoreNew without changing Base Store task',()=>{const args={userSid:'S-1-5-21-123',start:new Date('2026-10-28T12:00:00Z')};const epp=buildEppTaskXml(args),base=buildTaskXml(args);assert.match(epp,/auth-epp-keepalive-once.cjs/);assert.match(epp,/PT15M/);assert.match(epp,/LogonTrigger/);assert.match(epp,/InteractiveToken/);assert.match(epp,/IgnoreNew/);assert.match(epp,/wscript.exe/);assert.doesNotMatch(epp,/Password|HighestAvailable/);assert.doesNotMatch(base,/auth-epp-keepalive/);});
