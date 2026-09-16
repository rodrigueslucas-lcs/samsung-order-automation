const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures', 'executive-v3', 'build-5-runtime-summary.json');
const runtime = path.join(root, 'test-results', 'jenkins', 'mx-qst', 'runtime-summary.json');
const outDir = path.join(root, 'test-results', 'executive-v3');

if (!fs.existsSync(fixture)) {
  console.error(`[reporting:mx:preview] Missing fixture: ${fixture}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(runtime), { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(fixture, runtime);

const result = spawnSync(process.execPath, [path.join(root, 'reporters', 'executive-v3', 'generateExecutiveV3.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    EXECUTIVE_V3_OUTPUT_DIR: outDir,
    MX_QST_RUNTIME_SUMMARY: runtime,
  },
});

if (result.error) {
  console.error(`[reporting:mx:preview] ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);

const index = path.join(outDir, 'index.html');
if (!fs.existsSync(index)) {
  console.error(`[reporting:mx:preview] Generator did not create ${index}`);
  process.exit(1);
}

console.log(`[reporting:mx:preview] Build #5 fixture copied to ${path.relative(root, runtime)}`);
console.log(`[reporting:mx:preview] Dashboard generated: ${path.relative(root, index)}`);
console.log('[reporting:mx:preview] Expected runtime: 30 official | 22 executed | 14 PASS | 8 FAIL | 8 BLOCKED | 0 NOT_RUN');
