const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sanitizeString } = require('../reporters/evidence/sanitizer');

const artifactDir = path.resolve(process.env.MX_JENKINS_ARTIFACT_DIR || process.env.MX_QST_ARTIFACT_DIR || 'test-results/jenkins/mx-suite');
const jsonFile = path.resolve(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || path.join(artifactDir, 'results.json'));
const executiveDir = path.join(artifactDir, 'executive');
const allureResultsDir = path.resolve(process.env.ALLURE_RESULTS_DIR || path.join(artifactDir, 'allure-results'));
const allureReportDir = path.join(artifactDir, 'allure-report');
const environment = String(process.env.MX_QST_ENVIRONMENT || 'S1').toUpperCase();
const suite = process.env.TEST_SUITE || 'MX SUITE';
const store = process.env.TEST_STORE || 'BASE_STORE';
const buildNumber = process.env.BUILD_NUMBER || 'LOCAL';
const gitCommit = process.env.GIT_COMMIT || 'unknown';

function esc(value) {
  return sanitizeString(String(value ?? ''))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function collectTests(report) {
  const tests = [];
  const visit = (node) => {
    for (const spec of node.specs || []) {
      const results = (spec.tests || []).flatMap((entry) => entry.results || []);
      const statuses = results.map((result) => result.status);
      const errors = results.flatMap((result) => result.errors || []).map((error) => error.message).filter(Boolean);
      const failed = statuses.some((status) => ['failed', 'timedOut', 'interrupted'].includes(status));
      const skipped = statuses.length > 0 && statuses.every((status) => status === 'skipped');
      const status = failed ? 'FAIL' : skipped ? 'BLOCKED' : statuses.length ? 'PASS' : 'NOT_RUN';
      tests.push({
        id: spec.title.match(/SAM-\d+/)?.[0] || '—',
        title: spec.title,
        file: spec.file || '',
        status,
        duration: results.reduce((sum, result) => sum + (result.duration || 0), 0),
        error: errors[0] || '',
      });
    }
    for (const child of node.suites || []) visit(child);
  };
  for (const root of report.suites || []) visit(root);
  return tests;
}

function writeExecutive(tests) {
  fs.mkdirSync(executiveDir, { recursive: true });
  const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].map((status) => [status, tests.filter((test) => test.status === status).length]));
  const executed = counts.PASS + counts.FAIL;
  const passRate = executed ? (counts.PASS / executed * 100).toFixed(1) : '0.0';
  const duration = tests.reduce((sum, test) => sum + test.duration, 0);
  const rows = tests.map((test) => `
      <tr>
        <td class="mono">${esc(test.id)}</td>
        <td>${esc(test.title)}</td>
        <td>${esc(test.file)}</td>
        <td><span class="pill ${test.status.toLowerCase()}">${esc(test.status)}</span></td>
        <td>${(test.duration / 1000).toFixed(1)}s</td>
      </tr>`).join('');
  const attention = tests.filter((test) => ['FAIL', 'BLOCKED'].includes(test.status)).map((test) => `
      <div class="attention-item"><strong>${esc(test.id)}</strong><span>${esc(test.title)}</span><small>${esc(test.error || test.status)}</small></div>`).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Samsung MX ${esc(environment)} ${esc(suite)} · Executive Dashboard</title>
<style>
:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#151515;background:#f5f7fb}*{box-sizing:border-box}body{margin:0}.hero{background:#101828;color:white;padding:28px 34px}.hero h1{margin:0;font-size:26px}.hero p{margin:8px 0 0;color:#cdd5df}.wrap{max-width:1280px;margin:auto;padding:24px}.cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.card{background:white;border:1px solid #e4e7ec;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(16,24,40,.04)}.card b{display:block;font-size:28px;margin-top:8px}.label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#667085}.meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;color:#475467;font-size:13px}.section{margin-top:24px}.section h2{font-size:18px;margin:0 0 12px}.attention{display:grid;gap:10px}.attention-item{background:white;border-left:4px solid #d92d20;border-radius:10px;padding:12px 14px;display:grid;grid-template-columns:120px 1fr;gap:4px 12px}.attention-item small{grid-column:2;color:#667085}.ok{background:white;border:1px solid #e4e7ec;border-radius:12px;padding:16px;color:#027a48}table{width:100%;border-collapse:separate;border-spacing:0;background:white;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid #eef2f6;font-size:13px}th{background:#f9fafb;color:#475467}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.pill{display:inline-block;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700}.pass{background:#ecfdf3;color:#027a48}.fail{background:#fef3f2;color:#b42318}.blocked{background:#fff7ed;color:#c4320a}.not_run{background:#f2f4f7;color:#475467}@media(max-width:900px){.cards{grid-template-columns:repeat(2,1fr)}.wrap{padding:16px}}
</style></head><body>
<div class="hero"><h1>Samsung SMB · Quality Engineering</h1><p>MX ${esc(environment)} · ${esc(suite)} · ${esc(store)}</p></div>
<div class="wrap">
  <div class="cards">
    <div class="card"><span class="label">Pass rate</span><b>${passRate}%</b></div>
    <div class="card"><span class="label">Passed</span><b>${counts.PASS}</b></div>
    <div class="card"><span class="label">Failed</span><b>${counts.FAIL}</b></div>
    <div class="card"><span class="label">Blocked</span><b>${counts.BLOCKED}</b></div>
    <div class="card"><span class="label">Duration</span><b>${(duration / 60000).toFixed(1)}m</b></div>
  </div>
  <div class="meta"><span>Build #${esc(buildNumber)}</span><span>Commit ${esc(gitCommit.slice(0, 8))}</span><span>${tests.length} test(s)</span></div>
  <div class="section"><h2>Needs Attention</h2>${attention ? `<div class="attention">${attention}</div>` : '<div class="ok">No failures or blockers in this execution.</div>'}</div>
  <div class="section"><h2>Test Execution</h2><table><thead><tr><th>TC</th><th>Scenario</th><th>File</th><th>Status</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table></div>
</div></body></html>`;
  fs.writeFileSync(path.join(executiveDir, 'index.html'), html);
  fs.writeFileSync(path.join(artifactDir, 'runtime-summary.json'), JSON.stringify({ environment, suite, store, buildNumber, gitCommit, counts, passRate: Number(passRate), duration, tests }, null, 2));
}

function writeAllureEnvironment() {
  if (!fs.existsSync(allureResultsDir)) return;
  const content = [
    `Market=MX`,
    `Environment=${environment}`,
    `Suite=${suite}`,
    `Store=${store}`,
    `Build=${buildNumber}`,
    `GitCommit=${gitCommit}`,
  ].join('\n');
  fs.writeFileSync(path.join(allureResultsDir, 'environment.properties'), `${content}\n`);
}

function generateAllure() {
  if (!fs.existsSync(allureResultsDir)) return;
  const allureCli = process.platform === 'win32'
    ? path.resolve('node_modules/.bin/allure.cmd')
    : path.resolve('node_modules/.bin/allure');
  if (!fs.existsSync(allureCli)) return;
  const result = spawnSync(allureCli, ['generate', allureResultsDir, '--clean', '-o', allureReportDir], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) console.error('[reporting] Allure HTML generation failed; raw results were preserved.');
}

fs.mkdirSync(artifactDir, { recursive: true });
if (fs.existsSync(jsonFile)) {
  const report = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  writeExecutive(collectTests(report));
} else {
  console.error(`[reporting] Playwright JSON not found: ${jsonFile}`);
}
writeAllureEnvironment();
generateAllure();
