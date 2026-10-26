const VERIFICATION_ISSUES = Object.freeze(['STOREFRONT_MAINTENANCE','STOREFRONT_UNAVAILABLE','NETWORK_ERROR','VERIFICATION_TIMEOUT','SIGNED_OUT','STATE_MISSING','AUTH_NOT_PROVEN','VERIFICATION_FAILED']);
function reportVerificationIssue(error, { env = process.env, log = console.log } = {}) {
  if (env.AUTH_KEEPALIVE !== '1') return;
  const reason = error?.code === 'AUTH_STOREFRONT_UNAVAILABLE' ? (error.reason === 'STOREFRONT_MAINTENANCE' ? 'STOREFRONT_MAINTENANCE' : 'STOREFRONT_UNAVAILABLE')
    : error?.code === 'AUTH_STOREFRONT_UNREACHABLE' ? 'NETWORK_ERROR'
    : error?.code === 'AUTH_SIGNED_OUT' ? 'SIGNED_OUT'
    : error?.code === 'AUTH_STATE_MISSING' ? 'STATE_MISSING'
    : error?.code === 'AUTH_NOT_PROVEN' ? 'AUTH_NOT_PROVEN'
    : error?.name === 'TimeoutError' ? 'VERIFICATION_TIMEOUT'
    : /net::ERR_|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message || '')) ? 'NETWORK_ERROR' : 'VERIFICATION_FAILED';
  log('AUTH_HEALTH_ISSUE ' + JSON.stringify({ reason }));
}
function verificationExitCode(error, env = process.env) {
  if (env.AUTH_KEEPALIVE !== '1') return 1;
  if (['AUTH_SIGNED_OUT','AUTH_STATE_MISSING'].includes(error?.code)) return 20;
  if (['AUTH_STOREFRONT_UNAVAILABLE','AUTH_STOREFRONT_UNREACHABLE'].includes(error?.code)) return 21;
  if (error?.name === 'TimeoutError' || /net::ERR_|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message || ''))) return 21;
  return 22; // Unproven authentication is not proof of expiration.
}
module.exports = { verificationExitCode, reportVerificationIssue, VERIFICATION_ISSUES };
