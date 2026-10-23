const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function acquireRefreshLock(market, environment, slot, directory = path.resolve('playwright/.auth')) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['S1', 'S2'].includes(environment) || !['primary', 'second'].includes(slot)) throw new Error('Invalid refresh lock identity.');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `.refresh-${market}-${environment.toLowerCase()}-${slot}.lock`);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const descriptor = fs.openSync(file, 'wx', 0o600);
      const owner = JSON.stringify({ pid: process.pid, started: Date.now() });
      fs.writeFileSync(descriptor, owner);
      fs.closeSync(descriptor);
      return () => { if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === owner) fs.rmSync(file, { force: true }); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
      let alive = true;
      if (Number.isInteger(owner?.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
      }
      if (alive || attempt) throw new Error(`${market.toUpperCase()} ${environment} ${slot} refresh is already active. Keep the existing command/window; a second refresh cannot share this profile.`);
      fs.rmSync(file, { force: true });
    }
  }
}

function runAuthChild(script, env, { label, log, timeoutMs, heartbeatMs = 15000, interactive = false }) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const args = env.AUTH_MARKET_LEASE ? ['scripts/auth-leased-child.cjs', script] : [script];
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
    const heartbeat = setInterval(() => log(`${label} active (${Math.round((Date.now() - started) / 1000)}s). ${interactive ? 'Keep its Chrome open; complete any requested login/CAPTCHA/MFA there.' : 'Waiting for this phase; no interactive login is started here.'}`), heartbeatMs);
    let timedOut = false;
    let cancelled;
    const deadline = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    const stop = signal => child.kill(signal);
    const interrupted = () => { cancelled = 'SIGINT'; stop('SIGINT'); };
    const terminated = () => { cancelled = 'SIGTERM'; stop('SIGTERM'); };
    process.once('SIGINT', interrupted);
    process.once('SIGTERM', terminated);
    const cleanup = () => {
      clearInterval(heartbeat); clearTimeout(deadline);
      process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', terminated);
    };
    child.once('error', () => { cleanup(); reject(new Error(`${label} could not start its Node process.`)); });
    child.once('close', (code, signal) => {
      cleanup();
      if (timedOut) reject(new Error(`${label} exceeded its bounded wait. Chrome was left for inspection; no further login was submitted.`));
      else if (cancelled || signal) reject(new Error(`${label} interrupted (${cancelled || signal}); no automatic login restart.`));
      else resolve(code ?? 1);
    });
  });
}

async function refreshAuth({ market, environment, slot = 'primary', env, publishScript }, {
  runChild = runAuthChild, acquire = acquireRefreshLock, log = console.log,
  captureBrowser = require('./authBrowserLifecycle.cjs').captureAuthBrowser,
  acquireMarket = require('./authMarketLease.cjs').acquireMarketLease,
} = {}) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['S1', 'S2'].includes(environment) || !['primary', 'second'].includes(slot)) {
    throw new Error('Refresh requires a supported market, S1/S2 environment and primary/second slot.');
  }
  const prefix = `[auth:refresh:${market}]`;
  const report = text => log(`${prefix} ${text}`);
  const releaseMarket = acquireMarket(market, environment, { env });
  let release;
  let ownedBrowser;
  try {
    env = { ...env, ...releaseMarket.env };
    release = acquire(market, environment, slot);
    const interactiveMs = Number(env[`${market.toUpperCase()}_AUTH_INTERACTIVE_TIMEOUT_MS`] || 600000);
    if (!Number.isFinite(interactiveMs) || interactiveMs < 1000) throw new Error('Auth interactive timeout must be at least 1000ms.');
    const manual = env[`${market.toUpperCase()}_AUTH_MANUAL`] === '1';
    const stages = [
      ['login', `scripts/auth-login-${market}.cjs`, interactiveMs + 180000],
      ['verify', `scripts/auth-verify-${market}.cjs`, 240000],
      ['package', `scripts/auth-package-${market}.cjs`, 60000],
    ];
    if (env.JENKINS_AUTH_PUBLISH === '1' && publishScript) stages.push(['publish', publishScript, 120000]);
    for (const [phase, script, timeoutMs] of stages) {
      const label = `${market.toUpperCase()} ${environment} ${slot} · ${phase}`;
      report(label);
      const phaseEnv = phase === 'verify' ? { ...env, [`${market.toUpperCase()}_AUTH_AUTO_RENEW`]: '0' } : env;
      let status = await runChild(script, phaseEnv, { label, log: report, timeoutMs, interactive: phase === 'login' });
      // Only a classified lost browser/page may restart, once. Invalid sessions,
      // DNS/configuration failures and human verification never restart login.
      if (phase === 'login' && status === 75 && !manual) {
        report('Browser/page was lost; reconnecting once to the same dedicated profile.');
        status = await runChild(script, env, { label, log: report, timeoutMs, interactive: true });
      }
      if (status !== 0) {
        if (status === 79) {
          const error = new Error(`${label}: Samsung Account requires human CAPTCHA/MFA. No credentials were retried and no READY was emitted.`);
          error.code = 'AUTH_HUMAN_REQUIRED'; throw error;
        }
        if (status === 73) throw new Error(`${label}: auth profile is occupied; stop the conflicting refresh before retrying.`);
        if (status === 78) throw new Error(`${label}: prerequisite failed; inspect the configuration/SSO or verification message above.`);
        throw new Error(`${label} failed (exit ${status}). No blind login retry; inspect the visible browser and the specific message above.`);
      }
      report(`${phase} complete`);
      if (phase === 'login' && !(market === 'co' && env.CO_STOREFRONT_URL && new URL(env.CO_STOREFRONT_URL).hostname === 'p6-pre-qa2.samsung.com')) {
        ownedBrowser = await captureBrowser({ market, environment, slot });
      }
    }
    if (ownedBrowser) {
      await ownedBrowser.closeVerified();
      report('Verified dedicated Chrome closed.');
    }
    report(`READY · ${market.toUpperCase()} ${environment} ${slot} authenticated session refreshed, verified and packaged.`);
    report('CAPTCHA/MFA remains a human security gate when Samsung Account requests it.');
  } finally { try { await ownedBrowser?.dispose(); } finally { try { release?.(); } finally { releaseMarket(); } } }
}

module.exports = { refreshAuth, runAuthChild, acquireRefreshLock };
