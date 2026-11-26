const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('Jenkinsfile', 'utf8').replace(/\r\n/g, '\n');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

test('P1 clears only the validated current output lane before auth can abort execution', () => {
  const request = section("stage('03 · Validate Request')", "stage('04 · Agent Health')");
  assert.match(request, /\['MX', 'PE', 'CL', 'CO'\]\.contains\(params\.MARKET\)/);
  assert.match(request, /params\.TEST_SUITE == 'official-p1'/);
  assert.match(request, /params\.P1_TARGET_IDS\?\.trim\(\) \? 'qst-targeted' : 'qst'/);
  assert.ok(request.indexOf('env.JENKINS_ARTIFACT_DIR != expectedDir') < request.indexOf('deleteDir()'));
  assert.match(request, /dir\(expectedDir\) \{ deleteDir\(\) \}/);
  assert.doesNotMatch(request, /dir\(['"](?:\.|test-results|playwright\/\.auth)['"]\)/);
  assert.ok(source.indexOf("stage('03 · Validate Request')") < source.indexOf('CI=1 node scripts/verify-jenkins-storefront-auth.cjs cl'));
});

test('absent current runtime JSON cannot trigger finalization or a successful build', () => {
  const finalize = section("stage('09 · Finalize Reports')", "stage('10 · Quality Summary')");
  assert.match(source, /env\.OFFICIAL_P1_NO_RESULTS = params\.TEST_SUITE == 'official-p1' \? '1' : '0'/);
  assert.ok(source.includes("params.MARKET == 'MX' ? 'mx-qst-safe-results.json' : 'results.json'"));
  const absent = finalize.slice(finalize.indexOf('if (!fileExists('), finalize.indexOf("env.OFFICIAL_P1_NO_RESULTS = '0'"));
  assert.match(absent, /currentBuild\.result = 'FAILURE'/);
  assert.match(absent, /return/);
  assert.ok(finalize.indexOf('if (!fileExists(') < finalize.indexOf('finalize-jenkins-suite.cjs'));
  assert.ok(finalize.indexOf('if (!fileExists(') < finalize.indexOf('finalize-allure-mx-qst.cjs'));
});

test('preflight failure cannot publish stale reports as current TC evidence', () => {
  const publish = section("if (env.PREQA2_PREFLIGHT_FAILED == '1') {\n          echo 'PREQA2 PREFLIGHT FAILURE: no Official", '\n    success {');
  assert.ok(publish.indexOf("env.OFFICIAL_P1_NO_RESULTS == '1'") < publish.indexOf('archiveArtifacts'));
  assert.match(publish, /else \{\s*archiveArtifacts/);
  const unsuccessful = source.slice(source.indexOf('    unsuccessful {'));
  assert.match(unsuccessful, /NO CURRENT RESULTS/);
  assert.match(unsuccessful, /Previous reports were not published/);
});

test('session rejection stays gating and no interactive renewal is enabled in CI', () => {
  assert.match(source, /catchError\(buildResult: 'FAILURE', stageResult: 'FAILURE'\)/);
  for (const market of ['cl', 'co', 'pe']) {
    assert.ok(source.includes(`call node scripts/verify-jenkins-storefront-auth.cjs ${market} || exit /b 20`));
  }
  assert.match(source, /CL_AUTH_AUTO_RENEW = '0'/);
});

test('an interrupted P1 run preserves only current raw evidence without publishing a stale completed report',()=>{
 const publish=section("if (env.PREQA2_PREFLIGHT_FAILED == '1') {\n          echo 'PREQA2 PREFLIGHT FAILURE: no Official", '\n    success {');
 const partial=publish.slice(publish.indexOf("} else if (env.OFFICIAL_P1_NO_RESULTS == '1') {"),publish.indexOf("} else {"));
 assert.match(partial,/archiveArtifacts artifacts: "\$\{env\.JENKINS_ARTIFACT_DIR\}\/playwright\/\*\*\/\*"/);
 assert.match(partial,/NO COMPLETED CURRENT REPORT/);
 assert.match(partial,/if \(env\.P1_ARTIFACTS_CURRENT == '1'\)/);
 assert.match(source,/env\.P1_ARTIFACTS_CURRENT = '0'/);
 const clean=section("stage('03 · Validate Request')", "stage('04");
 assert.ok(clean.indexOf("dir(expectedDir) { deleteDir() }")<clean.indexOf("env.P1_ARTIFACTS_CURRENT = '1'"));
 assert.doesNotMatch(partial,/publishHTML|allure\(|test-results\/\*\*|playwright\/\.auth/);
 assert.doesNotMatch(source,/No current TC result is available/,'Missing final JSON is not proof that no TC ran');
});
