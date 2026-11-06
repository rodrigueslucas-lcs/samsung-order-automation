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

test('confirmation inherits only its own campaign explicit payment prerequisite and never submits',async()=>{const calls=[],env={ALLOW_PAYMENT_SUBMIT:'1',EPP_RUN_ID:'campaign-a',PE_QST_TARGET_IDS:'SAM-25138,SAM-25140'},cfg={market:'PE',environment:'S2',program:'pe_membership_vip'};const source=require('fs').readFileSync('flows/eppPaymentPrerequisites.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');const run=require('vm').runInNewContext(source+'\nprobeEppPaymentPrerequisites=async()=>{calls.push("probe");return{status:"BLOCKED",reason:"AUTH_OR_ENTITLEMENT_REQUIRED",stage:"AUTH",detail:"Identity not accepted"};};runEppPaymentPrerequisiteCase;',{calls,process:{env},attempts:{pendingEppOrderAttempt:()=>null,confirmedEppOrderForRun:()=>null},submitPeEppCard(){throw Error('unexpected submit');},test:{setTimeout(){},info:()=>({annotations:[]}),skip:(_value,reason)=>{throw Object.assign(Error(reason),{skipped:true});}}});await assert.rejects(run({},cfg,{kind:'card'}),e=>e.skipped&&/AUTH_OR_ENTITLEMENT_REQUIRED/.test(e.message));await assert.rejects(run({},cfg,{kind:'card',confirmationOnly:true}),e=>e.skipped&&/campaign payment was blocked/.test(e.message));assert.deepEqual(calls,['probe']);env.EPP_RUN_ID='campaign-b';await assert.rejects(run({},cfg,{kind:'card',confirmationOnly:true}),/CURRENT_RUN_ORDER_REQUIRED/);assert.deepEqual(calls,['probe']);});
