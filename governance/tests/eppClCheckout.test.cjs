const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppClCheckout.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export (async )?function/g,'$1function');
test('only the observed selected-new and hidden-existing-fields signature is the CL delivery blocker',()=>{
 const classify=vm.runInNewContext(source+'\nclassifyClEppAddressState;');
 assert.equal(classify({newChecked:true,streetFields:1,visibleStreet:0,visibleRegion:0}).reason,'ENVIRONMENT_DEFECT');
 const blocker=classify({newChecked:true,streetFields:1,visibleStreet:0,visibleRegion:0});
 assert.equal(blocker.classification,'APPLICATION_BUG');assert.equal(blocker.stage,'DELIVERY_FORM');
 assert.ok(blocker.expected&&blocker.actual&&blocker.manualAction);
 for(const state of [{newChecked:false,streetFields:1,visibleStreet:0,visibleRegion:0},{newChecked:true,streetFields:0,visibleStreet:0,visibleRegion:0},{newChecked:true,streetFields:1,visibleStreet:1,visibleRegion:1}])assert.equal(classify(state),null);
});
test('CL EPP checkout checks store scope and requires the existing local fixture before form actions',async()=>{
  const calls=[];const run=vm.runInNewContext(source+'\ncompleteClEppCheckout;',{assertions:{assertStoreRoute:()=>calls.push('scope')},runtime:{getEppRuntimeData:()=>null,getEppContact:()=>null}});
  const result=await run({url:()=> 'stage'}, {market:'CL'});
  assert.equal(result.reason,'MISSING_EPP_CONTACT_DATA');assert.deepEqual(calls,['scope']);
  await assert.rejects(run({}, {market:'MX'}),/another market/);
});
test('shared CL contact keeps prefilled data, fills only blanks and submits exactly once',async()=>{
  const code=fs.readFileSync('flows/cl/paymentFlows.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
  const fields={firstName:'Existing',lastName:'',phone:'',vatNumber:'12345678-5'},calls=[];
  const contact={locator:selector=>{const name=selector.match(/name="([^"]+)"/)[1];return{first:()=>({inputValue:async()=>fields[name],count:async()=>1,fill:async v=>{fields[name]=v;calls.push('fill:'+name);}})};},getByRole:()=>({click:async()=>calls.push('submit')})};
  const run=vm.runInNewContext(code+'\ncompleteClRegisteredContact;',{evidenceContext:{recordBusinessEvidence(){}},expect:()=>({toHaveURL:async()=>{}})});
  await run({url:()=>'?step=CHECKOUT_STEP_CONTACT_INFO',locator:()=>contact},{firstName:'QA',lastName:'Prueba',phone:'987654321'});
  assert.equal(fields.firstName,'Existing');assert.deepEqual(calls,['fill:lastName','fill:phone','submit']);
});

test('CL Delivery selects legal terms by accessible label across EPP and Base Store',async()=>{
 const code=fs.readFileSync('flows/cl/paymentFlows.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
 const calls=[];let checked=false;
 const terms={isChecked:async()=>checked,check:async()=>{checked=true;calls.push('terms');}};
 const shipping={getByText:()=>({filter:()=>({first:()=>({click:async()=>calls.push('shipping')})})}),getByRole:(role,options)=>{assert.equal(role,'checkbox');assert.ok(options.name.test('Acepto los términos y condiciones de Samsung.com/cl'));assert.ok(!options.name.test('Suscribir para recibir información'));return terms;}};
 const page={locator:()=>shipping,getByRole:()=>({click:async()=>calls.push('continue')})};
 const run=vm.runInNewContext(code+'\ncontinueClRegisteredDeliveryToPayment;',{evidenceContext:{recordBusinessEvidence(){}},expect:()=>({toBeVisible:async()=>{},toHaveURL:async()=>{}})});
 await run(page,{addressReady:true});assert.deepEqual(calls,['shipping','terms','continue']);
 calls.length=0;await run(page,{addressReady:true});assert.deepEqual(calls,['shipping','continue']);
});

test('CL preserves a visible selected saved destination in the approved commune',async()=>{
 const calls=[],address={region:'QA Region',commune:'QA Commune',street:'QA Street',number:'1'};
 const shipping={getByRole:(role,options)=>{assert.equal(role,'radio');if(options.name.test('Mis direcciones'))return{waitFor:async()=>{},isChecked:async()=>true};assert.equal(options.checked,true);assert.ok(options.name.test('1, QA Street, QA Commune, QA Region'));return{waitFor:async()=>{}};}};
 const run=vm.runInNewContext(source+'\ncompleteClEppCheckout;',{RegExp,expect:()=>({toBeChecked:async()=>{}}),assertions:{assertStoreRoute(){}},runtime:{getEppRuntimeData:()=>({delivery:address}),getEppContact:()=>({})},completeClRegisteredContact:async()=>calls.push('contact'),continueClRegisteredDeliveryToPayment:async()=>calls.push('saved-delivery')});
 await run({url:()=>'?step=CHECKOUT_STEP_DELIVERY',locator:()=>shipping},{market:'CL'});
 assert.deepEqual(calls,['contact','saved-delivery']);
});

test('EPP Delivery awaits its own native persistence response before Continue, without replay',async()=>{
 const code=fs.readFileSync('flows/cl/paymentFlows.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
 const calls=[];let finish;const persisted=new Promise(resolve=>{finish=resolve;});
 const terms={isChecked:async()=>false,check:async()=>calls.push('terms')};
 const shipping={getByText:()=>({filter:()=>({first:()=>({click:async()=>calls.push('shipping')})})}),getByRole:()=>terms};
 const response={url:()=> 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/alianzas/users/current/carts/current/deliverymodes/update',request:()=>({method:()=> 'POST'}),ok:()=>true,finished:async()=>{calls.push('saving');await persisted;calls.push('saved');return null;}};
 const page={locator:()=>shipping,getByRole:()=>({click:async()=>calls.push('continue')}),waitForResponse:async predicate=>{calls.push('listen');assert.equal(predicate(response),true);assert.equal(predicate({...response,url:()=>response.url().replace('/alianzas/','/cl/')}),false);return response;}};
 const run=vm.runInNewContext(code+'\ncontinueClRegisteredDeliveryToPayment;',{URL,evidenceContext:{recordBusinessEvidence(){}},expect:()=>({toBeVisible:async()=>{},toHaveURL:async()=>{}})});
 const pending=run(page,{addressReady:true,storefront:{environment:'S2',rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')}});
 await new Promise(resolve=>setImmediate(resolve));assert.ok(!calls.includes('continue'));finish();await pending;
 assert.deepEqual(calls,['listen','shipping','saving','saved','terms','continue']);
});
