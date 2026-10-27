const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('pages/MxCheckoutPage.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class MxCheckoutPage','class MxCheckoutPage');
const Checkout=vm.runInNewContext(source+'\nMxCheckoutPage;',{BasePage:class{},contactTransition:{}});
function fixture({epp=true,same=true,resolved=true,status=200}={}){
 const calls=[];const values={postal:same?'01000':'99999',line1:'',line2:''};
 const field=key=>({waitFor:async()=>{},inputValue:async()=>values[key],fill:async value=>{calls.push('fill:'+key+':'+value);values[key]=value;},press:async()=>calls.push('blur')});
 const option={waitFor:async()=>{},innerText:async()=>'QA colonia',click:async()=>calls.push('colonia')};
 const combo={waitFor:async()=>{},click:async()=>{},};
 const checkout=Object.create(Checkout.prototype);checkout.storefront=epp?{}:null;
 checkout.readField=async()=>resolved?'resolved':null;
 checkout.page={getByRole:(role,{name}={})=>{
  if(role==='textbox')return field(name==='line1'||name==='line2'?name:'postal');
  if(role==='combobox')return combo;
  if(role==='option')return{filter:()=>({first:()=>option})};
  if(role==='radio')return{getAttribute:async()=>'no-invoice',isChecked:async()=>true};
  if(role==='checkbox')return{filter:()=>({count:async()=>0})};
 },locator:()=>({waitFor:async()=>{},click:async()=>{}}),waitForFunction:async()=>{},
 waitForResponse:async()=>{calls.push('lookup');return{status:()=>status};}};
 return {calls,run:()=>checkout.fillDelivery({postalCode:'01000',street:'QA',exteriorNumber:'1'},{registered:true})};
}
test('EPP restored postcode forces fresh lookup and positively selects a colonia',async()=>{
 const f=fixture();const result=await f.run();assert.equal(result.lookupStatus,200);assert.deepEqual(f.calls.slice(0,5),['fill:postal:','blur','lookup','fill:postal:01000','blur']);assert.ok(f.calls.includes('colonia'));
});
for(const options of [{epp:false},{same:false},{resolved:false}])test('unresolved, changed or Base Store postcode still requires lookup '+JSON.stringify(options),async()=>{
 const f=fixture(options);if(options.resolved===false)await assert.rejects(f.run(),/populate district/);else await f.run();assert.ok(f.calls.includes('lookup'));assert.ok(f.calls.includes('blur'));if(options.epp===false||options.same===false)assert.ok(!f.calls.includes('fill:postal:'));
});
test('postal lookup rejection remains a failure',async()=>{await assert.rejects(fixture({same:false,status:500}).run(),/HTTP 500/);});
