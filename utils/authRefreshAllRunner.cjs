const { spawn } = require('node:child_process');

const SUPPORTED_MARKETS = Object.freeze(['mx', 'pe', 'co', 'cl']);
const SLOT_MARKETS = Object.freeze({
  primary: Object.freeze(['mx', 'pe', 'co', 'cl']),
  second: Object.freeze(['mx', 'co']),
});

function normalizeEnvironment(value) {
  const environment = String(value || 'S2').trim().toUpperCase();
  if (!['S1', 'S2'].includes(environment)) {
    throw new Error(`Unsupported regional auth environment: ${environment}. Use S1 or S2.`);
  }
  return environment;
}

function normalizeSlot(value) {
  const slot = String(value || 'primary').trim().toLowerCase();
  if (!['primary', 'second'].includes(slot)) {
    throw new Error(`Unsupported regional auth slot: ${slot}. Use primary or second.`);
  }
  return slot;
}

function normalizeMarkets(values, slot = 'primary') {
  const selectedSlot = normalizeSlot(slot);
  const supported = SLOT_MARKETS[selectedSlot];
  const input = Array.isArray(values) ? values : String(values || '').split(/[\s,;]+/);
  const markets = input
    .flatMap((value) => String(value || '').split(/[\s,;]+/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const selected = markets.length ? markets : [...supported];
  for (const market of selected) {
    if (!SUPPORTED_MARKETS.includes(market)) {
      throw new Error(`Unsupported regional auth market: ${market}. Use ${SUPPORTED_MARKETS.join(', ')}.`);
    }
    if (!supported.includes(market)) {
      throw new Error(`${market.toUpperCase()} does not support regional ${selectedSlot} auth refresh. Supported: ${supported.map((item) => item.toUpperCase()).join(', ')}.`);
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

function runMarketRefresh(market, environment, slot = 'primary', baseEnv = process.env, {
  spawnChild = spawn,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const upper = market.toUpperCase();
  const selectedSlot = normalizeSlot(slot);
  const script = `scripts/auth-refresh-${market}.cjs`;
  const env = {
    ...baseEnv,
    ENVIRONMENT: environment,
    [`${upper}_QST_ENVIRONMENT`]: environment,
    [`${upper}_AUTH_SLOT`]: selectedSlot,
    AUTH_REFRESH_SLOT: selectedSlot,
    AUTH_REFRESH_ALL: '1',
  };
  // CO supports a legacy MX_AUTH_SLOT alias; a regional selection is explicit.
  if (market !== 'mx') delete env.MX_AUTH_SLOT;
  if (selectedSlot === 'second') env[`${upper}_AUTH_MANUAL`] = '1';

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawnChild(process.execPath, [script], {
      windowsHide: true,
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
        slot: selectedSlot,
        code: code ?? 1,
        signal: signal || null,
        elapsedMs,
        status: signal ? 'INTERRUPTED' : code === 0 ? 'READY' : code === 2 ? 'HUMAN_REQUIRED' : code === 3 ? 'BUSY' : 'FAILED',
      });
    });
  });
}

async function refreshAll({ markets, environment, slot, env = process.env } = {}, {
  runMarket = runMarketRefresh,
  log = console.log,
  error = console.error,
} = {}) {
  const selectedSlot = normalizeSlot(slot || env.AUTH_REFRESH_SLOT || 'primary');
  const selectedMarkets = normalizeMarkets(markets, selectedSlot);
  const selectedEnvironment = normalizeEnvironment(environment || env.ENVIRONMENT || env.AUTH_REFRESH_ENVIRONMENT || 'S2');
  const startedAt = Date.now();

  log('============================================================');
  log(` SAMSUNG SMB · REGIONAL AUTH REFRESH · ${selectedEnvironment} · ${selectedSlot.toUpperCase()}`);
  log('============================================================');
  log(` Markets : ${selectedMarkets.map((market) => market.toUpperCase()).join(' · ')}`);
  log(` Slot    : ${selectedSlot}`);
  log(' Mode    : parallel by market · sequential inside each market');
  log(' Safety  : dedicated profile + per-market lock + human CAPTCHA/MFA gate');
  log('============================================================');

  const settled = await Promise.all(selectedMarkets.map(async (market) => {
    log(`[${market.toUpperCase()}] START · ${selectedEnvironment} · ${selectedSlot}`);
    try {
      return await runMarket(market, selectedEnvironment, selectedSlot, env, { stdout: log, stderr: error });
    } catch (failure) {
      return {
        market,
        environment: selectedEnvironment,
        slot: selectedSlot,
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
  log(` REGIONAL AUTH REFRESH SUMMARY · ${selectedEnvironment} · ${selectedSlot.toUpperCase()}`);
  log('============================================================');
  for (const result of settled) {
    const icon = result.status === 'READY' ? 'READY' : result.status === 'HUMAN_REQUIRED' ? 'HUMAN' : result.status === 'BUSY' ? 'BUSY' : 'FAIL';
    const seconds = Math.max(0, Math.round(result.elapsedMs / 1000));
    log(` ${result.market.toUpperCase().padEnd(2)}  ${icon.padEnd(5)} · ${seconds}s${result.error ? ` · ${result.error}` : ''}`);
  }
  const ready = settled.filter((result) => result.status === 'READY').length;
  const human = settled.filter((result) => result.status === 'HUMAN_REQUIRED').length;
  const busy = settled.filter((result) => result.status === 'BUSY').length;
  const failed = settled.length - ready - human - busy;
  if(busy)log(' BUSY: another keep-alive, refresh or build owns these profiles. Do not start repeated refreshes; check the active auth operation/dashboard. BUSY alone does not prove an expired session.');
  log('------------------------------------------------------------');
  log(` READY ${ready}/${settled.length} · HUMAN ${human} · BUSY ${busy} · FAILED ${failed} · total ${Math.round((Date.now() - startedAt) / 1000)}s`);
  log('============================================================');

  return {
    environment: selectedEnvironment,
    slot: selectedSlot,
    markets: selectedMarkets,
    results: settled,
    ready,
    human,
    busy,
    failed,
    ok: ready === settled.length,
  };
}

module.exports = {
  SLOT_MARKETS,
  SUPPORTED_MARKETS,
  normalizeEnvironment,
  normalizeMarkets,
  normalizeSlot,
  pipePrefixed,
  refreshAll,
  runMarketRefresh,
};
