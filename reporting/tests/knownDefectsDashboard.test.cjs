const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeEnvironment, activeKnownDefects, annotateDashboard } = require('../../scripts/annotate-known-defects-dashboard.cjs');
const registry = require('../../governance/known-defects.json');

function runtime(status = 'SKIPPED-BLOCKED') {
  return {
    market: 'MX',
    environment: 'S2/STG2',
    store: 'BASE_STORE',
    suite: 'P1/QST',
    summary: { official: 29, executed: 28, passed: 25, failed: 3, blocked: 1, notRun: 0 },
    tests: [
      { samId: 'SAM-25010', title: 'Track Order with email and Order ID', status, failureType: 'TEST_DATA_BLOCKED' },
    ],
  };
}

function backToTopRuntime({ market, environment, status = 'FAIL' }) {
  const samId = market === 'PE' ? 'SAM-25094' : 'SAM-24911';
  return {
    market,
    environment,
    store: 'BASE_STORE',
    suite: 'P1/QST',
    summary: {
      official: market === 'PE' ? 28 : 29,
      executed: status === 'SKIPPED-BLOCKED' ? 0 : 1,
      passed: 0,
      failed: status === 'FAIL' ? 1 : 0,
      blocked: status === 'SKIPPED-BLOCKED' ? 1 : 0,
      notRun: 0,
    },
    tests: [
      { samId, title: 'Verify Back to Top', status, failureType: 'FUNCTIONAL_DEFECT' },
    ],
  };
}

function dashboardHtml() {
  return `<!doctype html><html><head></head><body>
  <div class="hero-kpis"><article class="kpi warn"><small>Blocked</small><b>1</b><span>Known prerequisites</span></article></div>
  <div class="result-bar"><span class="pass" style="width:86.20689655172413%" title="PASS: 25"></span><span class="fail" style="width:10.344827586206897%" title="FAIL: 3"></span><span class="blocked" style="width:3.4482758620689653%" title="BLOCKED: 1"></span></div>
  <div class="result-legend"><span><i class="pass"></i><b>25</b> PASS</span><span><i class="fail"></i><b>3</b> FAIL</span><span><i class="blocked"></i><b>1</b> BLOCKED</span></div>
  <div class="attention-list"><article><div><a class="sam-link" href="#">SAM-25010</a><span>Track Order with email and Order ID</span></div><span class="chip warn-chip">BLOCKED</span><span class="category">TEST DATA BLOCKED</span><p>Known environment defect</p><div class="evidence"></div></article></div>
  <div class="grid runtime-kpis"><article class="kpi warn"><small>Blocked</small><b>1</b><span>Known prerequisites</span></article></div>
  <div class="table-wrap execution-table"><table><tbody><tr><td><a class="sam-link" href="#">SAM-25010</a><small>Track Order with email and Order ID</small></td><td><span class="chip warn-chip">BLOCKED</span></td><td>TEST DATA BLOCKED</td><td>4.7m</td><td></td><td>Known environment defect</td></tr></tbody></table></div>
  </body></html>`;
}

test('known-defect registry maps SAM-25010 to the created RT', () => {
  const defect = registry.defects.find(item => item.samId === 'SAM-25010');
  assert.ok(defect);
  assert.equal(defect.jira, 'RT-738525');
  assert.equal(defect.url, 'https://jira.secext.samsung.net/browse/RT-738525');
  assert.equal(defect.classification, 'KNOWN_DEFECT');
  assert.equal(normalizeEnvironment('S2/STG2'), 'S2');
  assert.equal(activeKnownDefects(runtime(), registry).length, 1);
});

test('RT-746043 maps PE and CO Back to Top in S1 and S2 only when actionable', () => {
  const scenarios = [
    { market: 'PE', environment: 'S1/STG1', samId: 'SAM-25094' },
    { market: 'PE', environment: 'S2/STG2', samId: 'SAM-25094' },
    { market: 'CO', environment: 'S1/STG1', samId: 'SAM-24911' },
    { market: 'CO', environment: 'S2/STG2', samId: 'SAM-24911', status: 'SKIPPED-BLOCKED' },
  ];

  for (const scenario of scenarios) {
    const active = activeKnownDefects(backToTopRuntime(scenario), registry);
    assert.equal(active.length, 1, `${scenario.market} ${scenario.environment} must map exactly one Back to Top defect.`);
    assert.equal(active[0].defect.samId, scenario.samId);
    assert.equal(active[0].defect.jira, 'RT-746043');
    assert.equal(active[0].defect.url, 'https://jira.secext.samsung.net/browse/RT-746043');
    assert.equal(active[0].defect.classification, 'KNOWN_DEFECT');
  }

  assert.equal(activeKnownDefects(backToTopRuntime({ market: 'PE', environment: 'S1/STG1', status: 'PASS' }), registry).length, 0);
  assert.equal(activeKnownDefects(backToTopRuntime({ market: 'CO', environment: 'S2/STG2', status: 'PASS' }), registry).length, 0);
});

test('dashboard visually separates a mapped defect without rewriting raw runtime truth', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smb-known-defect-'));
  try {
    fs.mkdirSync(path.join(dir, 'executive'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'runtime-summary.json'), JSON.stringify(runtime(), null, 2));
    fs.writeFileSync(path.join(dir, 'executive', 'index.html'), dashboardHtml());

    const result = annotateDashboard({ artifactDir: dir });
    assert.equal(result.annotated, true);
    assert.deepEqual(result.defects, ['RT-738525']);

    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'runtime-summary.json'), 'utf8'));
    assert.equal(raw.tests[0].status, 'SKIPPED-BLOCKED');
    assert.equal(raw.summary.blocked, 1);

    const html = fs.readFileSync(path.join(dir, 'executive', 'index.html'), 'utf8');
    assert.match(html, /KNOWN DEFECT/);
    assert.match(html, /RT-738525/);
    assert.match(html, /https:\/\/jira\.secext\.samsung\.net\/browse\/RT-738525/);
    assert.match(html, /defect-chip/);
    assert.match(html, /Known Functional Defect/);
    assert.match(html, /known-defect-registry/);
    assert.match(html, /class="defect"/);
    assert.doesNotMatch(html, /<i class="blocked"><\/i><b>1<\/b> BLOCKED/);

    const defectStyle = html.match(/<style id="known-defect-style">([\s\S]*?)<\/style>/)?.[1] || '';
    assert.match(defectStyle, /--defect:#7047c7/);
    assert.match(defectStyle, /\.runtime-kpis\{grid-template-columns:repeat\(auto-fit,minmax\(150px,1fr\)\)!important\}/);
    assert.doesNotMatch(defectStyle, /\.hero-kpis/,
      'Known-defect styling must not override the executive overview 4x2 responsive KPI grid.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('mapped Jira is not shown as a known defect when the current runtime passes', () => {
  assert.equal(activeKnownDefects(runtime('PASS'), registry).length, 0);
});
