const { spawn } = require('node:child_process');

const SUPPORTED_MARKETS = Object.freeze(['mx', 'pe', 'co', 'cl']);

function normalizeEnvironment(value) {
  const environment = String(value || 'S2').trim().toUpperCase();
  if (!['S1', 'S2'].includes(environment)) {
    throw new Error(`Unsupported regional auth environment: ${environment}. Use S1 or S2.`);
  }
  return environment;
}

function normalizeMarkets(values) {
  const input = Array.isArray(values) ? values : String(values || '').split(/[\s,;]+/);
  const markets = input
    .flatMap((value) => String(value || '').split(/[\s,;]+/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const selected = markets.length ? markets : [...SUPPORTED_MARKETS];
  for (const market of selected) {
    if (!SUPPORTED_MARKETS.includes(market)) {
      throw new Error(`Unsupported regional auth market: ${market}. Use ${SUPPORTED_MARKETS.join(', ')}.`);
    }
  }
  return [...new Set(selected)];
}

function pipePrefixed(stream, market, sink) {
  if (!stream) return;
  let buffer = '';
  stream.setEncoding?.('utf8');
  stream.on('data', (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) sink(`[${market.toUpperCase()}] ${line}`);
  });
  stream.on('end', () => {
    if (buffer) sink(`[${market.toUpperCase()}] ${buffer}`);
  });
}

function runMarketRefresh(market, environment, baseEnv = process.env, {
  spawnChild = spawn,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const upper = market.toUpperCase();
  const script = `scripts/auth-refresh-${market}.cjs`;
  const env = {
    ...baseEnv,
    ENVIRONMENT: environment,
    [`${upper}_QST_ENVIRONMENT`]: environment,
    AUTH_REFRESH_ALL: '1',
  };

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawnChild(process.execPath, [script], {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    pipePrefixed(child.stdout, market, stdout);
    pipePrefixed(child.stderr, market, stderr);
    child.once('error', (error) => reject(new Error(`${upper} refresh could not start: ${error.message}`)));
    child.once('close', (code, signal) => {
      const elapsedMs = Date.now() - startedAt;
      resolve({
        market,
        environment,
        code: code ?? 1,
        signal: signal || null,
        elapsedMs,
        status: code === 0 ? 'READY' : code === 2 ? 'HUMAN_REQUIRED' : signal ? 'INTERRUPTED' : 'FAILED',
      });
    });
  });
}

async function refreshAll({ markets, environment, env = process.env } = {}, {
  runMarket = runMarketRefresh,
  log = console.log,
  error = console.error,
} = {}) {
  const selectedMarkets = normalizeMarkets(markets);
  const selectedEnvironment = normalizeEnvironment(environment || env.ENVIRONMENT || env.AUTH_REFRESH_ENVIRONMENT || 'S2');
  const startedAt = Date.now();

  log('============================================================');
  log(` SAMSUNG SMB · REGIONAL AUTH REFRESH · ${selectedEnvironment}`);
  log('============================================================');
  log(` Markets : ${selectedMarkets.map((market) => market.toUpperCase()).join(' · ')}`);
  log(' Mode    : parallel by market · sequential inside each market');
  log(' Safety  : dedicated profile + per-market lock + human CAPTCHA/MFA gate');
  log('============================================================');

  const settled = await Promise.all(selectedMarkets.map(async (market) => {
    log(`[${market.toUpperCase()}] START · ${selectedEnvironment}`);
    try {
      return await runMarket(market, selectedEnvironment, env, { stdout: log, stderr: error });
    } catch (failure) {
      return {
        market,
        environment: selectedEnvironment,
        code: 1,
        signal: null,
        elapsedMs: Date.now() - startedAt,
        status: 'FAILED',
        error: failure.message,
      };
    }
  }));

  log('');
  log('============================================================');
  log(` REGIONAL AUTH REFRESH SUMMARY · ${selectedEnvironment}`);
  log('============================================================');
  for (const result of settled) {
    const icon = result.status === 'READY' ? 'READY' : result.status === 'HUMAN_REQUIRED' ? 'HUMAN' : 'FAIL';
    const seconds = Math.max(0, Math.round(result.elapsedMs / 1000));
    log(` ${result.market.toUpperCase().padEnd(2)}  ${icon.padEnd(5)} · ${seconds}s${result.error ? ` · ${result.error}` : ''}`);
  }
  const ready = settled.filter((result) => result.status === 'READY').length;
  const human = settled.filter((result) => result.status === 'HUMAN_REQUIRED').length;
  const failed = settled.length - ready - human;
  log('------------------------------------------------------------');
  log(` READY ${ready}/${settled.length} · HUMAN ${human} · FAILED ${failed} · total ${Math.round((Date.now() - startedAt) / 1000)}s`);
  log('============================================================');

  return {
    environment: selectedEnvironment,
    markets: selectedMarkets,
    results: settled,
    ready,
    human,
    failed,
    ok: ready === settled.length,
  };
}

module.exports = {
  SUPPORTED_MARKETS,
  normalizeEnvironment,
  normalizeMarkets,
  pipePrefixed,
  refreshAll,
  runMarketRefresh,
};
