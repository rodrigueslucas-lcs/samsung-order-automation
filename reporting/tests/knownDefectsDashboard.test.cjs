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
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('mapped Jira is not shown as a known defect when the current runtime passes', () => {
  assert.equal(activeKnownDefects(runtime('PASS'), registry).length, 0);
});
