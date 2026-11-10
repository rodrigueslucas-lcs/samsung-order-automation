const test=require('node:test'),assert=require('node:assert/strict');
const {jobXml,runtimePolicy,provision,ownership}=require('../../utils/eppJenkinsProvision.cjs');
const template='<flow-definition><definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition"><scm><url>https://github.com/rodrigueslucas-lcs/samsung-order-automation.git</url><name>*/agent/mx-qst-p1-finish</name></scm><scriptPath>Jenkinsfile</scriptPath></definition></flow-definition>';
const response=(status,text='')=>({status,ok:status>=200&&status<300,text:async()=>text,json:async()=>({crumbRequestField:'Jenkins-Crumb',crumb:'synthetic'})});
test('dedicated job copies only SCM definition, stays manual and cannot change Base Store',()=>{
 const config=jobXml(template);assert.match(config,/<scriptPath>Jenkinsfile.epp<\/scriptPath>/);assert.match(config,/<triggers\/>/);assert.match(config,/DisableConcurrentBuilds/);assert.match(config,/P1_TARGET_IDS/);assert.match(template,/<scriptPath>Jenkinsfile<\/scriptPath>/);assert.throws(()=>jobXml(template.replace('agent/mx-qst-p1-finish','main')));
});
test('runtime policy contains only approved S2 market data',()=>{
 const io={readFileSync:()=>JSON.stringify({S1:{MX:{sensitive:'other-env'}},S2:{MX:{product:{sku:'synthetic'}},PE:{sensitive:'other-market'}}})};
 const policy=runtimePolicy('MX',{io,hostname:'synthetic-host'});assert.deepEqual(policy.fixtures,{S2:{MX:{product:{sku:'synthetic'}}}});assert.equal(policy.program,'pymesmx');assert.equal(policy.hostname,'synthetic-host');
});
test('dry run inspects without any mutation or build',async()=>{
 const calls=[];const result=await provision('CL',{request:async(route,options={})=>{calls.push([route,options.method]);return route==='/job/Samsung-SMB-CL/config.xml'?response(200,template):response(404);}});
 assert.equal(result.applied,false);assert.ok(calls.every(([,method])=>!method));
});
test('unknown existing job is preserved without credential writes',async()=>{
 const calls=[];await assert.rejects(provision('CL',{apply:true,request:async(route,options={})=>{calls.push(options.method);return response(200,route==='/job/Samsung-SMB-CL/config.xml'?template:'another owner');}}),/another owner/);assert.ok(calls.every(method=>!method));
});
test('permission failure identifies the blocked operation and never starts build',async()=>{
 const calls=[];const policy={market:'CL',environment:'S2',program:'alianzas'};
 await assert.rejects(provision('CL',{apply:true,policy,request:async(route,options={})=>{calls.push(route);if(route==='/job/Samsung-SMB-CL/config.xml')return response(200,template);if(route.includes('crumbIssuer'))return response(200);if(route.endsWith('/createCredentials'))return response(403);return response(404);}}),/Credentials.Create blocked: HTTP 403/);
 assert.ok(!calls.some(route=>route.includes('createItem')||route.includes('/build')));
});
test('owned job and runtime credential can be configured without starting auth or build',async()=>{
 const calls=[];const result=await provision('CL',{apply:true,policy:{market:'CL',environment:'S2',program:'alianzas'},request:async(route,options={})=>{calls.push([route,options.method]);if(route==='/job/Samsung-SMB-CL/config.xml')return response(200,template);return response(200,ownership);}});
 assert.equal(result.verified,true);assert.equal(result.buildStarted,false);assert.ok(calls.filter(([,method])=>method==='POST').every(([route])=>route.endsWith('/config.xml')));assert.ok(!calls.some(([route])=>route.includes('/build')));
});
