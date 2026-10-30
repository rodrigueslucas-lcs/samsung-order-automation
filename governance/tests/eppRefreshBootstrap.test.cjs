const {test}=require('node:test');const assert=require('node:assert/strict');
const {getEppConfig}=require('../../config/markets/epp');const {needsEppBootstrap,prepareEppCookie,reuseNativeEppSession}=require('../../scripts/auth-refresh-epp.cjs');
const config=getEppConfig('MX',{ENVIRONMENT:'S2'});
const page=(url,text)=>({url:()=>url,isClosed:()=>false,locator:()=>({innerText:async()=>text})});
test('an owned empty EPP document requires one staging bootstrap instead of resuming an empty page',async()=>{assert.equal(await needsEppBootstrap(page(config.rootUrl.href,''),config),true);});
test('rendered EPP and verification gates are preserved in place',async()=>{for(const text of ['Hola QA','Código de verificación rechazado','Iniciar sesión'])assert.equal(await needsEppBootstrap(page(config.rootUrl.href,text),config),false);});
test('unreadable body is uncertainty, not permission to repeat setup',async()=>{const p=page(config.rootUrl.href,'');p.locator=()=>({innerText:async()=>{throw Error('fixture unavailable');}});assert.equal(await needsEppBootstrap(p,config),false);assert.equal(await needsEppBootstrap(page('about:blank',''),config),true);});

test('a manually renewed native EPP snapshot is verified before export and closes only after success',async()=>{
 const calls=[],native={marker:'native'},verified={marker:'verified'};
 assert.equal(await reuseNativeEppSession(config,{credentials:()=>({email:'qa@example.test'}),capture:async(id,options)=>{assert.equal(id.market,'mx');assert.ok(options.profilesRoot.endsWith('epp'));return{readEppSnapshot:async root=>{assert.equal(root,config.rootUrl.href);calls.push('capture');return native;},closeVerified:async()=>calls.push('close'),dispose:async()=>calls.push('disconnect')};},verify:async(c,s)=>{assert.equal(s,native);calls.push('verify');return verified;},persist:(c,s)=>{assert.equal(s,verified);calls.push('export');}}),true);
 assert.deepEqual(calls,['capture','verify','export','close','disconnect']);
});

test('unverified native EPP state never overwrites the export or closes the human browser',async()=>{
 const calls=[];
 await assert.rejects(reuseNativeEppSession(config,{credentials:()=>({email:'qa@example.test'}),capture:async()=>({readEppSnapshot:async()=>({}),closeVerified:async()=>calls.push('close'),dispose:async()=>calls.push('disconnect')}),verify:async()=>{throw Object.assign(Error('unproven'),{eppReason:'SERVER_PROOF_PENDING'});},persist:()=>calls.push('export')}),e=>e.eppReason==='SERVER_PROOF_PENDING');
 assert.deepEqual(calls,['disconnect']);
});

test('an already rendered staging setup is reused instead of repeating its navigation',async()=>{
 let navigations=0;const ready={isVisible:async()=>true,waitFor:async()=>{}};
 await prepareEppCookie({url:()=> 'https://stg2.shop.samsung.com/getcookie.html',goto:async()=>{navigations++;},getByText:()=>({filter:()=>({first:()=>ready})})},config);
 assert.equal(navigations,0);
});

test('late committed setup can complete without retrying navigation; an unproven timeout still fails',async()=>{
 for(const visible of [true,false]){let url='about:blank',calls=0;const page={url:()=>url,goto:async target=>{url=target;calls++;throw Object.assign(Error('late navigation'),{name:'TimeoutError'});},getByText:()=>({filter:()=>({first:()=>({isVisible:async()=>visible,waitFor:async()=>{}})})})};
 if(visible)await prepareEppCookie(page,config);else await assert.rejects(prepareEppCookie(page,config),{name:'TimeoutError'});
 assert.equal(calls,1);
 }
});
