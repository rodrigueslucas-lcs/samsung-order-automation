const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { annotateDashboard } = require('../../scripts/annotate-known-defects-dashboard.cjs');

test('Needs Attention uses consistent FAIL, BLOCKED and KNOWN DEFECT visual families', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smb-attention-status-'));
  try {
    fs.mkdirSync(path.join(dir, 'executive'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'runtime-summary.json'), JSON.stringify({
      market: 'MX',
      environment: 'S2/STG2',
      store: 'BASE_STORE',
      summary: { official: 29, failed: 1, blocked: 2 },
      tests: [
        { samId: 'SAM-25010', title: 'Track Order', status: 'SKIPPED-BLOCKED', failureType: 'FUNCTIONAL_DEFECT' },
        { samId: 'SAM-99998', title: 'Prerequisite example', status: 'SKIPPED-BLOCKED', failureType: 'TEST_DATA_BLOCKED' },
        { samId: 'SAM-99999', title: 'Failure example', status: 'FAIL', failureType: 'ENVIRONMENT_ERROR' },
      ],
    }));

    fs.writeFileSync(path.join(dir, 'executive', 'index.html'), `<!doctype html><html><head></head><body>
      <div class="hero-kpis"><article class="kpi warn"><small>Blocked</small><b>2</b><span>Known prerequisites</span></article><article class="kpi bad"><small>Failed</small><b>1</b><span>Current build</span></article></div>
      <div class="result-bar"><span class="fail" style="width:3%" title="FAIL: 1"></span><span class="blocked" style="width:6%" title="BLOCKED: 2"></span></div>
      <div class="result-legend"><span><i class="fail"></i><b>1</b> FAIL</span><span><i class="blocked"></i><b>2</b> BLOCKED</span></div>
      <div class="attention-list">
        <article><div><a class="sam-link" href="#">SAM-25010</a><span>Track Order</span></div><span class="chip warn-chip">BLOCKED</span><span class="category">FUNCTIONAL DEFECT</span><p>Mapped defect reason</p><div class="evidence"></div></article>
        <article><div><a class="sam-link" href="#">SAM-99998</a><span>Prerequisite example</span></div><span class="chip warn-chip">BLOCKED</span><span class="category">TEST DATA BLOCKED</span><p>Missing prerequisite</p><div class="evidence"></div></article>
        <article><div><a class="sam-link" href="#">SAM-99999</a><span>Failure example</span></div><span class="chip bad-chip">FAIL</span><span class="category">ENVIRONMENT ERROR</span><p>Failure reason</p><div class="evidence"></div></article>
      </div>
      <div class="grid runtime-kpis"><article class="kpi warn"><small>Blocked</small><b>2</b><span>Known prerequisites</span></article><article class="kpi bad"><small>Failed</small><b>1</b><span>Current build</span></article></div>
      <div class="table-wrap execution-table"></div>
    </body></html>`);

    annotateDashboard({ artifactDir: dir });
    const html = fs.readFileSync(path.join(dir, 'executive', 'index.html'), 'utf8');

    assert.match(html, /article:has\(\.chip\.bad-chip\).*background:linear-gradient\(145deg,#fff,#fff3f4\)/);
    assert.match(html, /article:has\(\.chip\.bad-chip\) \.category.*color:var\(--bad\)!important/);
    assert.match(html, /article:has\(\.chip\.warn-chip\).*background:linear-gradient\(145deg,#fff,#fffaf0\)/);
    assert.match(html, /article\.known-defect.*background:linear-gradient\(145deg,#fff,#f8f4ff\)/);
    assert.match(html, /article>div:first-child span\{color:#334155!important;font-weight:600\}/);
    assert.match(html, /article p\{color:#475569!important;font-weight:500\}/);
    assert.match(html, /KNOWN DEFECT/);
    assert.match(html, /ENVIRONMENT ERROR/);
    assert.match(html, /TEST DATA BLOCKED/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
