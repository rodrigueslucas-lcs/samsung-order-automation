const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('flows/eppMxCardPayment.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({environment='S2',provider='secure-fields.mercadopago.com',captureFails=false,orderCode='MX261027-12345678',routeOrderCode=orderCode,matrix=true,saveInitially=false,saveCannotDisable=false,fillFails=false,businessCode=null,reconciliation=null,failConfirmation=false}={}){
 const calls=[];let saveState=saveInitially;let current='https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/checkout/one?step=CHECKOUT_STEP_PAYMENT';const page={url:()=>current,goto:async url=>{current=url;},getByRole:role=>({filter:()=>role==='checkbox'?{count:async()=>saveInitially?1:0,nth:()=>({isChecked:async()=>saveState,uncheck:async()=>{calls.push('disable-save');if(!saveCannotDisable)saveState=false;}})}:{first:()=>({})}}),frameLocator:()=>({locator:()=>({evaluate:async()=>provider})}),getByText:text=>{if(typeof text==='string')assert.equal(text,orderCode.replace(/_\d+$/,''));return{first:()=>({})};}};
 class PaymentPage{async selectCreditCard(){calls.push('select');}async fillCardData(){calls.push('fill');if(fillFails)throw Error('synthetic-private-provider-input');}async validateCreditCardReady(){calls.push('validate');}async placeOrderAndCapture(options){calls.push('submit');assert.equal(options.submitResponsePathPattern.test('/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes/mx-mercadoCC/submitOrder'),true);assert.equal(options.submitResponsePathPattern.test('/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes/mx-mercadoDC/submitOrder'),false);assert.equal(options.submitResponsePathPattern.test('/tokocommercewebservices/v2/pymesmx/users/current/carts/current/paymentmodes/mx-mercadoCc/submitOrder'),true);assert.ok(options.orderResponsePathPattern.test('/tokocommercewebservices/v2/pymesmx/users/current/orders/MX261027-12345678'));assert.ok(!options.orderResponsePathPattern.test('/tokocommercewebservices/v2/pymesmx/order/MX261026-12345678/analytics'));if(captureFails)throw new Error(businessCode?'synthetic business code '+businessCode:'ambiguous submit');current='https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/orderConfirmation'+(matrix?';':'?')+'orderCode='+routeOrderCode;return{orderCode};}}
 const submit=vm.runInNewContext(source+'\nsubmitMxEppCard;',{PaymentPage,MarketPaymentPage:class extends PaymentPage{constructor(page,options){super(page);assert.equal(options.market,'MX');assert.equal(options.cardPanel,'credit');}},URL,RegExp,expect:()=>({toHaveURL:async()=>{},toBeVisible:async()=>{if(failConfirmation)throw Error('Confirmation UI absent');}}),test:{info:()=>({attach:async()=>{}})},assertions:{assertStoreRoute:()=>calls.push('scope')},runtime:{getEppRuntimeData:()=>({payment:{card:Object.fromEntries(['number','holderName','expiry','cvv','document'].map(k=>[k,'fixture']))}})},guards:{requirePaymentSubmitOptIn:()=>calls.push('optin')},attemptModule:{beginEppOrderAttempt:()=>{calls.push('marker');return{observe:()=>calls.push('observed'),confirm:()=>calls.push('confirmed')};}}});
 return{calls,run:()=>submit(page,{market:'MX',environment,program:'pymesmx',rootUrl:new URL('https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/')},async()=>{},reconciliation)};
}
test('unproven S1 adapter blocks before payment interaction',async()=>{const f=fixture({environment:'S1'});assert.equal((await f.run()).status,'BLOCKED');assert.deepEqual(f.calls,[]);});
test('foreign secure-fields provider cannot receive fixture or create attempt',async()=>{const f=fixture({provider:'foreign.example'});await assert.rejects(f.run(),/provider contract/);assert.ok(!f.calls.includes('fill'));assert.ok(!f.calls.includes('marker'));});
test('single submit is preceded by validated fixture and durable marker, followed by causal confirmation',async()=>{const f=fixture();assert.equal((await f.run()).status,'PASS');assert.deepEqual(f.calls,['scope','optin','select','fill','validate','marker','submit','observed','scope','confirmed']);});
test('ambiguous submit is never retried or marked confirmed',async()=>{const f=fixture({captureFails:true});await assert.rejects(f.run(),/EPP_SINGLE_SUBMIT_UNCONFIRMED/);assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));});

