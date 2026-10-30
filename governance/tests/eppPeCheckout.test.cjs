const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppPeCheckout.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
test('PE programme checkout refuses missing approved data before entering a form',async()=>{
  const calls=[];
  const run=vm.runInNewContext(source+'\ncompletePeEppCheckout;',{assertions:{assertStoreRoute:()=>calls.push('scope')},runtime:{getEppContact:()=>null,getEppRuntimeData:()=>null}});
  assert.equal((await run({url:()=>''},{market:'PE'})).reason,'MISSING_EPP_CONTACT_DATA');
  assert.deepEqual(calls,['scope']);
  await assert.rejects(run({}, {market:'CL'}),/another market/);
});
test('PE EPP uses registered Page Object transitions, disables saving and keeps programme checks',async()=>{
  const calls=[],contact={firstName:'QA'},delivery={street:'fixture'};
  class CheckoutPage{constructor(){this.screenshot=()=>{};}}
  for(const name of ['fillCustomerData','selectNewAuthenticatedAddress','fillAddress','selectShippingMethod','acceptTerms','continueToPayment'])CheckoutPage.prototype[name]=async function(arg){calls.push(name);if(name==='fillCustomerData')assert.equal(arg,contact);if(name==='fillAddress')assert.equal(arg,delivery);};
  const run=vm.runInNewContext(source+'\ncompletePeEppCheckout;',{URL,CheckoutPage,expect:()=>({toBeChecked:async()=>{}}),assertions:{assertStoreRoute:()=>calls.push('scope')},runtime:{getEppContact:()=>contact,getEppRuntimeData:()=>({delivery})}});
  const page={url:()=> 'https://stg2.shop.samsung.com/pe/multistore/test/test/checkout/one?step=CHECKOUT_STEP_CONTACT_INFO',waitForURL:async()=>{},getByRole:()=>({isVisible:async()=>true,isChecked:async()=>true,uncheck:async()=>calls.push('no-save')})};
  assert.equal(await run(page,{market:'PE'}),null);
  assert.deepEqual(calls,['scope','fillCustomerData','scope','selectNewAuthenticatedAddress','fillAddress','no-save','selectShippingMethod','continueToPayment','scope']);
});
test('PE terms stay checked across reuse and only unchecked terms receive an action',async()=>{
 const states=[true,false];let clicks=0;
 const page={getByRole:(_role,{name})=>{const i=name.test('autorizo el tratamiento')?0:1;return{isChecked:async()=>states[i],check:async()=>{states[i]=true;clicks++;}};}};
 const run=vm.runInNewContext(source+'\nacceptPeEppTerms;',{expect:checkbox=>({toBeChecked:async()=>assert.equal(await checkbox.isChecked(),true)})});
 await run(page);await run(page);assert.deepEqual(states,[true,true]);assert.equal(clicks,1);
});

function quantityFixture(frozen=false,apiSite=null){
 let ui=3,server=3,pending=3,lag=0,clicks=0,navigations=0;
 const cfg={market:'PE',environment:'S2',sku:'fixture',rootUrl:new URL('https://stg2.shop.samsung.com/pe/multistore/pe_membership_vip/pe_membership_vip/'),cartUrl:new URL('https://stg2.shop.samsung.com/pe/multistore/pe_membership_vip/pe_membership_vip/cart')};
 if(apiSite){cfg.apiSite=apiSite;cfg.rootUrl=new URL('https://stg2.shop.samsung.com/pe/multistore/peeppmulti/ventaestudiantes/');cfg.cartUrl=new URL('cart',cfg.rootUrl);}
 const quantity={},decrease={click:async()=>{clicks++;ui--;pending=ui;lag=1;}};
 const expect=target=>({toHaveCount:async n=>assert.equal(n,1),toHaveValue:async n=>assert.equal(String(ui),n)});
 expect.poll=read=>({toBe:async expected=>{for(let n=0;n<4;n++){if(await read()===expected)return;}throw Error('PERSISTENCE_NOT_PROVEN');}});
 const page={url:()=>cfg.cartUrl.href,waitForResponse:async()=>({ok:()=>true,request:()=>({headerValue:async()=> 'synthetic'}),json:()=>{throw Error('evicted response must not be read');}}),goto:async()=>{navigations++;},getByRole:role=>({filter:()=>role==='textbox'?quantity:decrease}),context:()=>({request:{get:async url=>{assert.equal(url,'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/'+(apiSite||'pe_membership_vip')+'/users/current/carts/current');if(lag)lag--;else if(!frozen)server=pending;return{ok:()=>true,json:async()=>({entries:[{product:{code:'fixture'},quantity:server}]})};}}})};
 const run=vm.runInNewContext(source+'\nnormalizeEppPaymentCart;',{URL,expect,causalReadback:require('../../utils/eppCausalOrderReadback.cjs'),assertions:{assertStoreRoute(){}}});
 return{run:()=>run(page,cfg,{waitForQuantityValue:async(_input,value)=>assert.equal(String(ui),value)}),state:()=>({clicks,navigations,server})};
}
test('EPP quantity normalization waits for server persistence, never rereads an evicted navigation body',async()=>{
 const f=quantityFixture();await f.run();assert.deepEqual(f.state(),{clicks:2,navigations:1,server:1});
});
test('an optimistic quantity without server persistence stops before any second mutation',async()=>{
 const f=quantityFixture(true);await assert.rejects(f.run(),/PERSISTENCE_NOT_PROVEN/);assert.equal(f.state().clicks,1);
});

test('SDS cart persistence uses observed OCC site instead of first public URL segment',async()=>{const f=quantityFixture(false,'ventaestudiantes');await f.run();assert.equal(f.state().server,1);});
