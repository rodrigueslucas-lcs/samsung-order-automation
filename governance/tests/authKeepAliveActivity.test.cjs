const {test}=require('node:test');const assert=require('node:assert/strict');const {jenkinsBuildsIdle}=require('../../utils/authJenkinsActivity.cjs');const {main,parseArgs}=require('../../scripts/auth-keepalive-once.cjs');
const env={JENKINS_URL:'http://localhost:8080',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'fixture-token'};
function request(jobs=[],items=[]){return async url=>({ok:true,json:async()=>url.includes('/queue/')?{items}:{jobs}});}
test('running and queued Samsung builds prevent auth maintenance',async()=>{assert.equal((await jenkinsBuildsIdle(env,{request:request([{name:'Samsung-SMB-MX',builds:[{building:true}]}])})).idle,false);assert.equal((await jenkinsBuildsIdle(env,{request:request([],[{task:{name:'Samsung-SMB-CO'}}])})).idle,false);});
test('unrelated jobs do not block and empty Samsung activity is idle',async()=>{assert.equal((await jenkinsBuildsIdle(env,{request:request([{name:'other',builds:[{building:true}]}])})).idle,true);});
test('unavailable Jenkins fails closed',async()=>{await assert.rejects(jenkinsBuildsIdle(env,{request:async()=>({ok:false,status:403})}));});
test('CLI BUSY gate never calls the auth cycle',async()=>{let calls=0;const code=await main({env:{},argv:[],configure:e=>e,activity:async()=>({idle:false}),cycle:async()=>{calls++;},log(){},save:false});assert.equal(code,3);assert.equal(calls,0);});
test('CLI rejects invalid environment before touching Jenkins/auth',()=>assert.throws(()=>parseArgs(['--environment=PROD'],{})));
for(const [summary,expected] of [[{ok:true},0],[{ok:false,blocking:[{status:'HUMAN_REQUIRED'}]},2],[{ok:false,busy:[{}],blocking:[]},3],[{ok:false,busy:[],blocking:[{status:'TRANSIENT_ERROR'}]},1]])test(`CLI propagates safe result ${expected}`,async()=>{assert.equal(await main({env:{},argv:[],configure:e=>e,activity:async()=>({idle:true}),cycle:async()=>summary,log(){},save:false}),expected);});

test('CL/PE scope ignores running MX/CO jobs but blocks a CL job',async()=>{
 const jobs=[{name:'Samsung-SMB-MX',builds:[{building:true}]},{name:'Samsung-SMB-CO',builds:[{building:true}]}];
 assert.equal((await jenkinsBuildsIdle(env,{request:request(jobs),markets:['cl','pe']})).idle,true);
 jobs.push({name:'Samsung-SMB-CL',builds:[{building:true}]});
 assert.equal((await jenkinsBuildsIdle(env,{request:request(jobs),markets:['cl','pe']})).idle,false);
});
test('CLI passes the same restricted scope to activity guard and auth cycle',async()=>{
 const scopes=[];const code=await main({env:{},argv:['--markets=cl,pe'],configure:e=>e,activity:async(e,o)=>{scopes.push(o.markets);return {idle:true};},cycle:async o=>{scopes.push(o.markets);return {ok:true};},log(){},save:false});
 assert.equal(code,0);assert.deepEqual(scopes,[['cl','pe'],['cl','pe']]);
 assert.throws(()=>parseArgs(['--markets='],{}));assert.throws(()=>parseArgs(['--markets=cl,xx'],{}));
});
