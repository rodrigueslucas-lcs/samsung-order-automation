const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('flows/eppPaymentPrerequisites.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({accepted=true,product=true,market='MX',step='CHECKOUT_STEP_CONTACT_INFO',pending=null,resume=false,authorized=true}={}){
 const calls=[];const entries=[];const cfg={market,environment:'S2',rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/'),...(product?{sku:'QA',pdpUrl:'qa'}:{})};
 const cart={validateControlledSingleSku:async()=>calls.push('sku'),proceedToAuthenticatedCheckout:async()=>calls.push('checkout')};
 const page={on:(_event,listener)=>listener({url:()=>`https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/${cfg.rootUrl.pathname.split('/').filter(Boolean)[2]}/users/current/carts/current`,request:()=>({method:()=> 'GET'}),ok:()=>true}),off:()=>{},context:()=>({}),url:()=>cfg.rootUrl.href+'checkout/one?step='+step};
 const api=vm.runInNewContext(source+'\n({probeEppPaymentPrerequisites,runEppPaymentPrerequisiteCase});',{
 URL,clPaymentCart:{prepareClPaymentCart:async()=>{},normalizeClPaymentQuantity:async()=>{}},completeClEppCheckout:async()=>({status:'BLOCKED',reason:'MISSING_EPP_CONTACT_DATA'}),submitMxEppCard:async()=>{throw Error('Unexpected financial adapter invocation in prerequisite fixture');},attempts:{pendingEppOrderAttempt:()=>pending},process:{env:{...(resume?{EPP_RESUME_PENDING_ORDER:'1'}:{}),...(authorized?{ALLOW_PAYMENT_SUBMIT:'1'}:{})}},session:{getPrimaryEppCredentials:()=>({email:'ignored'})},server:{watchEppServerProof:()=>({accepted:()=>accepted,settle:async()=>{},stop:()=>calls.push('stop')})},runtime:{getEppRuntimeData:()=>null,getEppContact:()=>null},assertions:{assertStoreRoute:()=>{}},openEppStore:async(_page,config)=>{calls.push('open');entries.push(config.entryUrl);},addConfiguredEppProduct:async()=>{calls.push('add');return cart;},test:{setTimeout:()=>{},info:()=>({annotations:[]}),skip:()=>{}},
 });return {calls,entries,run:()=>api.probeEppPaymentPrerequisites(page,cfg),wrapper:()=>api.runEppPaymentPrerequisiteCase(page,cfg,{kind:'card'})};
}
test('payment prerequisite cannot mutate cart before independent entitlement proof',async()=>{const f=fixture({accepted:false});assert.equal((await f.run()).reason,'AUTH_OR_ENTITLEMENT_REQUIRED');assert.deepEqual(f.calls,['open','stop']);});
test('missing eligible EPP product is specific and does not add a guessed SKU',async()=>{const f=fixture({product:false});assert.equal((await f.run()).reason,'MISSING_OR_UNPROVEN_EPP_PRODUCT');assert.ok(!f.calls.includes('add'));});
test('MX contact fixture is required after a controlled exact-SKU cart',async()=>{const f=fixture();assert.equal((await f.run()).reason,'MISSING_EPP_CONTACT_DATA');assert.deepEqual(f.calls,['open','add','sku','checkout','stop']);});
test('non-MX checkout without local contact mass reports its concrete data prerequisite',async()=>{const f=fixture({market:'CL'});assert.equal((await f.run()).reason,'MISSING_EPP_CONTACT_DATA');assert.ok(f.calls.includes('stop'));});
test('even a returning skip stub cannot turn prerequisite discovery into payment PASS',async()=>{await assert.rejects(fixture({accepted:false}).wrapper(),/causal confirmed order/);});

test('an unresolved attempt prevents a fresh cart or submit before any store action',async()=>{const f=fixture({pending:{kind:'card',status:'SUBMITTING'}});await assert.rejects(f.wrapper(),/AMBIGUOUS_EPP_ORDER_ATTEMPT/);assert.deepEqual(f.calls,[]);});

test('read-only recovery with no pending attempt cannot reset or add to a cart',async()=>{const f=fixture({resume:true});await assert.rejects(f.wrapper(),/No pending EPP attempt/);assert.deepEqual(f.calls,[]);});

test('missing submit authorization blocks before opening or changing the cart',async()=>{const f=fixture({authorized:false});await assert.rejects(f.wrapper(),/PAYMENT_SUBMIT_NOT_AUTHORIZED/);assert.deepEqual(f.calls,[]);});

test('eligible configured PDP is used without requiring commerce slots on programme home',async()=>{const f=fixture();await f.run();assert.equal(f.entries[0],'qa');});

test('CL independent bank case requires causal card confirmation and never releases either payment marker',async()=>{
 const calls=[],card={market:'CL',environment:'S2',kind:'card',status:'OBSERVED_ORDER',orderCode:'CL261104-12345678_261104120000'};
 let transfer=null,verifyFails=false;
 const run=vm.runInNewContext(source+'\nprobeEppPaymentPrerequisites=async()=>{calls.push("bank-prerequisites");return{status:"BLOCKED",reason:"DATA",detail:"synthetic"};};\nrunEppPaymentPrerequisiteCase;',{
  calls,process:{env:{ALLOW_PAYMENT_SUBMIT:'1'}},attempts:{latestConfirmedEppOrder:()=>null,pendingEppOrderAttempt:(_,kind)=>kind==='card'?card:transfer},
  validateExistingEppCardOrder:async(_,cfg,record,options)=>{assert.equal(cfg.market,'CL');assert.equal(record,card);assert.equal(options.allowObservedOrder,true);calls.push('read-only-confirmation');if(verifyFails)throw Error('unproven');},submitClEppBank(){throw Error('No direct bank invocation allowed');},
  test:{setTimeout(){},skip(){},info:()=>({annotations:[]})},
 });
 await assert.rejects(run({}, {market:'CL',environment:'S2'}, {kind:'transfer'}),/causal confirmed order/);
 assert.deepEqual(calls,['read-only-confirmation','bank-prerequisites']);assert.equal(card.status,'OBSERVED_ORDER');
 calls.length=0;transfer={kind:'transfer',status:'SUBMITTING'};
 await assert.rejects(run({}, {market:'CL',environment:'S2'}, {kind:'transfer'}),/AMBIGUOUS/);assert.deepEqual(calls,[]);
 transfer=null;verifyFails=true;
 await assert.rejects(run({}, {market:'CL',environment:'S2'}, {kind:'transfer'}),/unproven/);assert.deepEqual(calls,['read-only-confirmation']);
});

test('CL bank recovery requires previous simulator confirmation and does not execute another financial flow',async()=>{
 const calls=[],record={kind:'transfer',status:'OBSERVED_ORDER',orderCode:'CL261104-12345678',providerConfirmationSubmitted:false};
 const run=vm.runInNewContext(source+'\nrunEppPaymentPrerequisiteCase;',{
  process:{env:{EPP_RESUME_PENDING_ORDER:'1'}},attempts:{latestConfirmedEppOrder:()=>null,pendingEppOrderAttempt:(_,kind)=>{assert.equal(kind,'transfer');return record;},confirmPendingEppOrder:(_,kind,code)=>{assert.equal(kind,'transfer');assert.equal(code,record.orderCode);calls.push('confirm-record');}},
  validateExistingEppCardOrder:async(_,cfg,r,options)=>{assert.equal(cfg.market,'CL');assert.equal(r,record);assert.equal(options.allowObservedOrder,true);calls.push('GET-and-UI');},test:{setTimeout(){}},
 });
 await assert.rejects(run({}, {market:'CL'}, {kind:'transfer'}),/submitted Flow confirmation/);assert.deepEqual(calls,[]);
 record.providerConfirmationSubmitted=true;await run({}, {market:'CL'}, {kind:'transfer'});assert.deepEqual(calls,['GET-and-UI','confirm-record']);
});

test('CL frontend card acceptance requires its own causal GET/UI and preserves the financial marker',async()=>{
 const calls=[],record={kind:'card',status:'SUBMITTING',orderCode:null};
 const run=vm.runInNewContext(source+'\nrunEppPaymentPrerequisiteCase;',{
  process:{env:{EPP_RESUME_PENDING_ORDER:'1',ALLOW_PAYMENT_SUBMIT:'0'}},attempts:{pendingEppOrderAttempt:(_,kind)=>{assert.equal(kind,'card');return record;},confirmPendingEppOrder(){throw Error('Financial marker must remain intact');}},
  validateExistingEppCardOrder:async(_,cfg,r,options)=>{assert.equal(cfg.market,'CL');assert.equal(r,record);assert.equal(options.allowObservedOrder,true);calls.push('GET-and-UI');},
  test:{setTimeout(){},info:()=>({attach:async(_,attachment)=>{const data=JSON.parse(attachment.body);assert.equal(data.submitCount,0);assert.equal(data.paymentSettlementAsserted,false);assert.equal(data.originalSubmitEvidencePreserved,true);calls.push('acceptance');}})},
 });
 await assert.rejects(run({}, {market:'CL',environment:'S2'}, {kind:'card'}),/own reconciled order/);assert.deepEqual(calls,[]);
 record.status='OBSERVED_ORDER';record.orderCode='CL261104-12345678';
 await run({}, {market:'CL',environment:'S2'}, {kind:'card'});assert.deepEqual(calls,['GET-and-UI','acceptance']);assert.equal(record.status,'OBSERVED_ORDER');
});
