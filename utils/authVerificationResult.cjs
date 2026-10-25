function verificationExitCode(error, env = process.env) {
  if (env.AUTH_KEEPALIVE !== '1') return 1;
  if (['AUTH_SIGNED_OUT','AUTH_STATE_MISSING'].includes(error?.code)) return 20;
  if (['AUTH_STOREFRONT_UNAVAILABLE','AUTH_STOREFRONT_UNREACHABLE'].includes(error?.code)) return 21;
  if (error?.name === 'TimeoutError' || /net::ERR_|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message || ''))) return 21;
  return 22; // Unproven authentication is not proof of expiration.
}
module.exports = { verificationExitCode };
