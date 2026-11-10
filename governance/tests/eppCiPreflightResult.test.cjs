const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {failureType,writePreflightResult,readPreflightResult}=require('../../utils/eppCiPreflightResult.cjs');
test('only proven auth prerequisites are AUTH_BLOCKED; network remains infrastructure',()=>{
 for(const reason of ['EPP_IDENTITY_REQUIRED','CORPORATE_ACTIVATION_REQUIRED','SAMSUNG_ACCOUNT_SECURITY_BLOCKED'])assert.equal(failureType({eppReason:reason}),'AUTH_BLOCKED');
 for(const reason of ['EPP_VERIFICATION_DEADLINE','EPP_NAVIGATION_OR_RENDER_TIMEOUT','SERVER_PROOF_PENDING'])assert.equal(failureType({eppReason:reason}),'INFRA_ERROR');
 assert.equal(failureType({eppReason:'VERIFICATION_CODE_REJECTED'}),'TEST_DATA_REQUIRED');
});
test('existing non-CI preflight does not write a new artifact',()=>assert.equal(writePreflightResult({},{}),undefined));
test('CI artifact preserves only typed, current execution metadata',()=>{
 const output=path.resolve('test-results/ci-preflight-fixture'),config={market:'CL',environment:'S2',program:'alianzas'},env={CI:'1',EPP_RUN_ID:'build-1',PLAYWRIGHT_JSON_OUTPUT_FILE:path.join(output,'results.json'),EPP_CI_PREFLIGHT_FILE:path.join(output,'preflight.json')};
 const files=new Map(),io={mkdirSync:()=>{},writeFileSync:(p,v)=>files.set(p,v),readFileSync:p=>files.get(p)};
 const record=writePreflightResult(config,env,{eppReason:'EPP_IDENTITY_REQUIRED',message:'never expose this detail'},io);
 assert.equal(record.type,'AUTH_BLOCKED');assert.doesNotMatch([...files.values()].join(''),/never expose/);assert.equal(readPreflightResult({...config,runId:'build-1',output},io).type,'AUTH_BLOCKED');assert.equal(readPreflightResult({...config,runId:'other-run',output},io),null);
 assert.throws(()=>writePreflightResult(config,{...env,EPP_CI_PREFLIGHT_FILE:path.resolve('playwright/.auth/state.json')},null,io),/scope/);
});
