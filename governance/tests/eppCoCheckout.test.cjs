const test=require('node:test'),assert=require('node:assert/strict');
const {assertCoEppCheckout,acceptCoEppCheckoutTerms}=require('../../flows/co/eppCheckout.cjs');
const cfg={market:'CO',environment:'S2',program:'co_epp_agre',rootUrl:new URL('https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/')};
test('CO checkout rejects Production, Base Store, other programmes and S1 before actions',()=>{
 const page=url=>({url:()=>url});
 assert.doesNotThrow(()=>assertCoEppCheckout(page(new URL('checkout/one',cfg.rootUrl).href),cfg));
 for(const url of ['https://www.samsung.com/co/checkout/one','https://stg2.shop.samsung.com/co/checkout/one','https://stg2.shop.samsung.com/co/multistore/alianzas_co/alianzas_co/checkout/one'])assert.throws(()=>assertCoEppCheckout(page(url),cfg),/left/);
 assert.throws(()=>assertCoEppCheckout({}, {...cfg,environment:'S1'}),/proven/);
});
function consentFixture(){const checked=new Set(),calls=[];return{calls,checked,page:{locator:selector=>{const name=selector.match(/name="([^"]+)"/)[1];return{count:async()=>1,getAttribute:async()=>name==='marketingOptIn'?'':null,isChecked:async()=>checked.has(name),check:async()=>{checked.add(name);calls.push(name);}};}}};}
test('approval for disposable email does not silently subscribe FIRST',async()=>{
 const f=consentFixture();const result=await acceptCoEppCheckoutTerms(f.page,{qaRecipient:false,env:{}});
 assert.equal(result.reason,'HUMAN_REQUIRED');assert.deepEqual(f.calls,[]);
});
for(const options of [{qaRecipient:true,env:{}},{qaRecipient:false,env:{CO_EPP_ALLOW_PRIMARY_MARKETING:'1'}}])test('authorized staging consent never enrolls Rewards '+JSON.stringify(options),async()=>{
 const f=consentFixture();assert.equal(await acceptCoEppCheckoutTerms(f.page,options),null);
 assert.ok(f.checked.has('marketingOptIn'));assert.ok(f.checked.has('termsAndCondition'));assert.ok(!f.checked.has('rewardsProgramOptIn'));
 const count=f.calls.length;await acceptCoEppCheckoutTerms(f.page,options);assert.equal(f.calls.length,count);
});
