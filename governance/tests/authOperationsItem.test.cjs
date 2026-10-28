const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configureItem}=require('../../scripts/auth-operations-item.cjs');
test('observer restores the full three-asset dashboard while preserving publishers, builder rules and history',async()=>{
 const env={JENKINS_URL:'http://127.0.0.1:8080',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'fixture-token'};
 const publishers='<publishers><reportDir>auth-dashboard-link</reportDir><fixture>preserve</fixture></publishers>';
 const xml='<project><description>old</description><displayName>🔐 Samsung-SMB-Auth-Operations</displayName><scm class="hudson.scm.NullSCM"/><builders><hudson.tasks.BatchFile><command>FromBase64String(&apos;Zm94&apos;)</command><configuredLocalRules/></hudson.tasks.BatchFile></builders>'+publishers+'<properties><fixture>preserve</fixture></properties></project>';
 const calls=[];const request=async(url,options={})=>{calls.push({url,options});if(url.endsWith('/crumbIssuer/api/json'))return{ok:true,json:async()=>({crumbRequestField:'Crumb',crumb:'fixture'})};if(options.method==='POST')return{ok:true};return{ok:true,text:async()=>xml};};
 const result=await configureItem({env,request,readAssets:()=>({'index.html':'<h1>fixture dashboard</h1>','styles.css':'body{}','countdown.js':'// fixture'}),readDisplay:()=>({dashboardOrigin:'http://192.168.1.2:8080'})});
 const posted=calls.find(c=>c.options.method==='POST');assert.ok(posted.options.body.includes(publishers));assert.ok(posted.options.body.includes('<configuredLocalRules/>'));for(const name of ['index.html','styles.css','countdown.js'])assert.ok(posted.options.body.includes('auth-dashboard-link/'+name));assert.ok(posted.options.body.includes('<properties><fixture>preserve</fixture></properties>'));assert.ok(calls.every(c=>!c.url.includes('/scriptText')&&!c.url.endsWith('/build')));assert.equal(result.authActions,0);assert.match(result.dashboard,/192\.168\.1\.2/);
});
test('observer live-source configuration can be applied repeatedly',async()=>{
 const env={JENKINS_URL:'http://127.0.0.1:8080',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'fixture-token'};
 let xml='<project><description>old</description><displayName>🔐 Samsung-SMB-Auth-Operations</displayName><scm class="hudson.scm.NullSCM"/><hudson.tasks.BatchFile><command>FromBase64String</command></hudson.tasks.BatchFile><reportDir>auth-dashboard-link</reportDir></project>';
 let posts=0;
 const request=async(url,options={})=>{if(url.endsWith('/crumbIssuer/api/json'))return{ok:true,json:async()=>({crumbRequestField:'Crumb',crumb:'fixture'})};if(options.method==='POST'){xml=options.body;posts++;return{ok:true};}return{ok:true,text:async()=>xml};};
 const options={env,request,readAssets:()=>({liveSource:'C:/fixture/userContent/samsung-smb-auth/s2'}),readDisplay:()=>null};
 await configureItem(options);await configureItem(options);assert.equal(posts,2);assert.match(xml,/Copy-Item/);
});
