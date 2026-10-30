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
test('only a confirmed causal order releases the active marker',()=>{const io=memory();const a=beginEppOrderAttempt(cfg,'card',{io});assert.throws(()=>a.confirm('invalid'),/Invalid/);assert.throws(()=>beginEppOrderAttempt(cfg,'card',{io}),/AMBIGUOUS/);a.confirm('MX261027-12345678');beginEppOrderAttempt(cfg,'card',{io});assert.equal(io.files.size,2);});
test('S1 and S2 attempt markers stay isolated',()=>{const io=memory();beginEppOrderAttempt(cfg,'card',{io});beginEppOrderAttempt({...cfg,environment:'S1'},'card',{io});assert.equal(io.files.size,2);});

test('CL bank submit has its own durable single-shot marker',()=>{const io=memory(),cl={market:'CL',environment:'S2'};const a=beginEppOrderAttempt(cl,'transfer',{io});assert.throws(()=>beginEppOrderAttempt(cl,'transfer',{io}),/AMBIGUOUS/);a.observe('CL261030-12345678');a.confirm('CL261030-12345678');assert.equal(JSON.parse([...io.files.values()][0]).kind,'transfer');});
