const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('@playwright/test');
const definitions = require('../dst-phase2-definitions.json');
const registry = require('../dst-phase2-pilot.json');
const { executionPlan } = require('../../utils/dstExecution.cjs');
const { loadOfficialInventory } = require('../../utils/officialSmbInventory');

test('nine detailed definitions resolve to official DST rows without importing historical PASS', () => {
  const inventory = loadOfficialInventory();
  assert.equal(definitions.cases.length, 9);
  assert.equal(registry.cases.length, 9);
  assert.equal(new Set(registry.cases.map(c => c.id)).size, 9);
  for (const c of definitions.cases) {
    const row = inventory.markets[c.market].contexts[c.store].rows.find(r => r.sourceRowKey === c.sourceRowKey);
    assert.equal(row.officialId, c.id);
    assert.equal(row.dstIncluded, true);
    assert.equal(c.connectorVerified, false);
    assert.equal(c.historicalStatusIsRuntimeEvidence, false);
    assert.equal(c.csvCorroboration.fieldsMatch, true);
    assert.match(c.source.sha256, /^[a-f0-9]{64}$/);
    assert.match(c.source.range, /^A\d+:[IJ]\d+$/);
    for (const field of ['steps', 'preconditions', 'expectedResults']) assert.ok(c.fields[field].length > 10);
    assert.equal(registry.cases.find(p => p.id === c.id).formalHomologation, 'PENDING_PHASE2_RUNTIME');
  }
  assert.equal(definitions.exportCoverage.total, 144);
  assert.equal(definitions.exportCoverage.p2DefinitionsAvailable, 0);
});

test('BackOffice source boilerplate and explicit operator clarification remain traceable', () => {
  for (const id of ['SAM-24920', 'SAM-24830']) {
    const c = definitions.cases.find(c => c.id === id);
    assert.match(c.fields.preconditions, /User is on payment page/);
    assert.equal(c.preconditionClarification.operatorAnswer, 'É texto genérico do export');
    assert.match(c.fields.expectedResults, /order\/product.*basic\/advance/);
  }
});

