const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('flows/eppStorefront.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
for(const market of ['MX','PE','CO','CL'])for(const environment of ['S1','S2'])test(`${market} ${environment} storefront operational errors cannot skip the selected TC`,()=>{
 let skips=0;
 const enforce=vm.runInNewContext(source+'\nenforceEppQst;',{test:{skip:()=>skips++}});
 enforce(false,'unused',{market,environment});
 for(const reason of ['AUTH_REQUIRED','CORPORATE_ACTIVATION_REQUIRED','COMMERCE_CONTENT_NOT_RENDERED','MISSING_EPP_PRODUCT'])assert.throws(()=>enforce(true,reason,{market,environment}),error=>error.message===reason);
 assert.equal(skips,0);
});
