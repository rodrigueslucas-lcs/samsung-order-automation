const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {acquireMarketLease}=require('../../utils/authMarketLease.cjs');const {runNodeScript}=require('../../utils/authKeepAliveRunner.cjs');
test('real EPP maintenance child enters the shared leased wrapper and reports a configuration rejection without login',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'epp-child-contract-')),lease=acquireMarketLease('mx','S2',{directory});let stdout='',stderr='';
  try{const result=await runNodeScript('scripts/auth-epp-maintenance-child.cjs',{...process.env,...lease.env,EPP_LEASE_TOKEN:lease.env.AUTH_MARKET_LEASE,EPP_KEEPALIVE_MARKET:'INVALID_FIXTURE',EPP_KEEPALIVE_ENVIRONMENT:'S2'},{timeoutMs:120000,stdout:chunk=>{stdout+=chunk;},stderr:chunk=>{stderr+=chunk;}});
    assert.equal(result.timedOut,false);assert.equal(result.code,1);assert.notEqual(result.diagnostic,'CHILD_LEASE_NOT_REGISTERED');assert.doesNotMatch(stderr,/Child refused/);assert.match(stdout,/EPP_AUTH_RESULT /);assert.doesNotMatch(stdout,/START|Samsung Account opened/);
    const line=stdout.split(/\r?\n/).find(line=>line.startsWith('EPP_AUTH_RESULT '));assert.equal(JSON.parse(line.slice(16)).status,'UNPROVEN');
  }finally{lease();if(fs.existsSync(directory)&&fs.readdirSync(directory).length===0)fs.rmdirSync(directory);}
});
