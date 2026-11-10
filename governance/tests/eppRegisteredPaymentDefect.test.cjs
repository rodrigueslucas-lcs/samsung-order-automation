const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {attachRegisteredPaymentDefect}=require('../../utils/eppRegisteredPaymentDefect.cjs');
const {classify}=require('../../reporting/epp-quality/model.cjs');
for(const [market,program,tc,jira]of[['MX','pymesmx','SAM-25046','RT-779284'],['CL','alianzas','SAM-24865','SAM-25161']]){
 test(market+' quarantines only registered S2 payment signature with honest non-runtime evidence',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'epp-quarantine-'));try{
 const info={annotations:[],outputPath:name=>path.join(root,name),attach:async(name,attachment)=>{info.attachment={name,...attachment};}};
 const reason=await attachRegisteredPaymentDefect({market,program,environment:'S2'},tc,info);
 const record=JSON.parse(fs.readFileSync(info.attachment.path));assert.equal(record.submitCount,0);assert.equal(record.execution,'QUARANTINED_NOT_REEXECUTED');assert.equal(record.jira,jira);
 assert.equal(classify({market,program,tc,raw:'skipped',reason,evidence:[info.attachment]}).reference,jira);
 assert.equal(classify({market,program,tc,raw:'failed',reason:'TimeoutError',evidence:[info.attachment]}).quality,'FAIL');
 for(const change of [{environment:'S1'},{market:'PE'},{program:'other'}])assert.equal(await attachRegisteredPaymentDefect({market,program,environment:'S2',...change},tc,info),null);
 }finally{fs.rmSync(root,{recursive:true,force:true});}});
}
test('CO CI consent remains explicit and restricted by pinned market',()=>{const pipeline=fs.readFileSync('Jenkinsfile.epp','utf8');assert.match(pipeline,/booleanParam\(name: 'CO_EPP_ALLOW_PRIMARY_MARKETING', defaultValue: true/);assert.match(pipeline,/market == 'CO' && params.CO_EPP_ALLOW_PRIMARY_MARKETING/);});
