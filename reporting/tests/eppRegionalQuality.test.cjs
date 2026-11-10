const test=require('node:test'),assert=require('node:assert/strict');
const {buildRegionalSummary,renderRegionalSummary,collectRegionalObservations}=require('../epp-quality/regional.cjs');
const quality={market:'CL',environment:'S2',program:'alianzas',official:7,buildNumber:'2',gate:'BLOCKED BY EXTERNAL DEPENDENCIES',counts:{PASS:5,FAIL:0,KNOWN_DEFECT:1,RECONCILIATION_REQUIRED:1,NOT_RUN:0,AUTH_BLOCKED:0,TEST_DATA_REQUIRED:0}};
test('regional summary always exposes eight independent lanes without combining EPP and Base results',()=>{
 const model=buildRegionalSummary([{job:'Samsung-SMB-EPP-CL',buildNumber:2,jenkinsResult:'UNSTABLE',environment:'S2',reportUrl:'http://localhost:8080/job/Samsung-SMB-EPP-CL/2/',quality},{job:'Samsung-SMB-CL',buildNumber:11,jenkinsResult:'SUCCESS',environment:'S2',runtime:{market:'CL',store:'BASE_STORE',buildNumber:11,summary:{official:31,passed:24,blocked:7}}}]);
 assert.equal(model.rows.length,8);assert.equal(model.rows.find(r=>r.job==='Samsung-SMB-EPP-CL').counts.PASS,5);assert.equal(model.rows.find(r=>r.job==='Samsung-SMB-CL').counts.passed,24);assert.equal(model.rows.find(r=>r.job==='Samsung-SMB-EPP-MX').jenkinsResult,'NOT_RUN');assert.equal(model.rows.find(r=>r.job==='Samsung-SMB-CL').gate,null);
 const html=renderRegionalSummary(model);assert.match(html,/Eight independent/);assert.match(html,/Authentication health is not functional PASS/);assert.match(html,/observed build/i);assert.match(html,/Current-build counts unavailable/);
});
test('another programme, build or store cannot donate its PASS to the summary',()=>{
 for(const change of [{market:'PE'},{environment:'S1'},{program:'another_program'},{buildNumber:'1'}])assert.throws(()=>buildRegionalSummary([{job:'Samsung-SMB-EPP-CL',buildNumber:2,quality:{...quality,...change}}]),/Foreign/);
 assert.throws(()=>buildRegionalSummary([{job:'Samsung-SMB-CL',buildNumber:2,runtime:{market:'CL',store:'EPP',buildNumber:2}}]),/Foreign/);
});
test('regional links reject foreign jobs and credential-bearing URLs',()=>{
 for(const reportUrl of ['https://user:secret@example.test/job/Samsung-SMB-EPP-CL/2/','http://localhost/job/Samsung-SMB-MX/2/','http://localhost/job/Samsung-SMB-EPP-CL/2/?token=secret'])assert.throws(()=>buildRegionalSummary([{job:'Samsung-SMB-EPP-CL',buildNumber:2,reportUrl}]),/Foreign/);
});
test('one unavailable Jenkins job never prevents collecting the other seven',async()=>{
 const observations=await collectRegionalObservations(async route=>{if(route.includes('EPP-CO'))throw new Error('Synthetic connection failure');return{ok:false,status:404};});
 assert.equal(observations.length,8);assert.equal(observations.find(row=>row.job==='Samsung-SMB-EPP-CO').unavailable,true);assert.equal(buildRegionalSummary(observations).rows.find(row=>row.job==='Samsung-SMB-EPP-CO').jenkinsResult,'UNAVAILABLE');
});
test('incomplete EPP counts cannot become a green regional summary',()=>{
 assert.throws(()=>buildRegionalSummary([{job:'Samsung-SMB-EPP-CL',buildNumber:2,quality:{...quality,counts:{PASS:7}}}]),/Unproven/);
});
