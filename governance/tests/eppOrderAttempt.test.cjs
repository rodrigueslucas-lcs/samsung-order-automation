const test=require('node:test');const assert=require('node:assert/strict');
const {beginEppOrderAttempt}=require('../../utils/eppOrderAttempt.cjs');
const cfg={market:'MX',environment:'S2'};
function memory(){const files=new Map();return{files,mkdirSync(){},writeFileSync(file,body,options){if(options?.flag==='wx'&&files.has(file))throw Object.assign(new Error(),{code:'EEXIST'});files.set(file,body);},renameSync(from,to){files.set(to,files.get(from));files.delete(from);}};}
test('ambiguous submit stays blocked across attempts',()=>{const io=memory();beginEppOrderAttempt(cfg,'card',{io});assert.throws(()=>beginEppOrderAttempt(cfg,'card',{io}),/AMBIGUOUS/);assert.equal(io.files.size,1);assert.equal(JSON.parse([...io.files.values()][0]).status,'SUBMITTING');});
test('only a confirmed causal order releases the active marker',()=>{const io=memory();const a=beginEppOrderAttempt(cfg,'card',{io});assert.throws(()=>a.confirm('invalid'),/Invalid/);assert.throws(()=>beginEppOrderAttempt(cfg,'card',{io}),/AMBIGUOUS/);a.confirm('MX261027-12345678');beginEppOrderAttempt(cfg,'card',{io});assert.equal(io.files.size,2);});
test('S1 and S2 attempt markers stay isolated',()=>{const io=memory();beginEppOrderAttempt(cfg,'card',{io});beginEppOrderAttempt({...cfg,environment:'S1'},'card',{io});assert.equal(io.files.size,2);});
