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
  let browser;
  try { browser = await chromium.connectOverCDP(endpoint, { timeout: 5000 }); }
  catch(error) { if(error.code==='ECONNREFUSED'||/ECONNREFUSED/.test(String(error.message)))return null;throw error; }
  return {
    fingerprint: require('node:crypto').createHash('sha256').update(endpoint).digest('hex'),
    async readEppSnapshot(rootValue) {
      const root = new URL(rootValue);
      if (root.protocol !== 'https:' || !['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(root.hostname) || !/^\/(mx|pe|co|cl)\/multistore\//.test(root.pathname)) throw new Error('Snapshot must target a staging EPP programme.');
      const context = browser.contexts()[0];
      if (!context || context.pages().some(page => { try { return new URL(page.url()).hostname === 'account.samsung.com'; } catch { return false; } })) return null;
      const page = context.pages().find(page => page.url().startsWith(root.href));
      if (!page) return null;
      return { storageState: await context.storageState(), sessionStorage: await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage))) };
    },
    async closeVerified() {
      if (!browser.isConnected()) return;
      const session = await browser.newBrowserCDPSession();
      try { await session.send('Browser.close'); }
      catch (error) { if (browser.isConnected()) throw error; }
    },
    async dispose() { await browser.close().catch(() => {}); },
  };
}

function authBrowserClosed({market,environment,slot}, {platform=process.platform,profilesRoot=path.resolve('playwright/profiles'),run=require('node:child_process').execFileSync,canonical=fs.realpathSync.native,env=process.env}={}) {
  if(!['mx','pe','co','cl'].includes(market)||!['S1','S2'].includes(environment)||!['primary','second'].includes(slot))throw new Error('Invalid auth browser identity.');
  if(platform!=='win32')return false;
  try {
    const shell=path.join(env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    const raw=run(shell,['-NoProfile','-NonInteractive','-File',path.resolve(__dirname,'../scripts/auth-probe-browser.ps1')],{encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:131072});
    const snapshot=JSON.parse(raw);
    if(snapshot.known!==true||!Array.isArray(snapshot.profiles))return false;
    const folder=path.join(profilesRoot,`${environment.toLowerCase()}-${market}-${slot==='second'?'second':'qa'}`);
    const normalize=value=>canonical(value).toLowerCase();
    let target;try{target=normalize(folder);}catch(error){if(error.code!=='ENOENT')return false;target=path.resolve(folder).toLowerCase();}
    return snapshot.profiles.every(profile=>typeof profile==='string'&&normalize(profile)!==target);
  } catch {return false;}
}
module.exports = { captureAuthBrowser, authBrowserClosed };
