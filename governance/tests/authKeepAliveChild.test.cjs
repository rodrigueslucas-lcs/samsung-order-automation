const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
const {acquireMarketLease}=require('../../utils/authMarketLease.cjs');const {runNodeScript}=require('../../utils/authKeepAliveRunner.cjs');
test('leased auth child runs an isolated fixture, returns only safe audit fields, then releases its membership',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'smb-child-fixture-'));
 const name='auth-verify-fixture'+crypto.randomBytes(6).toString('hex').replace(/[0-9]/g,'a')+'.cjs';const file=path.resolve('scripts',name);
 const release=acquireMarketLease('cl','S2',{directory,env:{}});
 try{
  fs.writeFileSync(file,"console.log('AUTH_HEALTH_AUDIT '+JSON.stringify({accountPages:0,statePersisted:true}));console.error('fixture-not-a-real-secret');",{flag:'wx'});
  const result=await runNodeScript(file,{...process.env,...release.env},{timeoutMs:60000});
  assert.equal(result.code,0);assert.deepEqual(result.audit,{accountPages:0,statePersisted:true});assert.ok(!JSON.stringify(result).includes('fixture-not-a-real-secret'));
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);release();fs.rmdirSync(directory);}
});
