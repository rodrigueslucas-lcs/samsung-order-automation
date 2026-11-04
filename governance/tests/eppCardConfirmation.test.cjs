const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppCardConfirmation.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
for(const apiSite of [null,'ventaestudiantes'])test('causal confirmation is a scoped read-only order GET, never another cart or payment action '+apiSite,async()=>{
 const cfg={market:'PE',environment:'S2',program:'pe_membership_vip',rootUrl:new URL('https://stg2.shop.samsung.com/pe/multistore/pe_membership_vip/pe_membership_vip/')},code='PE261029-12345678_261029120000',calls=[];
 if(apiSite){cfg.apiSite=apiSite;cfg.rootUrl=new URL('https://stg2.shop.samsung.com/pe/multistore/peeppmulti/ventaestudiantes/');}
 const page={context:()=>({}),waitForResponse:async predicate=>{const response={url:()=>`https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/${apiSite||'pe_membership_vip'}/users/current/orders/${code}`,request:()=>({method:()=> 'GET'}),ok:()=>true,json:async()=>({code:'PE261029-12345678'})};assert.equal(predicate(response),true);calls.push('GET');return response;},goto:async target=>{assert.equal(target,`${cfg.rootUrl.href}orderConfirmation;orderCode=${code}`);calls.push('confirmation');}};
 const run=vm.runInNewContext(source+'\nvalidateExistingEppCardOrder;',{URL,RegExp,session:{getPrimaryEppCredentials:()=>({email:'synthetic'})},server:{watchEppServerProof:()=>({settle:async()=>{},accepted:()=>true,stop:()=>calls.push('stop')})},openEppStore:async()=>calls.push('open'),validateMxEppConfirmation:async()=>calls.push('UI'),test:{info:()=>({attach:async()=>calls.push('evidence')})}});
 await run(page,cfg,{market:'PE',environment:'S2',kind:'card',status:'CONFIRMED',orderCode:code});
 assert.deepEqual(calls,['open','GET','confirmation','UI','evidence','stop']);
 await assert.rejects(run({},cfg,{market:'MX'}),/own confirmed/);
});

test('reconciled CL order can prove confirmation only, retaining rejected-payment state',async()=>{
 const cfg={market:'CL',environment:'S2',program:'alianzas',rootUrl:new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/')};
 const code='CL261104-12345678_261104120000',record={market:'CL',environment:'S2',kind:'card',status:'OBSERVED_ORDER',orderCode:code},calls=[];
 let apiCode='CL261104-12345678';
 const page={context:()=>({}),waitForResponse:async predicate=>{const r={url:()=>`https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/alianzas/users/current/orders/${code}`,request:()=>({method:()=> 'GET'}),ok:()=>true,json:async()=>({code:apiCode})};assert.ok(predicate(r));calls.push('GET');return r;},goto:async()=>calls.push('confirmation')};
 const run=vm.runInNewContext(source+'\nvalidateExistingEppCardOrder;',{URL,RegExp,session:{getPrimaryEppCredentials:()=>({})},server:{watchEppServerProof:()=>({settle:async()=>{},accepted:()=>true,stop(){}})},openEppStore:async()=>{},validateMxEppConfirmation:async()=>calls.push('UI'),test:{info:()=>({attach:async(_,attachment)=>{const proof=JSON.parse(attachment.body);assert.equal(proof.submitCount,0);assert.equal(proof.paymentAcceptanceProven,false);}})}});
 await assert.rejects(run(page,cfg,record),/own confirmed/);
 await run(page,cfg,record,{allowObservedOrder:true});
 assert.deepEqual(calls,['GET','confirmation','UI']);assert.equal(record.status,'OBSERVED_ORDER');
 apiCode=code;await run(page,cfg,record,{allowObservedOrder:true});
 apiCode='CL261104-12345678_261104999999';await assert.rejects(run(page,cfg,record,{allowObservedOrder:true}),/causal public order/);
 apiCode='CL261104-87654321';await assert.rejects(run(page,cfg,record,{allowObservedOrder:true}),/causal public order/);
 await assert.rejects(run(page,{...cfg,market:'PE'},{...record,market:'PE'},{allowObservedOrder:true}),/own confirmed/);
});

