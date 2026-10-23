const path = require('node:path');
const { spawnSync } = require('node:child_process');

// These explicit targeted cases log in to BackOffice directly; their bodies
// do not open the storefront or use a Samsung Account session.
const backofficeOnly = Object.freeze({ PE: 'SAM-25103', CO: 'SAM-24920', CL: 'SAM-24830' });
function requiresStorefrontAuth(market, targets) {
  const ids = String(targets || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
  return !ids.length || !backofficeOnly[market] || ids.some(id => id !== backofficeOnly[market]);
}
function verify({ market, env = process.env, spawn = spawnSync, log = console.log }) {
  market = String(market || '').toUpperCase();
  if (!['PE', 'CO', 'CL'].includes(market)) throw new Error('Storefront verification requires an explicit PE, CO or CL market.');
  const targets = env[`${market}_QST_TARGET_IDS`] || env.P1_TARGET_IDS || '';
  if (!requiresStorefrontAuth(market, targets)) {
    log(`[jenkins-auth] ${market} BackOffice-only target: storefront session is not required. BackOffice login remains mandatory in the TC.`);
    return 0;
  }
  const result = spawn(process.execPath, [path.resolve(`scripts/auth-verify-${market.toLowerCase()}.cjs`)], { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
if (require.main === module) {
  try { process.exitCode = verify({ market: process.argv[2] }); }
  catch (error) { console.error(`[jenkins-auth] ${error.message}`); process.exitCode = 1; }
}
module.exports = { requiresStorefrontAuth, verify };
