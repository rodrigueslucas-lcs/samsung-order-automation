const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppMxCardPayment.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({provider='secure-fields.mercadopago.com',ambiguous=false,reconciled=false,businessRejected=false,orderCode='PE261029-12345678_261029120000',routeOrderCode=orderCode,recoveryFails=false,confirmationHelper=true,program='pe_membership_vip',reconciledOrder='PE261029-12345678',confirmationFails=false,existingOrders=[]}={}){
 const calls=[],root=new URL('https://stg2.shop.samsung.com/pe/multistore/pe_membership_vip/pe_membership_vip/');let url=new URL('checkout/one?step=CHECKOUT_STEP_PAYMENT',root).href;
 const page={url:()=>url,goto:async target=>{url=target;calls.push('recover');},frameLocator:()=>({locator:()=>({evaluate:async()=>provider})}),getByRole:()=>({filter:()=>({count:async()=>0})}),getByText:()=>({first:()=>({})})};
 class PaymentPage{
  async selectCreditCard(){calls.push('select');}
  async fillCardData(){calls.push('fill');}
  async validateCreditCardReady(){calls.push('ready');}
  async placeOrderAndCapture(options){calls.push('submit');assert.ok(options.orderCodePattern.test('PE261029-12345678_261029120000'));assert.ok(options.submitResponsePathPattern.test('/tokocommercewebservices/v2/pe_membership_vip/users/current/carts/current/paymentmodes/pe-mercadoCC/submitOrder'));assert.ok(!options.orderResponsePathPattern.test('/tokocommercewebservices/v2/pe/users/current/orders/PE261029-12345678'));if(businessRejected)throw Error('Payment submit business code 601');if(ambiguous)throw Error('sensitive-response');url=new URL('orderConfirmation'+(routeOrderCode?';orderCode='+routeOrderCode:''),root).href;return{orderCode};}
 }
 const run=vm.runInNewContext(source+'\nsubmitPeEppCard;',{URL,RegExp,PaymentPage,expect:()=>({toHaveURL:async()=>{},toBeVisible:async()=>{if(confirmationFails)throw Error('Success UI not visible');}}),test:{info:()=>({attach:async()=>{}})},assertions:{assertStoreRoute:()=>{}},guards:{requirePaymentSubmitOptIn:()=>calls.push('optin')},runtime:{getEppRuntimeData:()=>({payment:{card:Object.fromEntries(['number','holderName','expiry','cvv','document'].map(k=>[k,'synthetic']))}})},attemptModule:{beginEppOrderAttempt:()=>{calls.push('marker');return{observe:()=>calls.push('observed'),confirm:()=>calls.push('confirmed')};}}});
 const confirm=async(_page,cfg,record,options)=>{assert.equal(cfg.program,'pe_membership_vip');assert.equal(record.status,'OBSERVED_ORDER');assert.equal(record.orderCode,orderCode);assert.equal(options.allowObservedOrder,true);calls.push('scoped-GET-UI');if(recoveryFails)throw Error('API did not prove causal order');};
 return{calls,run:()=>run(page,{market:'PE',environment:'S2',program,rootUrl:root},async()=>{},reconciled?{beforeSubmit:async()=>{calls.push('baseline');return new Set(existingOrders);},afterSubmit:async()=>{calls.push('GET-only-reconcile');return reconciledOrder?{orderCode:reconciledOrder}:null;}}:undefined,confirmationHelper?confirm:undefined)};
}
test('PE reuses the single-submit adapter with exact EPP provider endpoints and confirmation',async()=>{const f=fixture();assert.equal((await f.run()).status,'PASS');assert.deepEqual(f.calls,['optin','select','fill','ready','marker','submit','observed','confirmed']);});
test('PE never sends approved data to foreign secure fields',async()=>{const f=fixture({provider:'foreign.example'});await assert.rejects(f.run(),/provider contract/);assert.ok(!f.calls.includes('fill'));assert.ok(!f.calls.includes('marker'));});
test('PE ambiguous financial response preserves the marker and is never retried',async()=>{const f=fixture({ambiguous:true});await assert.rejects(f.run(),e=>/EPP_SINGLE_SUBMIT_UNCONFIRMED/.test(e.message)&&!e.message.includes('sensitive-response'));assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));});
test('PE timeout can recover a uniquely reconciled causal order without another submit',async()=>{const f=fixture({ambiguous:true,reconciled:true});assert.equal((await f.run()).status,'PASS');assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(f.calls.indexOf('baseline')<f.calls.indexOf('marker'));assert.ok(f.calls.includes('GET-only-reconcile'));assert.ok(f.calls.includes('confirmed'));});
test('PE 601 still requires a uniquely reconciled causal order and success UI for frontend PASS',async()=>{const f=fixture({businessRejected:true,reconciled:true});assert.equal((await f.run()).status,'PASS');assert.equal(f.calls.filter(c=>c==='submit').length,1);assert.ok(f.calls.includes('GET-only-reconcile'));assert.ok(f.calls.includes('confirmed'));});

