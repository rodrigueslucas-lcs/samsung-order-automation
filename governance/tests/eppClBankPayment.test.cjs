const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppClBankPayment.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({ambiguous=false,formUnavailable=false,forbiddenUrl=null}={}){
 const calls=[],root=new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/');let url=new URL('checkout/one?step=CHECKOUT_STEP_PAYMENT',root).href;
 const header={getAttribute:async()=> 'false',click:async()=>calls.push('expand')},button={};
 const form={getByRole:()=>({filter:()=>button})};const panel={locator:selector=>{if(selector===':scope > mat-expansion-panel-header')return header;assert.equal(selector,'app-payment-mode-flow-khipu');return form;},getByRole:()=>{throw Error('Ambiguous panel-wide Pay locator must not be used');}};
 let responseListener;
 const page={on:(event,listener)=>{responseListener=listener;},off:()=>{responseListener=null;},url:()=>url,locator:selector=>{assert.equal(selector,'mat-expansion-panel:has(> mat-expansion-panel-header img[src*="khipu.png"])');return panel;},waitForURL:async()=>{url='https://sandbox.flow.cl/sandbox';}};
 class MarketPaymentPage{async placeOrderAndCapture(options){calls.push('submit');assert.ok(options.submitResponsePathPattern.test('/tokocommercewebservices/v2/alianzas/users/current/carts/current/paymentmodes/cl-khipu/submitOrder'));assert.ok(!options.submitResponsePathPattern.test('/tokocommercewebservices/v2/cl/users/current/carts/current/paymentmodes/cl-khipu/submitOrder'));if(forbiddenUrl){responseListener({url:()=>forbiddenUrl,status:()=>403,request:()=>({method:()=> 'POST'})});throw Error('sensitive');}if(ambiguous)throw Error('sensitive');return{orderCode:'CL261030-12345678'};}}
 const run=vm.runInNewContext(source+'\nsubmitClEppBank;',{URL,RegExp,MarketPaymentPage,expect:target=>({toBeVisible:async()=>{calls.push('bank-form-ready');},toHaveCount:async(count,options)=>{if(target===form){assert.equal(options?.timeout,60000,'lazy component needs its bounded hydration wait');if(formUnavailable)throw Error('bank form unavailable');}},toBeEnabled:async()=>{},toHaveAttribute:async()=>{}}),guards:{requirePaymentSubmitOptIn:()=>calls.push('optin')},assertions:{assertStoreRoute:()=>{}},attempts:{beginEppOrderAttempt:()=>{calls.push('marker');return{observe:()=>calls.push('observed'),confirm:()=>calls.push('confirmed')};}},completeClFlowSandbox:async()=>calls.push('sandbox'),validateMxEppConfirmation:async()=>calls.push('confirmation'),test:{info:()=>({attach:async()=>{}})}});
 return{calls,run:()=>run(page,{market:'CL',environment:'S2',rootUrl:root},async()=>{})};
}
test('CL EPP Khipu waits for the lazy form before its marker, submits once and validates genuine sandbox confirmation',async()=>{const f=fixture();assert.equal((await f.run()).status,'PASS');assert.deepEqual(f.calls,['optin','expand','bank-form-ready','marker','submit','observed','sandbox','confirmation','confirmed']);});
test('CL EPP bank ambiguity preserves marker and never repeats submit',async()=>{const f=fixture({ambiguous:true});await assert.rejects(f.run(),/SINGLE_SUBMIT_UNCONFIRMED/);assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));});

test('unavailable lazy bank form never creates an attempt or submits payment',async()=>{const f=fixture({formUnavailable:true});await assert.rejects(f.run(),/bank form unavailable/);assert.deepEqual(f.calls,['optin','expand']);});

test('only the causal own-programme Khipu HTTP403 emits the mapped bug signature, without retry',async()=>{
 const own='https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/alianzas/users/current/carts/current/paymentmodes/cl-khipu/submitOrder';
 for(const [forbiddenUrl,mapped]of [[own,true],[own.replace('/alianzas/','/cl/'),false],[own.replace('cl-khipu','cl-mercadoCC'),false],[own.replace('s2-smb-api-cdn.ecom-stg.samsung.com','foreign.invalid'),false]]){
  const f=fixture({forbiddenUrl});await assert.rejects(f.run(),mapped?/CL_EPP_BANK_FORBIDDEN_403/:/SINGLE_SUBMIT_UNCONFIRMED/);
  assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));
 }
});
