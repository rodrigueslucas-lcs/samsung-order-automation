const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { acquireRefreshLock } = require('./authRefreshRunner.cjs');
const { normalizeEnvironment } = require('./authRefreshAllRunner.cjs');

const MARKET_SLOTS = Object.freeze({
  mx: Object.freeze(['primary', 'second']),
  pe: Object.freeze(['primary']),
  co: Object.freeze(['primary', 'second']),
  cl: Object.freeze(['primary']),
});

const PACKAGE_SCRIPTS = Object.freeze({
  mx: 'scripts/auth-package-mx.cjs',
  pe: 'scripts/auth-package-pe.cjs',
  co: 'scripts/auth-package-co.cjs',
  cl: 'scripts/auth-package-cl.cjs',
});

const PUBLISH_SCRIPTS = Object.freeze({
  mx: 'scripts/auth-publish-jenkins.cjs',
  pe: 'scripts/auth-publish-jenkins-pe.cjs',
  co: 'scripts/auth-publish-jenkins-co.cjs',
  cl: 'scripts/auth-publish-jenkins-cl.cjs',
});

function sessionBundlePath(market, environment) {
  return path.resolve('playwright/.session-packages', `${market}-${environment.toLowerCase()}-session-bundle.json`);
}

function fileHash(file, { exists = fs.existsSync, read = fs.readFileSync } = {}) {
  if (!exists(file)) return null;
  return crypto.createHash('sha256').update(read(file)).digest('hex');
}

function identityEnv(market, environment, slot, baseEnv = process.env) {
  const upper = market.toUpperCase();
  const env = {
    ...baseEnv,
    ENVIRONMENT: environment,
    [`${upper}_QST_ENVIRONMENT`]: environment,
    [`${upper}_AUTH_SLOT`]: slot,
    AUTH_REFRESH_SLOT: slot,
    AUTH_KEEPALIVE: '1',
  };
  if (market !== 'mx') delete env.MX_AUTH_SLOT;
  if (slot === 'second') env[`${upper}_AUTH_MANUAL`] = '1';
  return env;
}

function runNodeScript(script, env, {
  spawnChild = spawn,
  timeoutMs = 240000,
  stdout = () => {},
  stderr = () => {},
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(process.execPath, [script], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout?.setEncoding?.('utf8');
    child.stderr?.setEncoding?.('utf8');
    child.stdout?.on('data', chunk => { out += String(chunk); stdout(String(chunk)); });
    child.stderr?.on('data', chunk => { err += String(chunk); stderr(String(chunk)); });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, signal: signal || null, timedOut, stdout: out, stderr: err });
    });
  });
}

async function verifyIdentity({ market, environment, slot, env = process.env, attempts = 2 }, {
  acquire = acquireRefreshLock,
  runScript = runNodeScript,
  log = console.log,
} = {}) {
  let release;
  try {
    release = acquire(market, environment, slot);
  } catch (error) {
    if (/already active/i.test(String(error.message || error))) {
      return { market, environment, slot, status: 'BUSY', attempts: 0, code: null };
    }
    throw error;
  }

  try {
    const script = `scripts/auth-verify-${market}.cjs`;
    const runtimeEnv = identityEnv(market, environment, slot, env);
    let last;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      log(`[keepalive:${market}] ${environment} ${slot} · verify ${attempt}/${attempts}`);
      last = await runScript(script, runtimeEnv, { timeoutMs: 240000 });
      if (last.code === 0) {
        return { market, environment, slot, status: 'HEALTHY', attempts: attempt, code: 0 };
      }
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 1500));
    }
    return {
      market,
      environment,
      slot,
      status: 'NEEDS_REFRESH',
      attempts,
      code: last?.code ?? 1,
      error: String(last?.stderr || last?.stdout || '').split(/\r?\n/).filter(Boolean).slice(-1)[0] || null,
    };
  } finally {
    release?.();
  }
}

async function recoverIdentity({ market, environment, slot, env = process.env }, {
  runScript = runNodeScript,
  log = console.log,
} = {}) {
  const runtimeEnv = identityEnv(market, environment, slot, {
    ...env,
    JENKINS_AUTH_PUBLISH: '0',
  });
  log(`[keepalive:${market}] ${environment} ${slot} · persistent verify failure; starting guarded refresh`);
  const result = await runScript(`scripts/auth-refresh-${market}.cjs`, runtimeEnv, { timeoutMs: 900000 });
  if (result.code === 0) return { market, environment, slot, status: 'RECOVERED', code: 0 };
  if (result.code === 2) return { market, environment, slot, status: 'HUMAN_REQUIRED', code: 2 };
  return {
    market,
    environment,
    slot,
    status: 'FAILED',
    code: result.code,
    error: String(result.stderr || result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-1)[0] || null,
  };
}

