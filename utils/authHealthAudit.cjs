function observeAuthHealthContext(context, { env = process.env, log = console.log } = {}) {
  let statePersisted = false;
  const accountPages = new Set();
  const enabled = env.AUTH_KEEPALIVE === '1';
  const watch = page => {
    const inspect = frame => {
      try { if (frame === page.mainFrame() && new URL(frame.url()).hostname === 'account.samsung.com') accountPages.add(page); } catch {}
    };
    page.on('framenavigated', inspect);
    inspect(page.mainFrame());
  };
  if (enabled) { context.on('page', watch); for (const page of context.pages()) watch(page); }
  return {
    persisted() { statePersisted = true; },
    report() { if (enabled) log('AUTH_HEALTH_AUDIT ' + JSON.stringify({ accountPages: accountPages.size, statePersisted })); },
  };
}
module.exports = { observeAuthHealthContext };
