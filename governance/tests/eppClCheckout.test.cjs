const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppClCheckout.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export (async )?function/g,'$1function');
test('only the observed selected-new and hidden-existing-fields signature is the CL delivery blocker',()=>{
 const classify=vm.runInNewContext(source+'\nclassifyClEppAddressState;');
 assert.equal(classify({newChecked:true,streetFields:1,visibleStreet:0,visibleRegion:0}).reason,'ENVIRONMENT_DEFECT');
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
