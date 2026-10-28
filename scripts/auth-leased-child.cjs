const path = require('node:path');
const { registerLeaseProcess } = require('../utils/authMarketLease.cjs');
let target;
try {
  target = path.resolve(process.argv[2] || '');
  if (path.dirname(target) !== path.resolve('scripts') || !(path.basename(target)==='auth-epp-maintenance-child.cjs'||/^auth-(?:login|refresh|verify|package|publish-jenkins|resume-human)(?:-[a-z]+)*\.cjs$/.test(path.basename(target)))) throw new Error('Invalid leased auth child.');
  const leave = registerLeaseProcess();
  process.once('exit', leave);
} catch {
  target = null;
  console.error('[auth:lease] Child refused to run without a valid parent lease.');
  process.exitCode = 1;
}
if(target) {
  try { require(target); }
  catch { console.error('[auth:child] Startup failed: configuration or module error. The parent lease was not bypassed.');process.exitCode=1; }
}