test('PE public response and internal URL require scoped API/UI reconciliation with one submit',async()=>{
 const f=fixture({orderCode:'PE261029-12345678',routeOrderCode:'PE261029-12345678_261029120000'});assert.equal((await f.run()).status,'PASS');assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(f.calls.includes('scoped-GET-UI'));assert.ok(f.calls.includes('confirmed'));
});
test('PE internal response and public URL also require causal API/UI proof',async()=>{
 const f=fixture({routeOrderCode:'PE261029-12345678'});assert.equal((await f.run()).status,'PASS');assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(f.calls.includes('scoped-GET-UI'));
});
test('PE alias proof failure preserves the observed attempt without another submit',async()=>{
 const f=fixture({orderCode:'PE261029-12345678',routeOrderCode:'PE261029-12345678_261029120000',recoveryFails:true});await assert.rejects(f.run(),/API did not prove causal order/);assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));
});
for(const options of [{routeOrderCode:'PE261029-99999999'},{routeOrderCode:'PE261029-12345678_261029130000'},{routeOrderCode:null},{orderCode:'PE261029-12345678',routeOrderCode:'PE261029-12345678_261029120000',program:'other'}])test('PE alias recovery rejects '+JSON.stringify(options),async()=>{
 const f=fixture(options);await assert.rejects(f.run(),/does not identify the causal order/);assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(!f.calls.includes('scoped-GET-UI'));assert.ok(!f.calls.includes('confirmed'));
});
test('PE alias cannot pass without the independent confirmation helper',async()=>{
 const f=fixture({orderCode:'PE261029-12345678',routeOrderCode:'PE261029-12345678_261029120000',confirmationHelper:false});await assert.rejects(f.run(),/does not identify the causal order/);assert.ok(!f.calls.includes('confirmed'));
});

test('PE 601 without a causal order cannot pass or retry',async()=>{const f=fixture({businessRejected:true,reconciled:true,reconciledOrder:null});await assert.rejects(f.run(),/businessCode=601/);assert.equal(f.calls.filter(c=>c==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));});
test('PE 601 with an order but no success UI preserves the observed marker',async()=>{const f=fixture({businessRejected:true,reconciled:true,confirmationFails:true});await assert.rejects(f.run(),/Success UI not visible/);assert.equal(f.calls.filter(c=>c==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));});
test('another PE programme cannot use the observed 601 frontend exception',async()=>{const f=fixture({businessRejected:true,reconciled:true,program:'other'});await assert.rejects(f.run(),/businessCode=601/);assert.ok(!f.calls.includes('GET-only-reconcile'));});

test('PE normal submit cannot promote a pre-existing internal/public alias to a new order',async()=>{const f=fixture({reconciled:true,existingOrders:['PE261029-12345678']});await assert.rejects(f.run(),/EPP_EXISTING_ORDER_RETURNED/);assert.equal(f.calls.filter(c=>c==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));});