async function packageAndPublishMarket({ market, environment, publish, env = process.env }, {
  runScript = runNodeScript,
  hash = fileHash,
  log = console.log,
} = {}) {
  const bundle = sessionBundlePath(market, environment);
  const before = hash(bundle);
  const packageResult = await runScript(PACKAGE_SCRIPTS[market], {
    ...env,
    ENVIRONMENT: environment,
    [`${market.toUpperCase()}_QST_ENVIRONMENT`]: environment,
  }, { timeoutMs: 60000 });
  if (packageResult.code !== 0) {
    return { market, status: 'PACKAGE_FAILED', changed: false, published: false, code: packageResult.code };
  }

  const after = hash(bundle);
  const changed = before !== after;
  if (!publish || !changed) {
    log(`[keepalive:${market}] bundle ${changed ? 'changed' : 'unchanged'} · Jenkins publish ${publish ? 'not needed' : 'disabled'}`);
    return { market, status: 'READY', changed, published: false, code: 0 };
  }

  const publishResult = await runScript(PUBLISH_SCRIPTS[market], {
    ...env,
    ENVIRONMENT: environment,
    [`${market.toUpperCase()}_QST_ENVIRONMENT`]: environment,
    JENKINS_AUTH_PUBLISH: '1',
  }, { timeoutMs: 120000 });
  return {
    market,
    status: publishResult.code === 0 ? 'READY' : 'PUBLISH_FAILED',
    changed,
    published: publishResult.code === 0,
    code: publishResult.code,
  };
}

async function runKeepAliveCycle({ environment = 'S2', publish = true, env = process.env } = {}, {
  verify = verifyIdentity,
  recover = recoverIdentity,
  finalize = packageAndPublishMarket,
  log = console.log,
} = {}) {
  const targetEnvironment = normalizeEnvironment(environment);
  const identities = Object.entries(MARKET_SLOTS).flatMap(([market, slots]) =>
    slots.map(slot => ({ market, environment: targetEnvironment, slot }))
  );
  const startedAt = Date.now();

  log('============================================================');
  log(` SAMSUNG SMB · AUTH KEEP-ALIVE · ${targetEnvironment}`);
  log('============================================================');
  log(' Identities : MX PRIMARY/SECOND · PE PRIMARY · CO PRIMARY/SECOND · CL PRIMARY');
  log(' Strategy   : verify twice → guarded refresh only if persistently invalid');
  log(` Jenkins    : ${publish ? 'publish only when bundle hash changes' : 'disabled'}`);
  log('============================================================');

  const checks = await Promise.all(identities.map(identity => verify({ ...identity, env })));
  const byMarket = new Map(Object.keys(MARKET_SLOTS).map(market => [market, []]));
  for (const result of checks) byMarket.get(result.market).push(result);

  const recoveries = [];
  await Promise.all([...byMarket.entries()].map(async ([market, results]) => {
    for (const result of results.filter(item => item.status === 'NEEDS_REFRESH')) {
      const recovered = await recover({ market, environment: targetEnvironment, slot: result.slot, env });
      recoveries.push(recovered);
    }
  }));

  const finalStatus = new Map(checks.map(result => [`${result.market}:${result.slot}`, result]));
  for (const result of recoveries) finalStatus.set(`${result.market}:${result.slot}`, result);

  const finalized = [];
  await Promise.all(Object.keys(MARKET_SLOTS).map(async market => {
    const statuses = MARKET_SLOTS[market].map(slot => finalStatus.get(`${market}:${slot}`)?.status);
    if (statuses.some(status => ['BUSY', 'HUMAN_REQUIRED', 'FAILED', undefined].includes(status))) {
      finalized.push({ market, status: 'SKIPPED', changed: false, published: false, code: null });
      return;
    }
    finalized.push(await finalize({ market, environment: targetEnvironment, publish, env }));
  }));

  log('');
  log('============================================================');
  log(` AUTH KEEP-ALIVE SUMMARY · ${targetEnvironment}`);
  log('============================================================');
  for (const identity of identities) {
    const result = finalStatus.get(`${identity.market}:${identity.slot}`);
    log(` ${identity.market.toUpperCase()} ${identity.slot.padEnd(7)} ${String(result?.status || 'UNKNOWN').padEnd(14)}`);
  }
  for (const result of finalized.sort((a, b) => a.market.localeCompare(b.market))) {
    const suffix = result.status === 'READY'
      ? `bundle=${result.changed ? 'changed' : 'same'} · Jenkins=${result.published ? 'updated' : 'unchanged'}`
      : 'finalization skipped/failed';
    log(` ${result.market.toUpperCase()} FINAL      ${result.status.padEnd(14)} · ${suffix}`);
  }
  log(` total ${Math.round((Date.now() - startedAt) / 1000)}s`);
  log('============================================================');

  const blocking = [...finalStatus.values()].filter(result => ['HUMAN_REQUIRED', 'FAILED'].includes(result.status));
  const busy = [...finalStatus.values()].filter(result => result.status === 'BUSY');
  const finalizeFailures = finalized.filter(result => !['READY', 'SKIPPED'].includes(result.status));
  return {
    environment: targetEnvironment,
    identities: [...finalStatus.values()],
    finalized,
    blocking,
    busy,
    ok: blocking.length === 0 && finalizeFailures.length === 0,
  };
}

module.exports = {
  MARKET_SLOTS,
  PACKAGE_SCRIPTS,
  PUBLISH_SCRIPTS,
  fileHash,
  identityEnv,
  packageAndPublishMarket,
  recoverIdentity,
  runKeepAliveCycle,
  runNodeScript,
  sessionBundlePath,
  verifyIdentity,
};
