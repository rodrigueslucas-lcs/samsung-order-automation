const test=require('node:test');const assert=require('node:assert/strict');
const {beginEppOrderAttempt}=require('../../utils/eppOrderAttempt.cjs');
const {latestConfirmedEppOrder}=require('../../utils/eppOrderAttempt.cjs');
test('confirmation recovery reads only a validated causal record in its own programme directory',()=>{
 const orderCode='PE261029-12345678_261029120000';
 const record={market:'PE',environment:'S2',kind:'card',status:'CONFIRMED',orderCode,at:'2026-10-29T17:00:00Z'};
 const config={market:'PE',environment:'S2',programNamespace:'pe_membership_vip'};
 const io={existsSync:()=>true,readdirSync:()=>[`confirmed-card-${orderCode}.json`,'order-attempt-card.json','confirmed-card-MX261029-12345678.json'],readFileSync:file=>{assert.ok(file.includes('pe_membership_vip'));return JSON.stringify(record);}};
 assert.equal(latestConfirmedEppOrder(config,'card',io).orderCode,orderCode);
 record.status='SUBMITTING';assert.throws(()=>latestConfirmedEppOrder(config,'card',io),/invalid/);
});
const cfg={market:'MX',environment:'S2'};
function memory(){const files=new Map();return{files,mkdirSync(){},writeFileSync(file,body,options){if(options?.flag==='wx'&&files.has(file))throw Object.assign(new Error(),{code:'EEXIST'});files.set(file,body);},renameSync(from,to){files.set(to,files.get(from));files.delete(from);}};}
test('ambiguous submit stays blocked across attempts',()=>{const io=memory();beginEppOrderAttempt(cfg,'card',{io});assert.throws(()=>beginEppOrderAttempt(cfg,'card',{io}),/AMBIGUOUS/);assert.equal(io.files.size,1);assert.equal(JSON.parse([...io.files.values()][0]).status,'SUBMITTING');});
test('confirmation selects only this campaign and never promotes historical orders',()=>{
 const {confirmedEppOrderForRun}=require('../../utils/eppOrderAttempt.cjs'),io=memory();
 io.existsSync=f=>io.files.has(f)||[...io.files.keys()].some(key=>key.startsWith(f));
 io.readFileSync=f=>io.files.get(f);io.readdirSync=dir=>[...io.files.keys()].filter(f=>f.startsWith(dir)).map(f=>require('node:path').basename(f));
 beginEppOrderAttempt(cfg,'card',{io,runId:'old-run'}).confirm('MX261104-12345678');
 assert.equal(confirmedEppOrderForRun(cfg,'current-run',io),null);
 beginEppOrderAttempt(cfg,'card',{io,runId:'current-run'}).confirm('MX261105-87654321');
 assert.equal(confirmedEppOrderForRun(cfg,'current-run',io).orderCode,'MX261105-87654321');
 assert.equal(confirmedEppOrderForRun(cfg,'another-run',io),null);
 assert.throws(()=>confirmedEppOrderForRun(cfg,undefined,io),/CURRENT_RUN_ORDER_REQUIRED/);
});
test('only a confirmed causal order releases the active marker',()=>{const io=memory();const a=beginEppOrderAttempt(cfg,'card',{io});assert.throws(()=>a.confirm('invalid'),/Invalid/);assert.throws(()=>beginEppOrderAttempt(cfg,'card',{io}),/AMBIGUOUS/);a.confirm('MX261027-12345678');beginEppOrderAttempt(cfg,'card',{io});assert.equal(io.files.size,2);});
test('S1 and S2 attempt markers stay isolated',()=>{const io=memory();beginEppOrderAttempt(cfg,'card',{io});beginEppOrderAttempt({...cfg,environment:'S1'},'card',{io});assert.equal(io.files.size,2);});

