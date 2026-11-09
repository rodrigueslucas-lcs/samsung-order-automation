const fs = require('node:fs');
const path = require('node:path');

async function boundedRead(operation, timeout, code) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Object.assign(new Error(code),{code})),timeout);
  })]); } finally { clearTimeout(timer); }
}

// Capture the exact native browser after login, before verification. Holding
// this connection avoids reconnecting to a port reused by another browser.
async function captureAuthBrowser({ market, environment, slot }, {
  chromium = require('@playwright/test').chromium,
  profilesRoot = path.resolve('playwright/profiles'), readFile = fs.readFileSync,
  snapshotTimeoutMs=15000,disconnectTimeoutMs=5000,
} = {}) {
  if(![snapshotTimeoutMs,disconnectTimeoutMs].every(n=>Number.isFinite(n)&&n>0&&n<=60000))throw new Error('Invalid native browser operation deadline.');
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
    async hasAccountHandoff(){return browser.contexts()[0]?.pages().some(p=>{try{return new URL(p.url()).origin==='https://account.samsung.com';}catch{return false;}})===true;},
    async closeSecurityBlocked(persist){
      const page=browser.contexts()[0]?.pages().find(p=>{try{const u=new URL(p.url());return u.origin==='https://account.samsung.com'&&/^\/iam\/blocked(?:\/|$)/i.test(u.pathname);}catch{return false;}});
      if(!page)return false;
      if(typeof persist!=='function')throw Error('Security denial must be recorded before closing.');
      await persist();
      return require('./authAccountLogin.cjs').closeRejectedAccountWindow(page,{includeSecurityBlocked:true});
    },
    async closeRejected() {
      const pages=browser.contexts()[0]?.pages()||[];
      const page=pages.find(p=>{try{const u=new URL(p.url());return u.origin==='https://account.samsung.com'&&/^\/iam\/error(?:\/|$)/i.test(u.pathname);}catch{return false;}});
      if(!page)return false;
      const liveOther=pages.some(p=>{try{const u=new URL(p.url());return !(u.origin==='https://account.samsung.com'&&/^\/iam\/error(?:\/|$)/i.test(u.pathname))&&p.url()!=='about:blank'&&!(u.protocol==='https:'&&['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(u.hostname)&&u.pathname==='/getcookie.html');}catch{return true;}});
      const closed=await require('./authAccountLogin.cjs').closeRejectedAccountWindow(page);
      return closed&&!liveOther;
    },
    async readEppSnapshot(rootValue) {
      const root = new URL(rootValue);
      if (root.protocol !== 'https:' || !['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(root.hostname) || !/^\/(mx|pe|co|cl)\/multistore\//.test(root.pathname)) throw new Error('Snapshot must target a staging EPP programme.');
      const context = browser.contexts()[0];
      if (!context || context.pages().some(page => { try { return new URL(page.url()).hostname === 'account.samsung.com'; } catch { return false; } })) return null;
      const page = context.pages().find(page => page.url().startsWith(root.href));
      if (!page) return null;
        return boundedRead(async()=>{
          // Full storageState can visit unrelated origins retained by this
          // native profile. Read only the owned staging origin in place.
          return require('./eppSession.cjs').captureEppPageState(context,page,{rootUrl:root});
        },snapshotTimeoutMs,'EPP_NATIVE_SNAPSHOT_TIMEOUT');
    },
    async closeVerified() {
      if (!browser.isConnected()) return;
      const session = await browser.newBrowserCDPSession();
      try { await session.send('Browser.close'); }
      catch (error) { if (browser.isConnected()) throw error; }
    },
      async dispose() { await boundedRead(()=>browser.close(),disconnectTimeoutMs,'AUTH_BROWSER_DISCONNECT_TIMEOUT').catch(() => {}); },
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

// Read only the exact dedicated browser's target inventory. No CDP attachment,
// navigation, credentials, process control or browser-close operation.
async function authBrowserSecurityGate({market,environment,slot},{profilesRoot=path.resolve('playwright/profiles'),read=fs.readFileSync,request=fetch}={}) {
  if(!['mx','pe','co','cl'].includes(market)||!['S1','S2'].includes(environment)||!['primary','second'].includes(slot))throw Error('Invalid auth browser identity.');
  try{const state=JSON.parse(read(path.resolve('playwright/.auth',`.keepalive-${market}-${environment.toLowerCase()}.json`),'utf8'));if(state.securityBlocks?.[slot]?.reason==='SAMSUNG_ACCOUNT_SECURITY_BLOCKED')return{reason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};}catch{}
  try {
    const profile=environment.toLowerCase()+'-'+market+'-'+(slot==='second'?'second':'qa');
    const [port,browserPath]=read(path.join(profilesRoot,profile,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);
    if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535||!/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(browserPath||''))return null;
    const origin='http://127.0.0.1:'+port;
    const version=await request(origin+'/json/version',{redirect:'error',signal:AbortSignal.timeout(3000)});
    if(!version.ok)return null;
    const endpoint=new URL((await version.json()).webSocketDebuggerUrl);
    if(endpoint.protocol!=='ws:'||endpoint.hostname!=='127.0.0.1'||endpoint.port!==port||endpoint.pathname!==browserPath)return null;
    const response=await request(origin+'/json/list',{redirect:'error',signal:AbortSignal.timeout(3000)});
    if(!response.ok)return null;
    const targets=await response.json();if(!Array.isArray(targets))return null;
    if(targets.some(target=>{try{const u=new URL(target.url);return target.type==='page'&&u.origin==='https://account.samsung.com'&&/^\/iam\/blocked(?:\/|$)/i.test(u.pathname);}catch{return false;}}))return {reason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'};
  }catch{}
  return null;
}
module.exports.authBrowserSecurityGate=authBrowserSecurityGate;

function recordAuthSecurityBlock({market,environment,slot},{directory=path.resolve('playwright/.auth')}={}){if(!['mx','pe','co','cl'].includes(market)||!['S1','S2'].includes(environment)||!['primary','second'].includes(slot))throw Error('Invalid security-gate identity.');const file=path.join(directory,`.keepalive-${market}-${environment.toLowerCase()}.json`);let state={};try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}require('./atomicJson').writeJsonAtomically(file,{...state,securityBlocks:{...state.securityBlocks,[slot]:{reason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED',at:new Date().toISOString()}}});}
module.exports.recordAuthSecurityBlock=recordAuthSecurityBlock;
