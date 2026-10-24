const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {acquireMarketLease,registerLeaseProcess}=require('../../utils/authMarketLease.cjs');
function fixture(){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'smb-auth-lease-test-'));return {directory,cleanup:()=>fs.rmdirSync(directory)};}
test('market lease excludes competitors but permits other markets and verified inherited children',()=>{
 const f=fixture();let a,b;try{a=acquireMarketLease('mx','S2',{directory:f.directory,env:{}});assert.throws(()=>acquireMarketLease('mx','S2',{directory:f.directory,env:{}}),e=>e.code==='AUTH_BUSY');b=acquireMarketLease('co','S2',{directory:f.directory,env:{}});const inherited=acquireMarketLease('mx','S2',{directory:f.directory,env:a.env});inherited();assert.throws(()=>acquireMarketLease('mx','S2',{directory:f.directory,env:{}}),e=>e.code==='AUTH_BUSY');}finally{b?.();a?.();f.cleanup();}
});
test('a child registration prevents release until the child finishes',()=>{
 const f=fixture();const release=acquireMarketLease('mx','S2',{directory:f.directory,env:{}});const leave=registerLeaseProcess(release.env);try{assert.throws(release,e=>e.code==='AUTH_BUSY');}finally{leave();release();f.cleanup();}
});
test('dead owner is not reclaimed while a registered child is alive',()=>{
 const f=fixture();const release=acquireMarketLease('mx','S2',{directory:f.directory,env:{}});const leave=registerLeaseProcess(release.env);
 const ownerFile=path.join(f.directory,'s2-mx.lock','owner.json');const owner=JSON.parse(fs.readFileSync(ownerFile));owner.pid=123456789;fs.writeFileSync(ownerFile,JSON.stringify(owner));
 try{assert.throws(()=>acquireMarketLease('mx','S2',{directory:f.directory,env:{},alive:pid=>pid===process.pid}),e=>e.code==='AUTH_BUSY');}finally{leave();release();f.cleanup();}
});
test('proven dead owner is reclaimed without age based takeover',()=>{
 const f=fixture();const stale=acquireMarketLease('mx','S2',{directory:f.directory,env:{},pid:123456789});let live;
 try{live=acquireMarketLease('mx','S2',{directory:f.directory,env:{},alive:()=>false});stale();assert.ok(fs.existsSync(path.join(f.directory,'s2-mx.lock')));}finally{live?.();f.cleanup();}
});
test('wrong inherited token cannot adopt an active market lease',()=>{
 const f=fixture();const release=acquireMarketLease('mx','S2',{directory:f.directory,env:{}});try{assert.throws(()=>acquireMarketLease('mx','S2',{directory:f.directory,env:{...release.env,AUTH_MARKET_LEASE:'wrong'}}),e=>e.code==='AUTH_BUSY');}finally{release();f.cleanup();}
});

test('release prunes only a proven dead child registration',()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'smb-dead-member-'));const release=acquireMarketLease('co','S2',{directory,env:{},alive:pid=>pid===process.pid});try{const leave=registerLeaseProcess(release.env,999999999);release();leave();assert.deepEqual(fs.readdirSync(directory),[]);}finally{if(!fs.readdirSync(directory).length)fs.rmdirSync(directory);}});
