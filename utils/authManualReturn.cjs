async function waitForManualStorefront(context, accountPage, { hostname, market, timeout,
  now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const initialPages = new Set(context.pages());
  const deadline = now() + timeout;
  while (now() < deadline) {
    if (context.browser?.()?.isConnected() === false) {
      const error = new Error('Dedicated browser disconnected during manual login.');
      error.exitCode = 75; throw error;
    }
    for (const candidate of context.pages()) {
      if (candidate.isClosed()) continue;
      // A pre-existing signed-out home must not end the human login wait.
      if (candidate !== accountPage && initialPages.has(candidate) && !accountPage.isClosed()) continue;
      let url;
      try { url = new URL(candidate.url()); } catch { continue; }
      if (url.protocol !== 'https:' || url.hostname !== hostname ||
          url.pathname.replace(/\/$/, '') !== `/${market}`) continue;
      // Do not bootstrap away from a callback or an unhydrated home.
      if (await candidate.getByRole('button', { name: 'My Profile', exact: true }).isVisible().catch(() => false)) return candidate;
    }
    await pause(250);
  }
  const error = new Error('Samsung Account manual login has not returned to a rendered storefront. Keep its window open and complete CAPTCHA/MFA.');
  error.exitCode = 79; throw error;
}
module.exports = { waitForManualStorefront };
