const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppPaymentPrerequisites.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture(market,{confirmationOnly=false,authorized=true,resume=false,pending=null,current=null}={}){
 const calls=[],old={market,environment:'S2',kind:'card',status:'CONFIRMED',orderCode:market+'261104-12345678',runId:'old-run'};
 const cfg={market,environment:'S2',program:'synthetic'};
 const context={URL,process:{env:{EPP_RUN_ID:'current-run',ALLOW_PAYMENT_SUBMIT:authorized?'1':'0',...(resume?{EPP_RESUME_PENDING_ORDER:'1'}:{})}},test:{setTimeout(){},skip(_condition,reason){throw Error(reason);},info:()=>({annotations:[],attach:async()=>{}})},attempts:{latestConfirmedEppOrder:()=>old,confirmedEppOrderForRun:()=>current,pendingEppOrderAttempt:(_,kind)=>kind==='card'?pending:null,confirmPendingEppOrder:()=>calls.push('archive-reconciled')},validateExistingEppCardOrder:async()=>calls.push('read-order'),submitMxEppCard(){},submitPeEppCard(){},submitClEppCard(){},submitCoEppCard(){},submitClEppBank(){}};
 const run=vm.runInNewContext(source+'\nprobeEppPaymentPrerequisites=async()=>{return {status:"PASS",orderCode:"'+market+'261105-87654321",fresh:true};};\nrunEppPaymentPrerequisiteCase;',context);
 return{calls,run:async()=>{const value=await run({},cfg,{kind:'card',confirmationOnly});return value;}};
}
for(const market of ['MX','PE','CL','CO'])test(market+' normal payment does not pass by reading an old confirmed order',async()=>{
 const f=fixture(market);await f.run();assert.deepEqual(f.calls,[]);
});
test('confirmation without current-run order and without submit authorization never reads history as PASS',async()=>{
 const f=fixture('CL',{confirmationOnly:true,authorized:false});await assert.rejects(f.run(),/CURRENT_RUN|PAYMENT_SUBMIT_NOT_AUTHORIZED/);assert.deepEqual(f.calls,[]);
});
test('confirmation consumes the current-run causal order without another submit',async()=>{
 const f=fixture('CL',{confirmationOnly:true,current:{market:'CL',environment:'S2',kind:'card',status:'CONFIRMED',orderCode:'CL261105-87654321',runId:'current-run'},authorized:false});await f.run();assert.deepEqual(f.calls,['read-order']);
});
test('an unidentified pending submit cannot be cleared for a new payment',async()=>{
 const f=fixture('CL',{pending:{kind:'card',status:'SUBMITTING'}});await assert.rejects(f.run(),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);assert.deepEqual(f.calls,[]);
});

test('old CL transfer blocks its own method and unproven confirmation, preserving the original failure',async()=>{
 const old={market:'CL',environment:'S2',kind:'transfer',status:'SUBMITTING',runId:'previous-run'},calls=[];
 const env={EPP_RUN_ID:'new-run',ALLOW_PAYMENT_SUBMIT:'1',CL_QST_TARGET_IDS:'SAM-24864,SAM-24865,SAM-24866'};
 const run=vm.runInNewContext(source+'\nrunEppPaymentPrerequisiteCase;',{process:{env},attempts:{pendingEppOrderAttempt:(_,kind)=>kind==='transfer'?old:null,confirmedEppOrderForRun:()=>null},test:{setTimeout(){},skip:(_,reason)=>{calls.push(reason);throw Object.assign(Error(reason),{blocked:true});}},probeEppPaymentPrerequisites:()=>assert.fail('must not open checkout')});
 const cfg={market:'CL',environment:'S2',program:'alianzas'};
 for(const authorized of ['0','1']){
  env.ALLOW_PAYMENT_SUBMIT=authorized;
  const optionsToCheck=authorized==='0'?[{kind:'card'},{kind:'transfer'},{kind:'card',confirmationOnly:true}]:[{kind:'transfer'},{kind:'card',confirmationOnly:true}];
  for(const options of optionsToCheck)await assert.rejects(run({},cfg,options),e=>e.blocked&&e.message.startsWith('AMBIGUOUS_EPP_ORDER_ATTEMPT:'));
 }
 assert.equal(calls.length,5);assert.equal(old.status,'SUBMITTING');assert.equal(old.runId,'previous-run');
});

