const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppClBankPayment.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({ambiguous=false}={}){
 const calls=[],root=new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/');let url=new URL('checkout/one?step=CHECKOUT_STEP_PAYMENT',root).href;
 const header={getAttribute:async()=> 'false',click:async()=>calls.push('expand')},button={};
 const panel={locator:()=>header,getByRole:()=>({filter:()=>button})};
 const page={url:()=>url,locator:selector=>{assert.equal(selector,'mat-expansion-panel:has(> mat-expansion-panel-header img[src*="khipu.png"])');return panel;},waitForURL:async()=>{url='https://sandbox.flow.cl/sandbox';}};
 class MarketPaymentPage{async placeOrderAndCapture(options){calls.push('submit');assert.ok(options.submitResponsePathPattern.test('/tokocommercewebservices/v2/alianzas/users/current/carts/current/paymentmodes/cl-khipu/submitOrder'));assert.ok(!options.submitResponsePathPattern.test('/tokocommercewebservices/v2/cl/users/current/carts/current/paymentmodes/cl-khipu/submitOrder'));if(ambiguous)throw Error('sensitive');return{orderCode:'CL261030-12345678'};}}
 const run=vm.runInNewContext(source+'\nsubmitClEppBank;',{URL,RegExp,MarketPaymentPage,expect:()=>({toHaveCount:async()=>{},toBeEnabled:async()=>{},toHaveAttribute:async()=>{}}),guards:{requirePaymentSubmitOptIn:()=>calls.push('optin')},assertions:{assertStoreRoute:()=>{}},attempts:{beginEppOrderAttempt:()=>{calls.push('marker');return{observe:()=>calls.push('observed'),confirm:()=>calls.push('confirmed')};}},completeClFlowSandbox:async()=>calls.push('sandbox'),validateMxEppConfirmation:async()=>calls.push('confirmation'),test:{info:()=>({attach:async()=>{}})}});
 return{calls,run:()=>run(page,{market:'CL',environment:'S2',rootUrl:root},async()=>{})};
}
test('CL EPP Khipu selects the unique logo, submits once and validates genuine sandbox confirmation',async()=>{const f=fixture();assert.equal((await f.run()).status,'PASS');assert.deepEqual(f.calls,['optin','expand','marker','submit','observed','sandbox','confirmation','confirmed']);});
test('CL EPP bank ambiguity preserves marker and never repeats submit',async()=>{const f=fixture({ambiguous:true});await assert.rejects(f.run(),/SINGLE_SUBMIT_UNCONFIRMED/);assert.equal(f.calls.filter(x=>x==='submit').length,1);assert.ok(!f.calls.includes('confirmed'));});
