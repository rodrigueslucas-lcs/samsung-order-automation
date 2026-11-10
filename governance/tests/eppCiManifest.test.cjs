const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {validateManifest}=require('../../scripts/finalize-epp-jenkins.cjs');
test('public execution metadata excludes private auth, observer and workspace paths',()=>{
 const {publicExecution}=require('../../scripts/finalize-epp-jenkins.cjs');
 const publicData=publicExecution({market:'CL',environment:'S2',program:'alianzas',runId:'test',buildNumber:1,authorityRoot:'private-auth-location',privateOutput:'private-diagnostic-location',reporting:{publisherConfig:'private-observer-location'}});
 assert.equal(publicData.market,'CL');assert.doesNotMatch(JSON.stringify(publicData),/private-|authorityRoot|publisherConfig|privateOutput/);
 const pipeline=require('node:fs').readFileSync('Jenkinsfile.epp','utf8');
 assert.doesNotMatch(pipeline.match(/archiveArtifacts\([^\n]+/)?.[0]||'',/epp-ci-current/);
});
const env={TEST_MARKET:'CL',BUILD_NUMBER:'3'},relativeOutput='test-results/epp/cl/s2/build-3',manifest={market:'CL',environment:'S2',program:'alianzas',runId:'build-3',buildNumber:'3',relativeOutput,output:path.resolve(relativeOutput)};
test('current EPP build path is independently validated before publication',()=>assert.equal(validateManifest(manifest,env),path.resolve(relativeOutput)));
test('stale, cross-market and path traversal manifests cannot publish',()=>{for(const change of [{buildNumber:'2'},{market:'PE'},{environment:'S1'},{runId:'../old'},{relativeOutput:'test-results/epp/cl/s2/old'},{output:path.resolve('playwright/.auth')}])assert.throws(()=>validateManifest({...manifest,...change},env));});
test('cleanup refuses financial markers even inside private workspace',()=>{
 const {cleanupPrivateWorkspace}=require('../../scripts/finalize-epp-jenkins.cjs');let removed=false;const workspace=path.resolve('test-results/ci-mock-workspace'),target=path.join(workspace,'playwright/.auth/epp');
 const io={realpathSync:p=>p,existsSync:()=>true,readdirSync:()=>[{name:'order-attempt-card.json',isSymbolicLink:()=>false,isDirectory:()=>false}],rmSync:()=>{removed=true;}};
 assert.throws(()=>cleanupPrivateWorkspace(workspace,io),/financial ledger/);assert.equal(removed,false);
 io.readdirSync=()=>[];io.realpathSync=p=>p===target?path.resolve('playwright/.auth/epp'):p;assert.throws(()=>cleanupPrivateWorkspace(workspace,io),/escapes/);assert.equal(removed,false);
});
