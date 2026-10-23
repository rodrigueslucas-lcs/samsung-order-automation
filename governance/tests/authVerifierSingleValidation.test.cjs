const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {withRegisteredSessionRecovery}=require('../../utils/registeredSessionRecovery');

function fixture(){
 const calls=[];let page;
 const context={newPage:async()=>{calls.push('newPage');return page;}};
 page={context:()=>context,keyboard:{press:async()=>{}},close:async()=>{}};
 const auth=withRegisteredSessionRecovery({
  validateAuthenticatedSession:async()=>{calls.push('validate');},
  installPersistedBrowserState:async()=>{},refreshAuthenticatedState:async()=>{calls.push('persist');},
  applyAuthSessionStorage:async()=>{calls.push('install');},
 });
 return {auth,context,calls};
}
test('explicit verification installs storage then validates once, without hidden newPage validation',async()=>{
 const f=fixture();await f.auth.applyAuthSessionStorage(f.context,{guardFuturePages:false});
 const page=await f.context.newPage();assert.deepEqual(f.calls,['install','newPage']);
 await f.auth.validateAuthenticatedSession(page);
 assert.deepEqual(f.calls,['install','newPage','validate','persist']);
});
test('registered test contexts retain automatic future-page validation by default',async()=>{
 const f=fixture();await f.auth.applyAuthSessionStorage(f.context);await f.context.newPage();
 assert.deepEqual(f.calls,['install','newPage','validate','persist']);
});
for(const market of ['mx','pe','co','cl'])test(`${market} verifier explicitly owns its validation lifecycle`,()=>{
 const source=fs.readFileSync(`scripts/auth-verify-${market}.cjs`,'utf8');
 assert.match(source,/applyAuthSessionStorage\(context, \{ guardFuturePages: false \}\)/);
 assert.match(source,/validateAuthenticatedSession\(page\)/);
 assert.match(source,/if \(!(?:ci|headless)\) await prepareAuthBrowserWindow\(page\)/);
});