test('Phase 2 matrix retains all official rows and only derives PASS from actual same-phase execution', () => {
  const coverage = require('../dst-phase2-coverage.json');
  const phase1 = require('../dst-phase1-coverage.json');
  assert.equal(coverage.rows.length, 362);
  assert.deepEqual(coverage.rows.map(r => r.sourceRowKey).sort(), phase1.rows.map(r => r.sourceRowKey).sort());
  const pilots = coverage.rows.filter(r => r.executionHistory);
  assert.equal(pilots.length, 9);
  for (const row of coverage.rows) {
    if (!row.executionHistory) { assert.equal(row.runtime, 'NOT_RUN'); continue; }
    const last = row.executionHistory.at(-1);
    assert.ok(last, row.officialId);
    if (row.runtime === 'PASS') assert.equal(last.rawPlaywrightStatus, 'passed');
    for (const attempt of row.executionHistory) {
      assert.equal(attempt.type,'TARGETED_RUNTIME');
      assert.match(attempt.evidenceSha256,/^[a-f0-9]{64}$/);
      assert.match(attempt.evidence,/^test-results\/dst\//);
      assert.notEqual(attempt.rawPlaywrightStatus,'skipped');
    }
    if (row.officialId === 'SAM-25065' && row.runtime === 'PASS') assert.deepEqual(last.observedRewardsStages,['cart','checkout','payment']);
    if (last.errorSignatures.includes('TRACE_ARCHIVE_EBUSY')) assert.equal(row.runtime,'FAIL','An unrelated artifact error cannot be hidden as only a prerequisite blocker');
  }
});

test('targeted market/store/priority plans isolate artifacts and disable finance and auth renewal', () => {
  for (const [market, id] of [['MX','SAM-24969'],['PE','SAM-25065'],['CO','SAM-24920'],['CL','SAM-24830']]) {
    const run = executionPlan([market,'--store','BASE_STORE','--priority','P1','--ids',id,'--list'], {
      DST_ENVIRONMENT: 'S2', MX_QST_ENVIRONMENT: 'S1', ALLOW_PAYMENT_SUBMIT:'1', ALLOW_ORDER_SUBMIT:'1', BROWSER_MODE:'headed',
    });
    assert.deepEqual(run.cases.map(c => c.id), [id]);
    assert.equal(run.childEnv[`${market}_QST_ENVIRONMENT`], 'S2');
    assert.equal(run.childEnv.TEST_SUITE, 'DST');
    assert.equal(run.childEnv.ALLOW_PAYMENT_SUBMIT, '0');
    assert.equal(run.childEnv.ALLOW_ORDER_SUBMIT, '0');
    assert.equal(run.childEnv.ALLOW_PROFILE_WRITE, '0');
    assert.equal(run.childEnv.MX_QST_HEADLESS, '0');
    assert.equal(run.childEnv[`${market}_AUTH_AUTO_RENEW`], '0');
    assert.match(run.artifact.replace(/\\/g,'/'), new RegExp(`/dst/${market.toLowerCase()}/base_store/p1/`));
    assert.ok(run.command.includes('--list'));
    assert.ok(run.command.includes('--workers=1'));
    assert.ok(run.command.includes('--retries=0'));
    assert.ok(run.command.some(a => a.includes('/dst/base-store/')));
  }
});

test('runner rejects full campaigns, wrong IDs/store/priority, production and arbitrary CLI flags', () => {
  for (const args of [[], ['PE'], ['CO','--store','BASE_STORE','--priority','P1'],
    ['CO','--store','EPP','--priority','P1','--ids','SAM-24920'],
    ['CL','--store','BASE_STORE','--priority','P2','--ids','SAM-24830'],
    ['MX','--store','BASE_STORE','--priority','P1','--ids','SAM-25065'],
    ['PE','--store','BASE_STORE','--priority','P1','--ids','SAM-25065','--grep','.*']]) {
    assert.throws(() => executionPlan(args, {}), /DST_/);
  }
  const args = ['MX','--store','BASE_STORE','--priority','P1','--ids','SAM-24969'];
  assert.throws(() => executionPlan(args, { DST_ENVIRONMENT:'PROD' }), /DST_STAGING_REQUIRED/);
  assert.throws(() => executionPlan(args, { DST_ENVIRONMENT:'S1' }), /DST_ENVIRONMENT_REQUIRED/);
  const p2 = loadOfficialInventory().markets.MX.contexts.BASE_STORE.rows.find(row => row.priority === 'P2');
  assert.throws(() => executionPlan(['MX','--store','BASE_STORE','--priority','P2','--ids',p2.officialId || p2.sourceRowKey], {}), /DST_NOT_IMPLEMENTED/);
});

function catalogClass() {
  const source = fs.readFileSync('pages/BackOfficeCatalogPage.js','utf8')
    .replace(/^import .*;\r?\n/gm,'').replace('export default class','class');
  return vm.runInNewContext(`${source}\nBackOfficeCatalogPage;`, { BackOfficePage:class{} });
}

test('Products navigation accepts persisted Advanced mode and switches once before Basic query', async () => {
  const browser = await chromium.launch({ headless:true, channel:'chrome' });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div role="row" aria-label="Catalog">Catalog</div><div role="row" aria-label="Products">Products</div>
      <div class="yw-advancedsearch">Article Number</div>
      <button class="yw-toggle-advanced-search" title="Switch search mode">Switch</button>
      <input placeholder="Type to search" hidden><script>window.switches=0;document.querySelector('button').onclick=()=>{
        switches++;document.querySelector('.yw-advancedsearch').hidden=true;document.querySelector('input').hidden=false;}</script>`);
    const catalog = Object.create(catalogClass().prototype); catalog.page = page;
    catalog.waitForZkUpdate = async action => action();
    await catalog.openAdminProducts();
    assert.equal(await page.evaluate(() => window.switches), 1);
    await catalog.openAdminProducts();
    assert.equal(await page.evaluate(() => window.switches), 1, 'Already basic mode is not toggled');
  } finally { await browser.close(); }
});

test('Rewards validator requires actual hovered tooltip text independently on all three stages', async () => {
  const { validateRewardsText } = require('../../flows/smb/dstCartAssertions');
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage();
    for (const stage of ['cart','checkout','payment']) {
      await page.mouse.move(0, 0);
      await page.setContent(`<div class="summary-rewards-benefit"><span>Gana 33 puntos Samsung Rewards</span>
        <span class="${stage === 'cart' ? 'delivery-info-tooltip' : 'order-summary-reward-tooltip'}">Tooltip</span></div><div role="tooltip" hidden></div>
        <script>(()=>{const icon=document.querySelector('.summary-rewards-benefit span:last-child'),tip=document.querySelector('[role=tooltip]');
        icon.onmouseenter=()=>{tip.textContent='Puedes inscribirte en Samsung Rewards y obtener tus puntos.';tip.hidden=false};
        icon.onmouseleave=()=>{tip.hidden=true}})()</script>`);
      const proof = await validateRewardsText(page, stage);
      assert.equal(proof.stage, stage);
      assert.match(proof.tooltipText, /obtener tus puntos/);
    }
    // A visible Rewards label and static disclaimer alone must never pass.
    await page.setContent('<div class="summary-rewards-benefit"><span>Gana 33 puntos Samsung Rewards</span><span class="delivery-info-tooltip">Tooltip</span><p>La cantidad final de puntos Samsung Rewards...</p></div>');
    await assert.rejects(validateRewardsText(page,'payment'), /Rendered Rewards tooltip/);
  } finally { await browser.close(); }
});

test('DST BC attributes prove native price and readable colour, blocking missing colour before Add', async () => {
  const { validateDstBcAttributes } = require('../../flows/mx/dstBcAssertions');
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage();
    const device = '<input type="radio" name="device-rdo" data-modelcode="MODEL-QA" data-modelprice="45999" checked><span class="device-price-info">$ 45,999.00</span>';
    await page.setContent(device);
    await assert.rejects(validateDstBcAttributes(page,'MODEL-QA'), /DST_BC_COLOUR_NOT_RENDERED/);
    await page.setContent(device + '<input type="radio" name="basic-color" id="qa-color" data-modelcode="MODEL-QA" checked><label for="qa-color">Negro</label>');
    const proof = await validateDstBcAttributes(page,'MODEL-QA');
    assert.equal(proof.displayedPrice,45999);
    assert.equal(proof.colorText,'Negro');
  } finally { await browser.close(); }
});
