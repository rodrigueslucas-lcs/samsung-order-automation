const test=require('node:test');
const assert=require('node:assert/strict');
const {definitions,viewXml,provisionHomeViews,owner}=require('../../scripts/provision-jenkins-home-views.cjs');

function response(status,body='',json=null){
 return {status,ok:status>=200&&status<300,text:async()=>body,json:async()=>json||{}};
}
test('native home navigation separates Base Store, EPP and operations without modifying jobs',()=>{
 assert.deepEqual(definitions.map(d=>d.name),['01 - Overview','02 - Base Store','03 - EPP','04 - Auth and Ops']);
 assert.equal(definitions[0].jobs.length,10);
 assert.deepEqual(definitions[1].jobs,['Samsung-SMB-MX','Samsung-SMB-PE','Samsung-SMB-CL','Samsung-SMB-CO']);
 assert.deepEqual(definitions[2].jobs,['Samsung-SMB-EPP-MX','Samsung-SMB-EPP-PE','Samsung-SMB-EPP-CL','Samsung-SMB-EPP-CO']);
 assert.deepEqual(definitions[3].jobs,['SAMSUNG-SMB-AUTOMATION','Samsung-SMB-Auth-Operations']);
 for(const def of definitions){
  const config=viewXml(def);
  assert.ok(config.includes(owner));
  assert.ok(config.includes('<hudson.model.ListView>'));
  for(const job of def.jobs)assert.ok(config.includes('<string>'+job+'</string>'));
  assert.doesNotMatch(config,/<triggers|<builders|<credentials|scriptPath|hudson\.model\.FreeStyleProject/);
 }
});
test('rerunning provisioner preserves the installed executive Dashboard view type',async()=>{
 const writes=[];
 const adapter=async(route,options={})=>{
  if(options.method==='POST')writes.push(route);
  if(route.endsWith('/config.xml'))return response(200,'<hudson.plugins.view.dashboard.Dashboard><description>'+owner+'</description></hudson.plugins.view.dashboard.Dashboard>');
  if(route.startsWith('/job/'))return response(200,'',{name:decodeURIComponent(route.slice(5).split('/')[0])});
  if(route.startsWith('/crumbIssuer'))return response(200,'',{crumbRequestField:'Jenkins-Crumb',crumb:'synthetic'});
  if(route.includes('/api/json?tree=')){const name=decodeURIComponent(route.split('/')[2]);return response(200,'',{name,jobs:definitions.find(d=>d.name===name).jobs.map(name=>({name}))});}
  return response(200);
 };
 await provisionHomeViews(adapter,{apply:true});
 assert.equal(writes.length,3);
 assert.ok(!writes.some(route=>route.includes(encodeURIComponent('01 - Overview'))));
});

test('dry run reads views and never writes or starts builds',async()=>{
 const calls=[];
 const result=await provisionHomeViews(async(route,opts={})=>{calls.push([route,opts.method]);return response(404);});
 assert.equal(result.applied,false);assert.equal(result.views.length,4);
 assert.ok(calls.every(([,method])=>method===undefined));
 assert.equal(calls.length,4);
});
test('foreign owned view is preserved and no writes occur',async()=>{
 const calls=[];
 await assert.rejects(provisionHomeViews(async(route,opts={})=>{
  calls.push([route,opts.method]);
  return response(200,'<description>unmanaged</description>');
 },{apply:true}),/another owner/);
 assert.equal(calls.length,1);assert.ok(calls.every(([,method])=>!method));
});
test('all job dependencies are checked before any write',async()=>{
 const calls=[];
 await assert.rejects(provisionHomeViews(async(route,opts={})=>{
  calls.push([route,opts.method]);
  return route.includes('/config.xml')?response(404):response(403);
 },{apply:true}),/prerequisite job unavailable/);
 assert.ok(calls.every(([,method])=>!method));
});
test('applying views verifies exact membership, creates no jobs and starts no builds',async()=>{
 const calls=[];
 const adapter=async(route,options={})=>{
  calls.push([route,options.method||'GET']);
  if(route.endsWith('/config.xml'))return response(404);
  if(route.startsWith('/job/'))return response(200,'',{name:decodeURIComponent(route.slice('/job/'.length).split('/')[0])});
  if(route.startsWith('/crumbIssuer'))return response(200,'',{crumbRequestField:'Jenkins-Crumb',crumb:'synthetic'});
  if(route.includes('/api/json?tree=')){
   const name=decodeURIComponent(route.split('/')[2]);
   return response(200,'',{name,jobs:definitions.find(d=>d.name===name).jobs.map(name=>({name}))});
  }
  return response(200);
 };
 const applied=await provisionHomeViews(adapter,{apply:true});
 assert.equal(applied.applied,true);assert.equal(applied.buildStarted,false);assert.equal(applied.renamedJobs,false);
 assert.equal(applied.views.length,4);
 assert.equal(calls.filter(([,method])=>method==='POST').length,4);
 assert.ok(!calls.some(([route])=>/\/build(?:WithParameters)?\b|\/job\/[^/]+\/config.xml/.test(route)));
});
