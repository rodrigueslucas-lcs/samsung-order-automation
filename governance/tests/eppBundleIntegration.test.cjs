const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {getEppConfig}=require('../../config/markets/epp');
const {getPrimaryEppCredentials}=require('../../utils/eppSession.cjs');
const {makeBundle,contentHash}=require('../../utils/eppKeepAlive.cjs');
const {publishBundle}=require('../../utils/eppJenkinsBundle.cjs');
const {buildRun,executeRun}=require('../../scripts/run-epp-qst.cjs');
const cfg=getEppConfig('MX',{ENVIRONMENT:'S2'});
const snapshot={storageState:{cookies:[],origins:[]},sessionStorage:{},proof:{userAccepted:true,accessAccepted:true}};
const env={JENKINS_URL:'http://127.0.0.1:8080',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'private-fixture'};
test('Jenkins EPP publication uses its own credential namespace and validates before transmitting',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'epp-publish-test-')),file=path.join(dir,'bundle.json');const calls=[];let created=false;
 try{fs.writeFileSync(file,JSON.stringify(makeBundle(cfg,snapshot)));const request=async(url,options={})=>{calls.push({url,options});if(url.endsWith('/crumbIssuer/api/json'))return{ok:true,json:async()=>({crumbRequestField:'Crumb',crumb:'fixture'})};if(options.method==='POST'){created=true;return{ok:true,status:201};}return{ok:created,status:created?200:404};};
 const result=await publishBundle(cfg,file,env,{request});assert.equal(result.credentialId,'samsung-epp-mx-s2-primary-session-bundle');assert.equal(result.contentHash,contentHash(makeBundle(cfg,snapshot)));assert.ok(calls.every(c=>!c.url.includes('/credential/samsung-mx-')));assert.equal(calls.filter(c=>c.options.method==='POST').length,1);
 calls.length=0;await assert.rejects(publishBundle({...cfg,authSlot:'second'},file,env,{request}),/mismatch/);assert.equal(calls.length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('optional EPP preflight blocks suite execution on unproven bundle and always releases lease',()=>{
 const run=buildRun('MX',[],{MX_QST_ENVIRONMENT:'S2',EPP_AUTH_PREFLIGHT:'1'},{readData:()=>null});let released=0;const calls=[];
 const result=executeRun(run,{acquire:()=>({env:{EPP_LEASE_TOKEN:'fixture'},release:()=>released++}),spawn:(_node,args)=>{calls.push(args);return{status:22};}});
 assert.equal(result,22);assert.equal(calls.length,1);assert.match(calls[0][0],/auth-epp-preflight/);assert.equal(released,1);
});
test('EPP preflight is opt-in and list discovery never installs or verifies auth',()=>{
 const run=buildRun('MX',['--list'],{EPP_SESSION_BUNDLE_FILE:'fixture.json'},{readData:()=>{throw Error('list must not read private fixtures');}});let acquired=0,calls=0;
 assert.equal(executeRun(run,{acquire:()=>{acquired++;},spawn:()=>{calls++;return{status:0};}}),0);assert.equal(acquired,0);assert.equal(calls,1);
});
test('SECOND credentials cannot fall back to FIRST or reuse the same identity',()=>{
 const config=getEppConfig('CO',{EPP_AUTH_SLOT:'second'});
 const missing={readFileSync:()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'});}};
 assert.throws(()=>getPrimaryEppCredentials(config,{},missing),e=>e.eppReason==='EPP_SECOND_IDENTITY_NOT_PROVISIONED');
 const same={existsSync:()=>true,readFileSync:()=>JSON.stringify({email:'same@example.test',password:'fixture'})};
 assert.throws(()=>getPrimaryEppCredentials(config,{},same),e=>e.eppReason==='EPP_SECOND_IDENTITY_NOT_INDEPENDENT');
 const distinct={existsSync:()=>true,readFileSync:file=>JSON.stringify({email:file.includes('second')?'second@example.test':'first@example.test',password:'fixture'})};
 assert.equal(getPrimaryEppCredentials(config,{},distinct).email,'second@example.test');
});
