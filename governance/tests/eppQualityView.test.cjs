const test=require('node:test'),assert=require('node:assert/strict');
const {viewXml,provisionView,jobs,owner}=require('../../scripts/provision-epp-quality-view.cjs');
test('quality view contains eight independent jobs and only an observability link',()=>{
 const xml=viewXml();for(const job of jobs)assert.ok(xml.includes(`<string>${job}</string>`));
 assert.equal(jobs.length,8);assert.match(xml,/userContent\/samsung-smb-quality/);assert.doesNotMatch(xml,/Auth-Operations|triggers|builders|credential/i);
});
test('foreign existing view is preserved',async()=>{
 let calls=0;await assert.rejects(provisionView(async()=>{calls++;return{ok:true,status:200,text:async()=>'<view>another</view>'};},{apply:true}),/another owner/);assert.equal(calls,1);
});
test('view creation verifies exact membership without starting builds',async()=>{
 const calls=[];const request=async(route,options={})=>{calls.push({route,method:options.method||'GET'});if(route.endsWith('/config.xml'))return{ok:false,status:404};if(route.includes('/crumbIssuer'))return{ok:true,json:async()=>({crumbRequestField:'test-crumb',crumb:'synthetic'})};if(route.includes('/api/json?tree=jobs'))return{ok:true,json:async()=>({jobs:jobs.map(name=>({name}))})};return{ok:true,status:200};};
 const result=await provisionView(request,{apply:true});assert.equal(result.applied,true);assert.equal(result.buildStarted,false);assert.equal(calls.filter(call=>call.method==='POST').length,1);assert.ok(!calls.some(call=>/buildWithParameters|\/build\b/.test(call.route)));assert.ok(viewXml().includes(owner));
});
