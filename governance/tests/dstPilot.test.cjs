const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const { registry, selectPilot, validateSources, isFinancialSubmission } = require('../../utils/dstPilot.cjs');
const { loadOfficialInventory } = require('../../utils/officialSmbInventory');
const { plan } = require('../../scripts/run-dst-pilot.cjs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

test('seven pilot identities resolve to the exact current DST source rows, preserving definition gaps', () => {
  const inventory = loadOfficialInventory();
  assert.equal(registry.cases.length, 7);
  assert.equal(new Set(registry.cases.map(c => c.id)).size, 7);
  for (const entry of registry.cases) {
    const row = inventory.markets[entry.market].contexts[entry.store].rows.find(r => r.sourceRowKey === entry.sourceRowKey);
    assert.equal(row.officialId, entry.id);
    assert.equal(row.scenario, entry.scenario);
    assert.equal(row.dstIncluded, true);
    assert.equal(entry.definitionStatus, 'SCENARIO_ONLY');
    assert.equal(entry.formalHomologation, 'PENDING_OFFICIAL_DEFINITION');
    assert.deepEqual(entry.missingOfficialFields, ['preconditions', 'steps', 'expectedResults']);
    const source = fs.readFileSync(entry.spec, 'utf8');
    assert.equal(source.split(`test('${entry.id} `).length + source.split(`test("${entry.id} `).length - 2, 1);
  }
  validateSources();
  validateSources(file => Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n')));
  assert.throws(() => validateSources(() => Buffer.from('changed source')), /DST_SOURCE_CHANGED/);
  assert.equal(registry.cases.find(c => c.id === 'SAM-25064').authRequired, true);
});

test('pilot selection fails closed for full campaigns, wrong markets, unsupported IDs and BC on S1', () => {
  for (const options of [
    { market: 'MX' }, { market: 'CO', ids: 'SAM-24969' },
    { market: 'MX', ids: 'SAM-25065' }, { market: 'MX', ids: 'SAM-25045' },
    { market: 'MX', ids: 'SAM-24969', environment: 'S1' },
    { market: 'PE', ids: 'SAM-25081', environment: 'PROD' },
  ]) assert.throws(() => selectPilot(options), /DST_PILOT/);
  assert.deepEqual(selectPilot({ market: 'MX', ids: 'SAM-24988,SAM-24988' }).map(c => c.id), ['SAM-24988']);
});

test('runner isolates artifacts, selects only pilot owners, prevents retries and disables financial/auth renewal gates', () => {
  const run = plan(['PE', '--list'], { DST_TARGET_IDS: 'SAM-25065,SAM-25081', ALLOW_PAYMENT_SUBMIT: '1', CI: 'true' });
  assert.equal(run.list, true);
  assert.equal(run.childEnv.TEST_SUITE, 'DST');
  assert.equal(run.childEnv.PE_QST_ENVIRONMENT, 'S2');
  assert.equal(run.childEnv.ALLOW_PAYMENT_SUBMIT, '0');
  assert.equal(run.childEnv.PE_AUTH_AUTO_RENEW, '0');
  assert.ok(run.command.includes('--retries=0'));
  assert.ok(run.command.includes('--list'));
  assert.ok(run.cases.every(c => c.spec.includes('/dst/')));
  assert.match(run.artifact, /dst-pilot/);
  assert.throws(() => plan(['PE', '--grep=.*'], { DST_TARGET_IDS: 'SAM-25081' }), /Use dst:pilot/);
});

test('financial request guard blocks order/payment mutations while permitting readback and checkout setup', () => {
  const origin = 'https://s2-smb-api-cdn.ecom-stg.samsung.com';
  for (const pathname of ['/v2/mx/users/current/orders', '/mx/placeOrder', '/mx/mercadoCc', '/v2/pe/payments/authorize']) {
    assert.equal(isFinancialSubmission('POST', origin + pathname), true);
    assert.equal(isFinancialSubmission('GET', origin + pathname), false);
  }
  for (const pathname of ['/v2/pe/users/current/carts/current/entries', '/checkout/updateContact', '/getPaymentModes']) {
    assert.equal(isFinancialSubmission('POST', origin + pathname), false);
  }
});

test('pilot captures fixed-name legacy screenshots inside its own execution artifacts', () => {
  const { pilotScreenshotOptions } = require('../../flows/smb/dstPilotSafety');
  const info = { outputPath: (...parts) => path.join('/isolated-run', ...parts) };
  const redirected = pilotScreenshotOptions({ path: 'evidence/screenshots/cart.png', fullPage: true }, info);
  assert.equal(redirected.path, path.join('/isolated-run', 'business-screenshots', 'cart.png'));
  assert.equal(redirected.fullPage, true);
  assert.equal(pilotScreenshotOptions(undefined, info), undefined);
  const alreadyIsolated = { path: 'test-results/run/page.png' };
  assert.equal(pilotScreenshotOptions(alreadyIsolated, info), alreadyIsolated);
});

test('pilot guard covers both an existing BC page route and its browser context', async () => {
  const { installPilotSafety } = require('../../flows/smb/dstPilotSafety');
  const handlers = [];
  const page = {
    screenshot: async () => Buffer.alloc(0),
    route: async (_pattern, handler) => handlers.push(handler),
    context: () => ({ route: async (_pattern, handler) => handlers.push(handler) }),
  };
  await installPilotSafety(page, { annotations: [], outputPath: (...parts) => path.join('/isolated', ...parts) }, 'SAM-24969', 'S2');
  assert.equal(handlers.length, 2);
  for (const handler of handlers) {
    let aborted = false, continued = false;
    await assert.rejects(() => handler({
      request: () => ({ method: () => 'POST', url: () => 'https://s2-smb-api-cdn.ecom-stg.samsung.com/mx/placeOrder' }),
      abort: async () => { aborted = true; }, fallback: async () => { continued = true; },
    }), /DST_PILOT_FINANCIAL_SUBMISSION_FORBIDDEN/);
    assert.equal(aborted, true);
    assert.equal(continued, false);
  }
});

test('legacy reconciliation retains all 143 baseline instances and distinguishes candidate evidence from runtime', () => {
  const matrix = require('../dst-reconciliation.json');
  assert.equal(matrix.entries.length, 143);
  assert.equal(new Set(matrix.entries.map(e => e.baseline.file)).size, 36);
  assert.equal(matrix.entries.filter(e => e.market === 'MX').length, 22);
  assert.equal(matrix.entries.filter(e => e.market === 'PE').length, 121);
  const inventory = loadOfficialInventory();
  for (const entry of matrix.entries) {
    assert.equal(entry.runtime, 'NOT_RUN');
    assert.match(entry.baseline.callbackSha256, /^[a-f0-9]{64}$/);
    assert.ok(entry.observed.calls.length || entry.observed.assertionCount >= 0);
    if (entry.observed.unconditionalSkip) assert.equal(entry.candidates.length, 0, 'Dormant skipped code cannot count as active coverage');
    for (const match of entry.candidates) {
      const row = inventory.markets[entry.market].contexts[entry.store].rows.find(r => r.sourceRowKey === match.sourceRowKey);
      assert.ok(row, match.sourceRowKey);
      assert.equal(match.officialId, row.officialId || null);
      assert.equal(match.scenario, row.scenario);
      assert.ok(match.gaps.length);
    }
  }
});

test('phase coverage represents every official source row and does not import QST runtime as DST evidence', () => {
  const coverage = require('../dst-phase1-coverage.json');
  const inventory = loadOfficialInventory();
  const officialKeys = Object.values(inventory.markets).flatMap(m => Object.values(m.contexts).flatMap(c => c.rows.map(r => r.sourceRowKey)));
  assert.equal(coverage.rows.length, 362);
  assert.deepEqual(coverage.rows.map(r => r.sourceRowKey).sort(), officialKeys.sort());
  assert.equal(coverage.rows.filter(r => r.pilotSpec).length, 7);
  for (const row of coverage.rows) {
    assert.notEqual(row.implementation, 'FULL');
    assert.ok(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].includes(row.runtime));
    if (row.runtime !== 'NOT_RUN') {
      assert.ok(row.pilotSpec);
      assert.ok(row.evidence.length);
      assert.ok(row.evidence.every(e => e.suite === 'DST'));
    }
  }
});

test('each official pilot has exactly one executable owner inside its market DST tree', () => {
  const { testTitles } = require('../../utils/qstS1Implementation');
  for (const entry of registry.cases) {
    const root = `tests/markets/${entry.market.toLowerCase()}/dst`;
    const titles = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.spec.js'))
      .flatMap(file => testTitles(fs.readFileSync(path.join(root, file), 'utf8')));
    assert.equal(titles.filter(title => title.match(/SAM-\d+/)?.[0] === entry.id).length, 1, entry.id);
  }
});

test('legacy boundary audit ignores local agent artifacts but still rejects active removed-path consumers', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-boundary-'));
  try {
    fs.mkdirSync(path.join(temporary, 'scripts'));
    fs.mkdirSync(path.join(temporary, '.agent'));
    fs.copyFileSync('scripts/audit-legacy-boundaries.cjs', path.join(temporary, 'scripts/audit-legacy-boundaries.cjs'));
    const obsoleteFixturePath = ['tests', 's2', 'old.spec.js'].join('/');
    fs.writeFileSync(path.join(temporary, '.agent/historical.json'), JSON.stringify({ file: obsoleteFixturePath }));
    const run = () => spawnSync(process.execPath, [path.join(temporary, 'scripts/audit-legacy-boundaries.cjs'), '--strict'], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    fs.writeFileSync(path.join(temporary, 'active.cjs'), `require("./${obsoleteFixturePath}");`);
    const rejected = run();
    assert.equal(rejected.status, 1);
    assert.match(rejected.stdout, /actionable=1/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('PE summary checks actual required coupon/savings/info and desktop position, not subtotal equality', async () => {
  const { validatePeDstSummary } = require('../../flows/smb/dstCartAssertions');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent(`<main style="display:flex;gap:200px"><div>SKU-QA</div><section><h2>Resumen de la orden</h2><input placeholder="Código de cupón"><a>Ver cupones disponibles</a><p>Subtotal S/ 100</p><p>Total ahorro S/ 10</p><h3>Total S/ 90</h3><p>Al continuar aceptas los términos y privacidad</p></section></main>`);
    const cart = { sku: 'SKU-QA', validateOrderSummary: async () => ({ subtotal: 'S/ 100', total: 'S/ 90' }) };
    const result = await validatePeDstSummary(page, cart);
    assert.equal(result.rightSide, true);
    assert.notEqual(result.subtotal, result.total);
    await page.locator('section').evaluate(node => { node.style.position = 'absolute'; node.style.left = '0'; });
    await assert.rejects(() => validatePeDstSummary(page, cart), /Summary must be on the right/);
  } finally { await browser.close(); }
});

test('MX cart uses the observed accessible info icon and actual footer without imposing PE footer wording', async () => {
  const { validateMxDstCart } = require('../../flows/smb/dstCartAssertions');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<main><article><h3>QA phone</h3><span>SKU-QA</span><input aria-label="Quantity" value="1"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3C/svg%3E"><p>$100.00</p></article><img alt="service-item-title-tooltip" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3C/svg%3E"></main><footer><h3>Shop</h3><a href="/terms">Terms</a></footer>`);
    const cart = { validateCartPage: async () => {}, validateProductInCart: async () => {}, validateOrderSummary: async () => ({ subtotal: '$100', total: '$100' }) };
    const result = await validateMxDstCart(page, cart, 'SKU-QA');
    assert.equal(result.infoIconCount, 1);
    assert.equal(result.thumbnailVisible, true);
    assert.equal(result.services.visible, false);
  } finally { await browser.close(); }
});

test('shared PE registered navigation observes all three Rewards stages and never submits payment or saves address', async () => {
  const source = fs.readFileSync('flows/pe/storefrontCheckout.js', 'utf8');
  const business = source.slice(source.indexOf('export async function reachPeRegisteredDelivery')).replace(/export /g, '');
  for (const observe of [false, true]) {
    const actions = [], stages = [];
    const page = {
      waitForURL: async () => {}, url: () => 'https://stg2.shop.samsung.com/pe/checkout/one?step=CHECKOUT_STEP_DELIVERY',
      getByRole: (role) => role === 'checkbox' ? { isVisible: async () => false } : { waitFor: async () => {} },
    };
    class Cart {
      async clearPeCartAndConfirmEmpty() { actions.push('reset'); }
      async proceedToAuthenticatedCheckout() { actions.push('registered'); }
    }
    class Checkout {
      async selectNewAuthenticatedAddress() { actions.push('new-address'); }
      async fillAddress() { actions.push('address'); }
      async selectShippingMethod() { actions.push('shipping'); }
      async acceptTerms() { actions.push('terms'); }
      async continueToPayment() { actions.push('payment'); }
    }
    const functions = vm.runInNewContext(`${business}; ({ reachPeRegisteredPayment });`, {
      test: { info: () => ({}), step: async (_, action) => action() },
      CartPage: Cart, CheckoutPage: Checkout, PaymentPage: class { async validatePaymentPage() { actions.push('validated'); } },
      addConfiguredProductToPeCart: async () => { actions.push('add'); return new Cart(); },
      captureBusinessExchange: async (_page, _info, _name, action) => action(),
      testData: { address: {} },
    });
    await functions.reachPeRegisteredPayment(page, { cartUrl: { href: 'https://stg2.shop.samsung.com/pe/cart' } },
      observe ? { observeStage: async stage => stages.push(stage) } : {});
    assert.deepEqual(actions, ['reset', 'add', 'registered', 'new-address', 'address', 'shipping', 'terms', 'payment', 'validated']);
    assert.deepEqual(stages, observe ? ['cart', 'checkout', 'payment'] : []);
  }
});

test('PE pilot identity check only installs existing state and verifies the current page, without recovery/export', async () => {
  const source = fs.readFileSync('flows/pe/existingIdentity.js', 'utf8');
  const body = source.slice(source.indexOf('export async function verifyExistingPeIdentity')).replace('export ', '');
  const actions = [];
  const page = { context: () => ({}), goto: async url => actions.push(url), getByText: () => ({ waitFor: async () => {} }) };
  const verify = vm.runInNewContext(`${body}; verifyExistingPeIdentity;`, {
    test: { step: async (_name, action) => action() },
    peAuth: { getPeAuthState: () => ({
      installPersistedBrowserState: async () => actions.push('install'),
      validateCurrentPageAuthenticated: async () => actions.push('verify-current'),
    }) },
  });
  await verify(page, { setupUrl: { href: 'https://stg2.shop.samsung.com/getcookie.html' }, baseUrl: { href: 'https://stg2.shop.samsung.com/pe/' } });
  assert.deepEqual(actions, ['install', 'https://stg2.shop.samsung.com/getcookie.html', 'https://stg2.shop.samsung.com/pe/', 'verify-current']);
});
