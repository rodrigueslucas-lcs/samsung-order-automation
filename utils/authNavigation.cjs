const cacheSessions = new WeakMap();

async function bypassStagingHttpCache(page, url) {
  const destination = new URL(url);
  if (destination.protocol !== 'https:' ||
      !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(destination.hostname)) return;
  if (!cacheSessions.has(page)) {
    const ready = (async () => {
      const session = await page.context().newCDPSession(page);
      await session.send('Network.enable');
      // Keep this page session attached until it closes: detaching can restore
      // cached reads while Angular is still importing its application chunks.
      await session.send('Network.setCacheDisabled', { cacheDisabled: true });
      return session;
    })();
    cacheSessions.set(page, ready);
    ready.catch(() => cacheSessions.delete(page));
  }
  await cacheSessions.get(page);
}

function createAuthNavigation(market, {
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  warn = message => console.warn(message),
  prepareNavigation = bypassStagingHttpCache,
} = {}) {
  return async function gotoWithTransientRetry(page, url, options = {}) {
    await prepareNavigation(page, url);
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

module.exports = { createAuthNavigation, bypassStagingHttpCache };
