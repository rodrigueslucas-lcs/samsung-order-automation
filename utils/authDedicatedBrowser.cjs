const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { hasNativeAuthWindow } = require('./authBrowserWindow.cjs');

async function connectAuthBrowser({ chromium, profileDir, market, environment, slot = 'primary' }, {
  hasWindow = hasNativeAuthWindow, log = console.log,
  launch = script => spawnSync(process.execPath, [script], { stdio: 'inherit' }),
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now,
} = {}) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['S1', 'S2'].includes(environment) || !['primary', 'second'].includes(slot)) throw new Error('Dedicated auth browser requires an explicit staging identity.');
  const expected = `${environment.toLowerCase()}-${market}-${slot === 'second' ? 'second' : 'qa'}`;
  if (path.basename(path.resolve(profileDir)) !== expected) throw new Error('Dedicated auth profile does not match market/environment/account slot.');
  fs.mkdirSync(profileDir, { recursive: true });
  const portFile = path.resolve(profileDir, 'DevToolsActivePort');
  const readPort = () => {
    try { const port = Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]); return Number.isInteger(port) && port > 0 && port < 65536 ? port : null; }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const connect = async port => chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 5000 }).catch(() => null);
  log(`[auth:login:${market}] connecting to dedicated ${environment} ${slot} Chrome`);
  const port = readPort();
  const existing = port ? await connect(port) : null;
  if (existing && await hasWindow(existing)) return existing;
  // A CDP timeout does not prove the browser is dead. Keep its endpoint so a
  // temporarily busy Chrome remains reconnectable; a new Chrome replaces it.
  log(`[auth:login:${market}] opening its maximized Chrome window`);
  const result = launch(path.resolve(`scripts/auth-open-profile-${market}.cjs`));
  if (result.status !== 0) throw new Error(`Dedicated ${market.toUpperCase()} Chrome launcher failed.`);
  const deadline = now() + 30000;
  while (now() < deadline) {
    if (existing && await hasWindow(existing)) return existing;
    if (!existing) {
      const next = readPort();
      const browser = next ? await connect(next) : null;
      if (browser && await hasWindow(browser)) return browser;
      await browser?.close().catch(() => {});
    }
    await pause(250);
  }
  await existing?.close().catch(() => {});
  const error = new Error(`Dedicated ${market.toUpperCase()} ${environment} ${slot} profile has no accessible Chrome window/CDP port. An existing non-debug Chrome may occupy it; no Chrome process or session was deleted.`);
  error.exitCode = 73; throw error;
}
module.exports = { connectAuthBrowser };