test('confirmation inherits only its own campaign explicit payment prerequisite and never submits',async()=>{const calls=[],env={ALLOW_PAYMENT_SUBMIT:'1',EPP_RUN_ID:'campaign-a',PE_QST_TARGET_IDS:'SAM-25138,SAM-25140'},cfg={market:'PE',environment:'S2',program:'pe_membership_vip'};const source=require('fs').readFileSync('flows/eppPaymentPrerequisites.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');const run=require('vm').runInNewContext(source+'\nprobeEppPaymentPrerequisites=async()=>{calls.push("probe");return{status:"BLOCKED",reason:"AUTH_OR_ENTITLEMENT_REQUIRED",stage:"AUTH",detail:"Identity not accepted"};};runEppPaymentPrerequisiteCase;',{calls,process:{env},attempts:{pendingEppOrderAttempt:()=>null,confirmedEppOrderForRun:()=>null},submitPeEppCard(){throw Error('unexpected submit');},test:{setTimeout(){},info:()=>({annotations:[]}),skip:(_value,reason)=>{throw Object.assign(Error(reason),{skipped:true});}}});await assert.rejects(run({},cfg,{kind:'card'}),e=>e.skipped&&/AUTH_OR_ENTITLEMENT_REQUIRED/.test(e.message));await assert.rejects(run({},cfg,{kind:'card',confirmationOnly:true}),e=>e.skipped&&/campaign payment was blocked/.test(e.message));assert.deepEqual(calls,['probe']);env.EPP_RUN_ID='campaign-b';await assert.rejects(run({},cfg,{kind:'card',confirmationOnly:true}),/CURRENT_RUN_ORDER_REQUIRED/);assert.deepEqual(calls,['probe']);});

test('explicit new MX card order preserves unrelated cash while same-method and other scopes stay guarded',async()=>{
 const old={market:'MX',environment:'S2',kind:'cash',status:'SUBMITTING',runId:'previous-cash'},calls=[];
 const env={EPP_RUN_ID:'new-card',ALLOW_PAYMENT_SUBMIT:'1'};
 let card=null;
 const run=vm.runInNewContext(source+'\nprobeEppPaymentPrerequisites=async()=>{calls.push("new-card");return{status:"PASS",orderCode:"MX261107-12345678"};};runEppPaymentPrerequisiteCase;',{calls,process:{env},attempts:{pendingEppOrderAttempt:(_,kind)=>kind==='cash'?old:card,confirmedEppOrderForRun:()=>null},test:{setTimeout(){},info:()=>({annotations:[]}),skip:(_,reason)=>{throw Error(reason);}},submitMxEppCard(){}});
 const cfg={market:'MX',environment:'S2',program:'pymesmx'};
 await run({},cfg,{kind:'card'});assert.deepEqual(calls,['new-card']);assert.equal(old.status,'SUBMITTING');assert.equal(old.runId,'previous-cash');
 card={kind:'card',status:'SUBMITTING'};await assert.rejects(run({},cfg,{kind:'card'}),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);card=null;
 for(const candidate of [{...cfg,environment:'S1'},{...cfg,program:'other'},{...cfg,market:'PE'}])await assert.rejects(run({},candidate,{kind:'card'}),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);
 await assert.rejects(run({},cfg,{kind:'cash'}),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);
 env.ALLOW_PAYMENT_SUBMIT='0';await assert.rejects(run({},cfg,{kind:'card'}),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);assert.deepEqual(calls,['new-card']);
});

test('explicit new CL card order leaves bank initiation intact and cannot authorize a bank replay',async()=>{
 const old={kind:'transfer',status:'SUBMITTING',runId:'previous-bank'},calls=[];
 const env={EPP_RUN_ID:'new-card',ALLOW_PAYMENT_SUBMIT:'1'};
 const run=vm.runInNewContext(source+'\nprobeEppPaymentPrerequisites=async()=>{calls.push("new-card");return{status:"PASS",orderCode:"CL261107-12345678"};};runEppPaymentPrerequisiteCase;',{calls,process:{env},attempts:{pendingEppOrderAttempt:(_,kind)=>kind==='transfer'?old:null,confirmedEppOrderForRun:()=>null},test:{setTimeout(){},info:()=>({annotations:[]}),skip:(_,reason)=>{throw Error(reason);}},submitClEppCard(){},submitClEppBank(){}});
 const cfg={market:'CL',environment:'S2',program:'alianzas'};
 await run({},cfg,{kind:'card'});assert.deepEqual(calls,['new-card']);assert.equal(old.status,'SUBMITTING');
 await assert.rejects(run({},cfg,{kind:'card',confirmationOnly:true}),/CURRENT_RUN_ORDER_REQUIRED/);
 await assert.rejects(run({},cfg,{kind:'transfer'}),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);
 env.ALLOW_PAYMENT_SUBMIT='0';await assert.rejects(run({},cfg,{kind:'card'}),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);assert.deepEqual(calls,['new-card']);
});
