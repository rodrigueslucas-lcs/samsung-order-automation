const path = require('node:path');
const { registerLeaseProcess } = require('../utils/authMarketLease.cjs');
try {
  const target = path.resolve(process.argv[2] || '');
  if (path.dirname(target) !== path.resolve('scripts') || !/^auth-(?:login|refresh|verify|package|publish-jenkins)(?:-[a-z]+)*\.cjs$/.test(path.basename(target))) throw new Error('Invalid leased auth child.');
  const leave = registerLeaseProcess();
  process.once('exit', leave);
  require(target);
} catch {
  console.error('[auth:lease] Child refused to run without a valid parent lease.');
  process.exitCode = 1;
}
