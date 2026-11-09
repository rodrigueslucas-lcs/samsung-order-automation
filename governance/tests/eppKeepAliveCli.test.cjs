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

test('targeted checks never replace the regional scheduler report',async()=>{
 for(const slot of ['primary','second']){
  let saved;await main({argv:['--markets=CO','--slot='+slot],env:{},activity:async()=>({idle:true}),cycle:async()=>({ok:true,identities:[]}),log(){},save(file){saved=file;}});
  assert.ok(saved.endsWith('epp-last-cycle-s2-'+slot+'-co.json'));
 }
 let saved;await main({argv:[],env:{},activity:async()=>({idle:true}),cycle:async()=>({ok:true,identities:[]}),log(){},save(file){saved=file;}});
 assert.ok(saved.endsWith('epp-last-cycle-s2-primary.json'));
});

for(const environment of ['S1','S2'])for(const scenario of [
 {name:'healthy',statuses:['KEEP_ALIVE_OK','REFRESHED','KEEP_ALIVE_OK','KEEP_ALIVE_OK'],code:0},
 {name:'healthy and occupied',statuses:['KEEP_ALIVE_OK','BUSY','REFRESHED','KEEP_ALIVE_OK'],code:3},
 {name:'all occupied',statuses:['BUSY','BUSY','BUSY','BUSY'],code:3},
 {name:'occupied with network uncertainty',statuses:['BUSY','UNPROVEN','KEEP_ALIVE_OK','KEEP_ALIVE_OK'],code:1},
 {name:'occupied with external blocker',statuses:['BUSY','BLOCKED','KEEP_ALIVE_OK','KEEP_ALIVE_OK'],code:1},
 {name:'occupied with publication failure',statuses:['BUSY','PUBLISH_FAILED','KEEP_ALIVE_OK','KEEP_ALIVE_OK'],code:1},
 {name:'occupied with human intervention',statuses:['BUSY','HUMAN_REQUIRED','KEEP_ALIVE_OK','KEEP_ALIVE_OK'],code:2},
])test(`${environment} cycle exit distinguishes ${scenario.name}`,async()=>{
 const identities=scenario.statuses.map((status,index)=>({market:['MX','PE','CO','CL'][index],environment,slot:'primary',status}));
 const summary={environment,store:'EPP',identities,ok:scenario.statuses.every(status=>['KEEP_ALIVE_OK','REFRESHED'].includes(status))};let saved;
 const code=await main({argv:['--environment='+environment],env:{},activity:async()=>({idle:true}),cycle:async options=>{assert.equal(options.allowRefresh,false);assert.equal(options.publish,false);return summary;},save:(_file,value)=>{saved=value;},log(){}});
 assert.equal(code,scenario.code);assert.equal(saved.ok,summary.ok);assert.deepEqual(saved.identities,identities);
 if(scenario.statuses.includes('BUSY'))assert.equal(saved.ok,false);
});

test('reviewed EPP security recovery is explicit, unscheduled and requires refresh authorization',()=>{assert.equal(parseArgs(['--allow-refresh','--retry-security-blocked']).retrySecurityBlocked,true);assert.throws(()=>parseArgs(['--retry-security-blocked']),/explicit unscheduled/);assert.throws(()=>parseArgs(['--allow-refresh','--retry-security-blocked','--scheduled']),/explicit unscheduled/);});

test('a proven provider security denial reports attention required instead of a technical scheduler error',async()=>{const code=await main({argv:[],env:{},activity:async()=>({idle:true}),cycle:async()=>({ok:false,identities:[{market:'CL',environment:'S2',slot:'primary',status:'BLOCKED',reason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'}]}),save(){},log(){}});assert.equal(code,2);});
