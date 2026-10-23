const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
for(const market of ['mx','pe','co','cl']) test(`${market} publisher sends valid XML once without exposing secrets`,async()=>{
 const file=market==='mx'?'scripts/auth-publish-jenkins.cjs':`scripts/auth-publish-jenkins-${market}.cjs`;
 const bodies=[],output=[];const runtime={env:{ENVIRONMENT:'S2',JENKINS_URL:'http://localhost:8080',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'fixture-token'},exitCode:0};
 const fakeFs={existsSync:()=>true,readFileSync:()=>Buffer.from(JSON.stringify({schemaVersion:1,market:market.toUpperCase(),environment:'S2',primary:{storageState:{},sessionStorage:{}}}))};
 const fetch=async(url,options={})=>{assert.ok(options.signal,'network wait must be bounded');if(options.body)bodies.push(options.body);return {ok:true,status:200,json:async()=>({crumbRequestField:'Jenkins-Crumb',crumb:'fixture-crumb'})};};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{process:runtime,require:name=>name==='node:fs'?fakeFs:name==='../utils/authKeepAlivePublication.cjs'?{recordPublication(){}}:require(name),URL,Buffer,AbortSignal,fetch,console:{log:line=>output.push(line),error:line=>output.push(line)}});
 for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 assert.equal(runtime.exitCode,0);assert.equal(bodies.length,1);assert.ok(bodies[0].includes('\n  <scope>'));assert.ok(!bodies[0].includes('\\n'));assert.ok(output.every(line=>!line.includes('fixture-token')));
});
for(const [file,expected] of [
 ['auth-refresh-all-jenkins.cjs',['--publish']],['auth-refresh-second.cjs',['--slot=second']],['auth-refresh-second-jenkins.cjs',['--slot=second','--publish']],
])test(`${file} forwards flags and propagates failure`,()=>{
 const runtime={argv:['node',file,'mx'],execPath:'node',env:{ENVIRONMENT:'S1'},exitCode:0};let call;
 vm.runInNewContext(fs.readFileSync(`scripts/${file}`,'utf8'),{process:runtime,require:name=>{assert.equal(name,'node:child_process');return {spawnSync:(exe,args,options)=>{call={exe,args:[...args],options};return {status:2};}};}});
 assert.deepEqual(call.args,['scripts/auth-refresh-all.cjs',...expected,'mx']);assert.equal(runtime.exitCode,2);assert.equal(call.options.env.ENVIRONMENT,'S1');
});
