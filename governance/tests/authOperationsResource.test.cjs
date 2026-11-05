const {test}=require('node:test');
const assert=require('node:assert/strict');
const {repairResourceOrigin,stableResourceAddress}=require('../../utils/authOperationsResource.cjs');
test('Windows resource address selection is read-only, bounded and rejects invalid output',()=>{let called=false;assert.equal(stableResourceAddress({platform:'win32',run:(_shell,args,options)=>{called=true;assert.match(args.at(-1),/SuffixOrigin -eq 'Link'/);assert.equal(options.windowsHide,true);assert.equal(options.timeout,15000);return '2001:db8::2\r\n';}}),'2001:db8::2');assert.equal(called,true);assert.throws(()=>stableResourceAddress({platform:'win32',run:()=> 'not an address'}),/not proven/);assert.equal(stableResourceAddress({platform:'linux'}),null);});
const env={JENKINS_URL:'http://127.0.0.1:8080',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'private-fixture'};
function fixture({alien=false,denied=false,current=false,missingMirror=false,resourceHost404=false}={}){
  const calls=[];
  const request=async(url,options={})=>{calls.push({url,options});if(url.includes('/userContent/'))return missingMirror?{status:404,headers:new Headers()}:{status:302,headers:new Headers({location:(current?'http://localhost:8080':'http://[2001:db8::1]:8080')+'/static-fixture/index.html'})};if(url==='http://localhost:8080/login')return{status:resourceHost404?404:200,ok:!resourceHost404,headers:new Headers({'x-jenkins':'fixture'})};if(url.endsWith('/crumbIssuer/api/json'))return{ok:true,json:async()=>({crumbRequestField:'Crumb',crumb:'private-crumb-fixture'})};if(url.endsWith('/scriptText')){const script=new URLSearchParams(options.body).get('script');return{ok:!denied,status:denied?403:200,text:async()=> script.includes('c.setUrl(')?'RESOURCE_ORIGIN_UPDATED':'RESOURCE_ORIGIN http://[2001:db8::1]:8080/'};}throw Error('Unexpected fixture URL');};
  return{calls,dependencies:{request,lookup:async()=>[{address:alien?'203.0.113.9':'192.168.1.2'}],hostname:()=> 'fixture',interfaces:()=>({wifi:[{address:'192.168.1.2'}]})}};
}
test('dashboard check detects retired resource origin without mutation',async()=>{const f=fixture();const r=await repairResourceOrigin({env},f.dependencies);assert.equal(r.needsRepair,true);assert.ok(!f.calls.some(c=>c.options.method==='POST'));});
test('repair changes only resource URL, preserving CSP/auth/jobs',async()=>{const f=fixture();const r=await repairResourceOrigin({env,apply:true},f.dependencies);assert.equal(r.changed,true);const post=f.calls.find(c=>c.url.endsWith('/scriptText'));const script=new URLSearchParams(post.options.body).get('script');assert.match(script,/ResourceDomainConfiguration/);assert.match(script,/setUrl/);assert.doesNotMatch(script,/CSP|ContentSecurityPolicy|securityRealm|authorizationStrategy|createProject|build\(/);});
test('nonlocal explicit IPv6 is rejected before a configuration write',async()=>{const f=fixture({alien:true});await assert.rejects(repairResourceOrigin({env,apply:true,resourceAddress:'2001:db8::2'},f.dependencies),/this machine/);assert.ok(!f.calls.some(c=>c.options.method==='POST'));});
test('missing admin permission is explicit; no weaker workaround',async()=>{const f=fixture({denied:true});await assert.rejects(repairResourceOrigin({env,apply:true},f.dependencies),e=>e.code==='JENKINS_ADMIN_REQUIRED');});
test('already stable origin is idempotent',async()=>{const f=fixture({current:true});assert.equal((await repairResourceOrigin({env,apply:true},f.dependencies)).changed,false);assert.equal(f.calls.length,2);});

test('resource CLI exposes a safe stage when local IPv6 selection fails',async()=>{
 const {main}=require('../../scripts/auth-operations-resource.cjs');
 const outputs=[];
 let repairCalled=false;
 const status=await main({argv:['--apply'],select:()=>{const e=new Error('PowerShell command failed with private diagnostics');e.status=2;throw e;},repair:async()=>{repairCalled=true;},error:s=>outputs.push(s),log:()=>{}});
 assert.equal(status,1);
 assert.equal(repairCalled,false);
 assert.match(outputs[0],/SELECT_LOCAL_IP · LOCAL_IPV6_NOT_AVAILABLE/);
 assert.doesNotMatch(outputs[0],/private diagnostics/);
});
test('resource CLI reports only whitelisted Jenkins failure codes',async()=>{
 const {main}=require('../../scripts/auth-operations-resource.cjs');
 const errors=[];
 const status=await main({argv:['--apply'],select:()=> '2001:db8::2',repair:async()=>{throw new Error('Resource and credential-bearing Jenkins origins must stay distinct. token=sensitive');},error:s=>errors.push(s),log:()=>{}});
 assert.equal(status,1);
 assert.match(errors[0],/CHECK_JENKINS_RESOURCE · RESOURCE_ORIGIN_NOT_ISOLATED/);
 assert.doesNotMatch(errors[0],/sensitive/);
});

test('loopback resource origin stays stable regardless of rotating public IPv6',async()=>{
  const f=fixture();
  const r=await repairResourceOrigin({env},f.dependencies);
  assert.equal(r.origin,'http://localhost:8080');
  assert.equal(r.needsRepair,true);
  assert.ok(!f.calls.some(c=>c.url.includes('[2001:db8::')&&c.url.endsWith('/login')));
});
test('configured resource host may respond 404 to /login as Jenkins only serves static files',async()=>{
  const f=fixture({current:true,resourceHost404:true});
  const r=await repairResourceOrigin({env},f.dependencies);
  assert.equal(r.changed,false);
  assert.equal(r.origin,'http://localhost:8080');
});
test('HTML Publisher without userContent mirror falls back to admin-only resource configuration read',async()=>{
  const f=fixture({missingMirror:true});
  const r=await repairResourceOrigin({env},f.dependencies);
  assert.equal(r.needsRepair,true);
  assert.equal(r.previous,'http://[2001:db8::1]:8080');
  const scripts=f.calls.filter(c=>c.url.endsWith('/scriptText'));
  assert.equal(scripts.length,1);
  assert.match(new URLSearchParams(scripts[0].options.body).get('script'),/c\.getUrl\(/);
  assert.ok(!f.calls.some(c=>new URLSearchParams(c.options.body||'').get('script')?.includes('c.setUrl(')));
});

test('HTML Publisher missing mirror can repair resource origin after safe admin read',async()=>{
  const f=fixture({missingMirror:true});
  const result=await repairResourceOrigin({env,apply:true},f.dependencies);
  assert.equal(result.changed,true);
  assert.equal(result.origin,'http://localhost:8080');
  const scripts=f.calls.filter(c=>c.url.endsWith('/scriptText'));
  assert.equal(scripts.length,2);
  assert.match(new URLSearchParams(scripts[0].options.body).get('script'),/c\.getUrl\(/);
  assert.match(new URLSearchParams(scripts[1].options.body).get('script'),/c\.setUrl\(/);
  assert.equal(f.calls.filter(c=>c.url.endsWith('/crumbIssuer/api/json')).length,1);
});
test('resource CLI defaults to stable loopback without selecting a public IPv6',async()=>{
 const {main}=require('../../scripts/auth-operations-resource.cjs');
 let calls=0;
 const result=await main({argv:[],repair:async options=>{calls++;assert.equal(options.resourceAddress,null);assert.equal(options.apply,false);return {changed:false,origin:'http://localhost:8080'};},log:()=>{},error:()=>assert.fail('default must succeed')});
 assert.equal(result,0);
 assert.equal(calls,1);
});
