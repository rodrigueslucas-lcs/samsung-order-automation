const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/auth-login-cl.cjs','utf8');
const start=source.indexOf('\n(async () => {')+1,end=source.indexOf('})().catch',start);
const startup=source.slice(start,end)+'})();';
for(const failure of ['no-context','discard','new-page'])test(`CL startup disconnects CDP even when ${failure} fails before login`,async()=>{
 let disconnected=0;const original=Error('Target page, context or browser has been closed');
 const context={pages:()=>[],newPage:async()=>{throw original}};
 const browser={contexts:()=>failure==='no-context'?[]:[context],close:async()=>{disconnected++}};
 const pending=vm.runInNewContext(startup,{URL,chromium:{},profileDir:'fixture',slot:'primary',config:{environment:'S2',baseUrl:new URL('https://stg2.shop.samsung.com/cl/')},accountHostname:'account.samsung.com',connectAuthBrowser:async()=>browser,discardRejectedAccountPages:async()=>{if(failure==='discard')throw original},require:()=>({findAuthBootstrapPage:()=>null})});
 await assert.rejects(pending,error=>failure==='no-context'?/no browser context/.test(error.message):error===original);
 assert.equal(disconnected,1,'startup must release the CDP connection without closing the native browser');
});
