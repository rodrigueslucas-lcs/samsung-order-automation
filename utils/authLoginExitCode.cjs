// A lost local page may reconnect once through authRefreshRunner. Provider
// rejection, security gates, missing controls and network failures must not.
function authLoginExitCode(error) {
  if (error?.exitCode) return error.exitCode;
  return /Target page, context or browser has been closed|browser has been closed|Target closed|frame was detached/i.test(String(error?.message || '')) ? 75 : 1;
}
module.exports = { authLoginExitCode };
