const {test}=require('node:test');const assert=require('node:assert/strict');
const {getEppConfig}=require('../../config/markets/epp');const {needsEppBootstrap}=require('../../scripts/auth-refresh-epp.cjs');
const config=getEppConfig('MX',{ENVIRONMENT:'S2'});
const page=(url,text)=>({url:()=>url,isClosed:()=>false,locator:()=>({innerText:async()=>text})});
test('an owned empty EPP document requires one staging bootstrap instead of resuming an empty page',async()=>{assert.equal(await needsEppBootstrap(page(config.rootUrl.href,''),config),true);});
test('rendered EPP and verification gates are preserved in place',async()=>{for(const text of ['Hola QA','Código de verificación rechazado','Iniciar sesión'])assert.equal(await needsEppBootstrap(page(config.rootUrl.href,text),config),false);});
test('unreadable body is uncertainty, not permission to repeat setup',async()=>{const p=page(config.rootUrl.href,'');p.locator=()=>({innerText:async()=>{throw Error('fixture unavailable');}});assert.equal(await needsEppBootstrap(p,config),false);assert.equal(await needsEppBootstrap(page('about:blank',''),config),true);});
