const { spawnSync } = require('node:child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const checks = [
  ['Repository architecture', ['run', 'repo:architecture:validate']],
  ['Legacy consumer audit', ['run', 'repo:legacy:audit:strict']],
  ['PE generation audit', ['run', 'repo:pe:audit']],
  ['Official SMB scope gate', ['run', 'qst:official:gate']],
  ['MX S2 official P1 discovery', ['run', 'qst:mx:list'], { MX_QST_ENVIRONMENT: 'S2' }],
  ['Governance integrity', ['run', 'preqa2:validation:test']],
  ['Executive V2 reporting integrity', ['run', 'reporting:executive:test']],
  ['MX runtime/reporting integrity', ['run', 'reporting:mx-runtime:test']],
];

for (const [label, args, extraEnv = {}] of checks) {
  console.log(`\n[refactor-static-gate] ${label}`);
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`[refactor-static-gate] ${label}: unable to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[refactor-static-gate] ${label}: FAIL (${result.status})`);
    process.exit(result.status || 1);
  }
  console.log(`[refactor-static-gate] ${label}: PASS`);
}

console.log('\n[refactor-static-gate] PASS - repository is ready for the canonical-path Jenkins runtime acceptance gate.');