test('CL bank submit has its own durable single-shot marker',()=>{const io=memory(),cl={market:'CL',environment:'S2'};const a=beginEppOrderAttempt(cl,'transfer',{io});assert.throws(()=>beginEppOrderAttempt(cl,'transfer',{io}),/AMBIGUOUS/);a.observe('CL261030-12345678');a.confirm('CL261030-12345678');assert.equal(JSON.parse([...io.files.values()][0]).kind,'transfer');});

test('Flow confirmation stage preserves the same transfer marker and rejects another order',()=>{
 const {recordClFlowConfirmationSubmitted}=require('../../utils/eppOrderAttempt.cjs'),io=memory(),cl={market:'CL',environment:'S2'};
 io.existsSync=f=>io.files.has(f);io.readFileSync=f=>io.files.get(f);
 const a=beginEppOrderAttempt(cl,'transfer',{io});
 assert.throws(()=>recordClFlowConfirmationSubmitted(cl,'CL261104-12345678',io),/observed CL transfer/);
 a.observe('CL261104-12345678');assert.throws(()=>recordClFlowConfirmationSubmitted(cl,'CL261104-87654321',io),/observed CL transfer/);
 recordClFlowConfirmationSubmitted(cl,'CL261104-12345678',io);
 const record=JSON.parse([...io.files.values()][0]);assert.equal(record.status,'OBSERVED_ORDER');assert.equal(record.providerConfirmationSubmitted,true);assert.equal(io.files.size,1);
});

test('only a conclusive rejection plus complete causal history can archive an unresolved CL attempt',()=>{
 const {archiveRejectedEppOrderAttempt}=require('../../utils/eppOrderAttempt.cjs'),io=memory(),cl={market:'CL',environment:'S2'},at='2026-10-30T00:00:00Z';
 io.existsSync=f=>io.files.has(f);io.readFileSync=f=>io.files.get(f);
 beginEppOrderAttempt(cl,'card',{io,now:()=>at});
 const proof={market:'CL',environment:'S2',attemptAt:at,providerBusinessCode:601,readOnly:true,historyComplete:true,candidates:[]};
 for(const change of [{market:'MX'},{environment:'S1'},{providerBusinessCode:500},{historyComplete:false},{candidates:[{code:'CL261030-12345678'}]},{attemptAt:'2026-10-31T00:00:00Z'}])assert.throws(()=>archiveRejectedEppOrderAttempt(cl,'card',{...proof,...change},io),/conclusive/);
 assert.equal(archiveRejectedEppOrderAttempt(cl,'card',proof,io).submitRetried,false);
 assert.equal(JSON.parse([...io.files.values()][0]).status,'REJECTED');
 beginEppOrderAttempt(cl,'card',{io});assert.equal(io.files.size,2);
});

test('confirmed order archival tolerates Windows busy without another financial attempt',()=>{const io=memory(),rename=io.renameSync;let count=0;io.renameSync=(a,b)=>{if(++count===1)throw Object.assign(new Error('busy'),{code:'EBUSY'});rename(a,b);};beginEppOrderAttempt(cfg,'card',{io}).confirm('MX261106-12345678');assert.equal(count,2);assert.equal(JSON.parse([...io.files.values()][0]).status,'CONFIRMED');});
test('interrupted archival of a proven confirmed record resumes locally, never becoming an invalid financial state',()=>{const io=memory();io.existsSync=p=>io.files.has(p);io.readFileSync=p=>io.files.get(p);const a=beginEppOrderAttempt(cfg,'card',{io});const key=[...io.files.keys()][0];io.files.set(key,JSON.stringify({...JSON.parse(io.files.get(key)),status:'CONFIRMED',orderCode:'MX261106-12345678'}));assert.equal(require('../../utils/eppOrderAttempt.cjs').pendingEppOrderAttempt(cfg,'card',io),null);assert.equal(io.files.size,1);assert.ok([...io.files.keys()][0].includes('confirmed-card-'));});
