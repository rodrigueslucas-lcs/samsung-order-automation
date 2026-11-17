const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { hasNativeAuthWindow } = require('./authBrowserWindow.cjs');

async function connectAuthBrowser({ chromium, profileDir, market, environment, slot = 'primary' }, {
  hasWindow = hasNativeAuthWindow, log = console.log,
  launch = script => spawnSync(process.execPath, [script], { stdio: 'inherit', env: { ...process.env, SAMSUNG_AUTH_MANAGED: '1' } }),
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now,
  recoverEndpoint = require('./authBrowserEndpoint.cjs').recoverAuthBrowserEndpoint,
} = {}) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['S1', 'S2'].includes(environment) || !['primary', 'second'].includes(slot)) throw new Error('Dedicated auth browser requires an explicit staging identity.');
  const expected = `${environment.toLowerCase()}-${market}-${slot === 'second' ? 'second' : 'qa'}`;
  if (path.basename(path.resolve(profileDir)) !== expected) throw new Error('Dedicated auth profile does not match market/environment/account slot.');
  fs.mkdirSync(profileDir, { recursive: true });
  const portFile = path.resolve(profileDir, 'DevToolsActivePort');
  const readEndpoint = () => {
    try {
      const [value, browserPath] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
      const port = Number(value);
      // A reboot can reuse a port for another market/profile. The browser's
      // unique WS path must match too; HTTP discovery would attach to whoever
      // currently owns that port before the OS ownership recovery can run.
      return Number.isInteger(port) && port > 0 && port < 65536 && /^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(browserPath || '')
        ? `ws://127.0.0.1:${port}${browserPath}` : null;
    }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const connect = async endpoint => chromium.connectOverCDP(endpoint, { timeout: 5000 }).catch(() => null);
  log(`[auth:login:${market}] connecting to dedicated ${environment} ${slot} Chrome`);
  const endpoint = readEndpoint();
  let existing = endpoint ? await connect(endpoint) : null;
  const accessible = async browser => {
    try { return await hasWindow(browser); }
    catch (error) {
      if (!/Target page, context or browser has been closed|Browser has been closed|browser.*disconnected/i.test(String(error.message))) throw error;
      await browser.close?.().catch(() => {});
      if (browser === existing) existing = null;
      return false;
    }
  };
  if (existing && await accessible(existing)) return existing;
  if (!existing) {
    const recovered = await recoverEndpoint(profileDir);
    // Only a positive OS proof that this exact profile has no process allows
    // clearing an old pointer before Chrome starts. A CDP timeout alone cannot.
    if (recovered.absent === true) fs.rmSync(portFile, { force: true });
    if (recovered.occupied) {
      existing = await chromium.connectOverCDP(recovered.endpoint, { timeout: 5000 });
      if (await accessible(existing)) return existing;
      // A verified background-only Chrome may still need one native window,
      // using the same existing handle and the normal bounded launch below.
    }
  }
  // A live verified background browser may need one native window. Unknown
  // ownership fails above, so retries cannot accumulate windows in that profile.
  log(`[auth:login:${market}] opening its maximized Chrome window`);
  const result = launch(path.resolve(`scripts/auth-open-profile-${market}.cjs`));
  if (result.status !== 0) throw new Error(`Dedicated ${market.toUpperCase()} Chrome launcher failed.`);
  const deadline = now() + 30000;
  while (now() < deadline) {
    if (existing && await accessible(existing)) return existing;
    if (!existing) {
      const next = readEndpoint();
      const browser = next ? await connect(next) : null;
      if (browser && await accessible(browser)) return browser;
      await browser?.close().catch(() => {});
    }
    await pause(250);
  }
  await existing?.close().catch(() => {});
  const error = new Error(`Dedicated ${market.toUpperCase()} ${environment} ${slot} profile has no accessible Chrome window/CDP port. An existing non-debug Chrome may occupy it; no Chrome process or session was deleted.`);
  error.exitCode = 73; throw error;
}
module.exports = { connectAuthBrowser };
