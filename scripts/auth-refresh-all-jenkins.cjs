const { spawnSync } = require('node:child_process');

const args = ['scripts/auth-refresh-all.cjs', '--publish', ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
