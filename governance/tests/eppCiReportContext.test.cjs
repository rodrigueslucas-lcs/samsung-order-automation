const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {reportContext}=require('../../scripts/epp-ci-report-context.cjs');
const relativeOutput='test-results/epp/cl/s2/build-3',manifest={market:'CL',environment:'S2',program:'alianzas',runId:'build-3',buildNumber:'3',relativeOutput,output:path.resolve(relativeOutput)},env={TEST_MARKET:'CL',BUILD_NUMBER:'3'};
test('sandbox-safe pipeline uses Node validation instead of requiring a new Groovy constructor approval',()=>{
 const pipeline=fs.readFileSync('Jenkinsfile.epp','utf8');assert.doesNotMatch(pipeline,/JsonSlurper|scriptApproval|@NonCPS/);assert.match(pipeline,/epp-ci-report-context.cjs output/);assert.match(pipeline,/epp-ci-report-context.cjs gate/);
 const io={readFileSync:p=>JSON.stringify(p.endsWith('current.json')?manifest:{runId:'build-3',gate:'BLOCKED BY EXTERNAL DEPENDENCIES'})};
 assert.equal(reportContext('output',env,io),relativeOutput);assert.equal(reportContext('gate',env,io),'BLOCKED BY EXTERNAL DEPENDENCIES');
});
test('report context rejects stale build, foreign gate and arbitrary field selection',()=>{
 const io={readFileSync:p=>JSON.stringify(p.endsWith('current.json')?manifest:{runId:'old',gate:'FULLY PASSED'})};
 assert.throws(()=>reportContext('gate',env,io),/another/);assert.throws(()=>reportContext('output',{...env,BUILD_NUMBER:'2'},io),/mismatch/);assert.throws(()=>reportContext('authorityRoot',env,io),/Unsupported/);
});
