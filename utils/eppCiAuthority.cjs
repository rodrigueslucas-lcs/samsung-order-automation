const path = require('node:path');

// CI uses an ephemeral workspace for credentials/results, but must coordinate
// with the operator's existing EPP lane and durable financial records.
function authorityRoot(env = process.env) {
  const value = env.EPP_CI_AUTHORITY_ROOT;
  if (!value) return null;
  if (env.CI !== '1' || env.ENVIRONMENT !== 'S2') throw new Error('EPP shared authority is restricted to S2 CI.');
  if (!path.isAbsolute(value) || /^[/\\]{2}/.test(value) || value.includes('\0')) throw new Error('EPP shared authority requires a local absolute path.');
  const root = path.resolve(value);
  if (path.basename(root).toLowerCase() !== 'epp' || path.basename(path.dirname(root)).toLowerCase() !== '.auth') throw new Error('EPP authority must be the dedicated .auth/epp root.');
  return root;
}
function financialDirectory(config, fallback, env = process.env) {
  const root = authorityRoot(env);
  if (!root) return fallback;
  if (!['MX','PE','CO','CL'].includes(config.market) || config.environment !== 'S2' || !['primary','second'].includes(config.authSlot || 'primary') || (config.authSlot === 'second' && !['MX','CO'].includes(config.market)) || (config.programNamespace && !/^[a-z][a-z0-9_]{1,60}$/.test(config.programNamespace))) throw new Error('Invalid EPP financial authority identity.');
  return path.join(root,'s2',config.market.toLowerCase(),...(config.programNamespace?['programs',config.programNamespace]:[]),...(config.authSlot === 'second'?['second']:[]));
}
module.exports = {authorityRoot,financialDirectory};
