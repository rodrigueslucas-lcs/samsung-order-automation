const fs = require('node:fs');
const path = require('node:path');

// Capture the exact native browser after login, before verification. Holding
// this connection avoids reconnecting to a port reused by another browser.
async function captureAuthBrowser({ market, environment, slot }, {
  chromium = require('@playwright/test').chromium,
  profilesRoot = path.resolve('playwright/profiles'), readFile = fs.readFileSync,
} = {}) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['S1', 'S2'].includes(environment) || !['primary', 'second'].includes(slot)) throw new Error('Invalid auth browser identity.');
  const profile = `${environment.toLowerCase()}-${market}-${slot === 'second' ? 'second' : 'qa'}`;
  let endpoint;
  try {
    const [port, browserPath] = readFile(path.join(profilesRoot, profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || !/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(browserPath || '')) throw new Error('Invalid dedicated Chrome endpoint.');
    endpoint = `ws://127.0.0.1:${port}${browserPath}`;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 5000 });
  return {
    async closeVerified() {
      if (!browser.isConnected()) return;
      const session = await browser.newBrowserCDPSession();
      try { await session.send('Browser.close'); }
      catch (error) { if (browser.isConnected()) throw error; }
    },
    async dispose() { await browser.close().catch(() => {}); },
  };
}

module.exports = { captureAuthBrowser };
