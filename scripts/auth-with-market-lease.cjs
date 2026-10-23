const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { acquireMarketLease } = require('../utils/authMarketLease.cjs');
async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(arg => { const match = /^--(market|environment|shell|file)=(.+)$/.exec(arg); if (!match) throw new Error('Invalid auth lease command.'); return [match[1], match[2]]; }));
  const market = String(options.market || '').toLowerCase(), environment = options.environment;
  if (!['cmd','sh'].includes(options.shell) || !options.file || !fs.existsSync(options.file)) throw new Error('Auth lease requires an existing command file and shell.');
  let release;
  const deadline = Date.now() + 900000;
  while (!release) {
    try { release = acquireMarketLease(market, environment); }
    catch (e) { if (e.code !== 'AUTH_BUSY' || Date.now() >= deadline) throw e; console.log('[auth:lease] Waiting for the auth maintenance operation to finish.'); await new Promise(r => setTimeout(r, 5000)); }
  }
  try {
    const executable = options.shell === 'cmd' ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
    const args = options.shell === 'cmd' ? ['/d','/s','/c', '""' + path.resolve(options.file) + '""'] : [options.file];
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(executable, args, { env: { ...process.env, ...release.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--require=' + JSON.stringify(path.resolve('utils/authLeasePreload.cjs'))].filter(Boolean).join(' ') }, stdio: 'inherit', windowsVerbatimArguments: options.shell === 'cmd' });
      const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM');
      process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
      const cleanup = () => { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); };
      child.once('error', () => { cleanup(); reject(new Error('Auth protected command could not start.')); });
      child.once('close', code => { cleanup(); resolve(code ?? 1); });
    });
  } finally { release(); fs.unlinkSync(options.file); }
}
if (require.main === module) main().catch(() => { console.error('[auth:lease] Protected command failed; no auth lease was bypassed.'); process.exitCode = 1; });
module.exports = { main };
