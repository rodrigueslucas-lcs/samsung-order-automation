const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'reporters', 'tests', 'fixtures', 'executive-v3', 'build-5-runtime-summary.json');
const runtime = path.join(root, 'test-results', 'jenkins', 'mx-qst', 'runtime-summary.json');
const outDir = path.join(root, 'test-results', 'executive-v3');
const output = path.join(outDir, 'index.html');
const history = path.join(outDir, 'history.json');
const ledger = path.join(root, 'test-mapping', 'preqa2-validation.json');

if (!fs.existsSync(fixture)) {
  console.error(`[reporting:mx:preview] Missing fixture: ${fixture}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(runtime), { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(fixture, runtime);

const generator = path.join(root, 'reporters', 'executive-v3', 'generateExecutiveV3.cjs');
const result = spawnSync(process.execPath, [generator, ledger, output, history, runtime], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(`[reporting:mx:preview] ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);

if (!fs.existsSync(output)) {
  console.error(`[reporting:mx:preview] Generator did not create ${output}`);
  process.exit(1);
}

const html = fs.readFileSync(output, 'utf8');
const expected = ['Official selected</small><b>30</b>', 'Executed</small><b>22</b>', 'PASS</small><b>14</b>', 'FAIL</small><b>8</b>', 'Blocked</small><b>8</b>', '<b>0</b> NOT RUN'];
const missing = expected.filter(token => !html.includes(token));
if (missing.length) {
  console.error(`[reporting:mx:preview] Generated dashboard failed runtime smoke check: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`[reporting:mx:preview] Build #5 fixture copied to ${path.relative(root, runtime)}`);
console.log(`[reporting:mx:preview] Dashboard generated: ${path.relative(root, output)}`);
console.log('[reporting:mx:preview] Runtime verified: 30 official | 22 executed | 14 PASS | 8 FAIL | 8 BLOCKED | 0 NOT_RUN');
console.log(`[reporting:mx:preview] Open in browser: file:///${output.replace(/\\\\/g, '/')}`);