for(const result of ['fresh','absent','old','missing-ui'])test(`MX S2 601 needs new causal order plus genuine confirmation (${result})`,async()=>{
 const baseline=new Set(['MX261026-87654321']);let reads=0;
 const reconciliation={beforeSubmit:async()=>baseline,afterSubmit:async actual=>{assert.equal(actual,baseline);reads++;return result==='absent'?null:{orderCode:result==='old'?'MX261026-87654321':'MX261027-12345678'};}};
 const f=fixture({captureFails:true,businessCode:'601',reconciliation,failConfirmation:result==='missing-ui'});
 if(result==='fresh')assert.equal((await f.run()).status,'PASS');
 else await assert.rejects(f.run(),result==='old'?/EPP_EXISTING_ORDER_RETURNED/:result==='missing-ui'?/Confirmation UI absent/:/EPP_SINGLE_SUBMIT_UNCONFIRMED/);
 assert.equal(reads,1);assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.equal(f.calls.includes('confirmed'),result==='fresh');
});

test('internal suffix stays bound to matrix URL while public number is checked without it',async()=>{assert.equal((await fixture({orderCode:'MX261027-12345678_261027120000000'}).run()).status,'PASS');});
test('query parameter cannot replace the observed matrix route or archive the attempt',async()=>{const f=fixture({matrix:false});await assert.rejects(f.run(),/does not identify the causal order/);assert.ok(!f.calls.includes('confirmed'));});

test('a checked save-card option is disabled before filling and submitting',async()=>{const f=fixture({saveInitially:true});await f.run();assert.ok(f.calls.indexOf('disable-save')<f.calls.indexOf('fill'));});
test('failed save-card disable prevents fixture entry and submit',async()=>{const f=fixture({saveInitially:true,saveCannotDisable:true});await assert.rejects(f.run(),/persistence could not be disabled/);assert.ok(!f.calls.includes('fill'));assert.ok(!f.calls.includes('submit'));});

test('card-entry exception never exposes provider input or reaches submit marker',async()=>{const f=fixture({fillFails:true});await assert.rejects(f.run(),error=>/entry\/readiness failed/.test(error.message)&&!error.message.includes('synthetic-private'));assert.ok(!f.calls.includes('marker'));assert.ok(!f.calls.includes('submit'));});

test('MX public response and its single internal route alias identify the same order',async()=>{
 const f=fixture({routeOrderCode:'MX261027-12345678_261027120000000'});assert.equal((await f.run()).status,'PASS');assert.equal(f.calls.filter(x=>x==='submit').length,1);
});
test('different public order or two different internal suffixes cannot confirm the submitted order',async()=>{
 for(const options of [{routeOrderCode:'MX261027-99999999'},{orderCode:'MX261027-12345678_111',routeOrderCode:'MX261027-12345678_222'}]){const f=fixture(options);await assert.rejects(f.run(),/does not identify the causal order/);assert.ok(!f.calls.includes('confirmed'));}
});

test('MX waits for the causal matrix identity after the shell and checks a bounded public label',async()=>{
 let current='https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/orderConfirmation;orderCode=null';let waited=false;
 const page={url:()=>current,getByText:value=>{if(value.source?.includes('MX261027')){assert.ok(value.test('Número de Orden MX261027-12345678'));assert.ok(!value.test('Número de Orden MX261027-123456789'));assert.ok(!value.test('MX261027-99999999'));}return{first:()=>({})};}};
 const validate=vm.runInNewContext(source+'\nvalidateMxEppConfirmation;',{URL,RegExp,assertions:{assertStoreRoute:()=>assert.ok(waited)},expect:()=>({toHaveURL:async predicate=>{assert.equal(predicate(new URL(current)),false);current=current.replace('null','MX261027-12345678_261027120000000');assert.equal(predicate(new URL(current)),true);waited=true;},toBeVisible:async()=>{}})});
 await validate(page,{market:'MX',environment:'S2',program:'pymesmx'},'MX261027-12345678');assert.ok(waited);
});

test('shared public number requires independent causal readback of a distinct internal order',()=>{
 const check=vm.runInNewContext(source+'\nassertFreshEppOrder;');
 const old='CL261109-78849757_261110031848044',fresh='CL261109-78849757_261110033551458';
 const baseline=new Set([old]);
 assert.throws(()=>check(baseline,fresh),/EPP_EXISTING_ORDER_RETURNED/);
 assert.doesNotThrow(()=>check(baseline,fresh,fresh));
 assert.throws(()=>check(baseline,old,old),/EPP_EXISTING_ORDER_RETURNED/);
 assert.throws(()=>check(baseline,fresh,old),/EPP_EXISTING_ORDER_RETURNED/);
 assert.throws(()=>check(baseline,'CL261109-78849757'),/EPP_EXISTING_ORDER_RETURNED/);
});
