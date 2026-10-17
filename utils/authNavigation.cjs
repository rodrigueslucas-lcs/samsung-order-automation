function createAuthNavigation(market, {
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  warn = message => console.warn(message),
} = {}) {
  return async function gotoWithTransientRetry(page, url, options = {}) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await page.goto(url, options);
      } catch (error) {
        const transient = /net::ERR_ABORTED|frame was detached|ERR_NETWORK_CHANGED/i.test(
          String(error?.message || error)
        );
        if (!transient || attempt === 2 || page.isClosed()) throw error;
        const destination = new URL(url);
        warn(`[auth:login:${market}] transient navigation abort; retrying ${destination.origin}${destination.pathname} (${attempt + 1}/2)`);
        await pause(1000);
      }
    }
  };
}

module.exports = { createAuthNavigation };
