const { getEppConfig } = require('../config/markets/epp');
const { loadEppSession, getPrimaryEppCredentials, persistVerifiedEppSession, acquireEppLease } = require('../utils/eppSession.cjs');
const { verifyEppSnapshot } = require('../utils/eppSessionVerification.cjs');

async function verify(market, environment = 'S2') {
  const config = getEppConfig(market, { ...process.env, ENVIRONMENT: environment, [`${String(market).toUpperCase()}_QST_ENVIRONMENT`]:environment });
  const lease = acquireEppLease(config);
  try {
    const state = loadEppSession(config);
    const { email } = getPrimaryEppCredentials(config);
    const verified = await verifyEppSnapshot(config, state, { expectedEmail: email });
    persistVerifiedEppSession(config, verified);
    console.log(`[auth:epp:verify] ${config.market} ${config.environment} READY · server identity, entitlement and logout proven; renewed state preserved`);
  } finally { lease.release(); }
}
if (require.main === module) verify(process.argv[2], process.argv[3]).catch(error => {
  const status = error.exitCode === 79 ? 'HUMAN_REQUIRED' : error.code === 'AUTH_BUSY' ? 'BUSY' : 'FAIL';
  console.error(`[auth:epp:verify] ${status} · ${error.eppReason || 'EPP_VERIFICATION_NOT_COMPLETED'} · no credentials or raw provider response printed`);
  process.exitCode = error.exitCode || 1;
});
module.exports = { verify };
