const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configureItem}=require('../../scripts/auth-operations-item.cjs');
test('observer repair preserves builders/publishers/history and changes only description/static link payload',async()=>{
 const env={JENKINS_URL:'http://127.0.0.1:8080',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'fixture-token'};
 const publishers='<publishers><fixture>preserve</fixture></publishers>';
 const xml='<project><description>old</description><displayName>🔐 Samsung-SMB-Auth-Operations</displayName><scm class="hudson.scm.NullSCM"/><builders><command>FromBase64String(&apos;Zm94&apos;)</command></builders>'+publishers+'<properties><fixture>preserve</fixture></properties></project>';
 const calls=[];const request=async(url,options={})=>{calls.push({url,options});if(url.endsWith('/crumbIssuer/api/json'))return{ok:true,json:async()=>({crumbRequestField:'Crumb',crumb:'fixture'})};if(options.method==='POST')return{ok:true};return{ok:true,text:async()=>xml};};
 const result=await configureItem({env,request,readDisplay:()=>({dashboardOrigin:'http://192.168.1.2:8080'})});
 const posted=calls.find(c=>c.options.method==='POST');assert.ok(posted.options.body.includes(publishers));assert.ok(posted.options.body.includes('<builders><command>FromBase64String('));assert.ok(posted.options.body.includes('<properties><fixture>preserve</fixture></properties>'));assert.ok(calls.every(c=>!c.url.includes('/scriptText')&&!c.url.endsWith('/build')));assert.equal(result.authActions,0);assert.match(result.dashboard,/192\.168\.1\.2/);
});
