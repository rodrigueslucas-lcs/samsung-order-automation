const path = require('node:path');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function evidenceHref(root, file, artifactBaseUrl) {
  if (!file || !path.isAbsolute(file)) return null;
  const relative = path.relative(path.resolve(root), path.resolve(file));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  const encoded = relative.split(path.sep).map(encodeURIComponent).join('/');
  return artifactBaseUrl ? artifactBaseUrl.replace(/\/?$/, '/') + encoded : '../' + encoded;
}

const STATUS_TONE = Object.freeze({
  PASS: 'pass', FAIL: 'fail', KNOWN_DEFECT: 'warn',
  TEST_DATA_REQUIRED: 'warn', AUTH_BLOCKED: 'warn',
  RECONCILIATION_REQUIRED: 'warn', NOT_RUN: 'muted'
});
const STATUS_LABEL = Object.freeze({
  PASS: 'Passed', FAIL: 'Failed', KNOWN_DEFECT: 'Known defect',
  TEST_DATA_REQUIRED: 'Test data required', AUTH_BLOCKED: 'Auth blocked',
  RECONCILIATION_REQUIRED: 'Reconciliation required', NOT_RUN: 'Not run'
});
function statusPill(status, raw = false) {
  const key = String(status || 'NOT_RUN').toUpperCase().replace(/[^A-Z_]/g, '');
  const tone = raw ? (key === 'PASSED' ? 'pass' : key === 'FAILED' || key === 'TIMEDOUT' ? 'fail' : 'muted') : STATUS_TONE[key] || 'muted';
  const label = raw ? String(status || 'NOT_RUN') : STATUS_LABEL[key] || String(status);
  return '<span class="epp-pill epp-pill--' + tone + '">' + escape(label) + '</span>';
}
function safeExternal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'jira.secext.samsung.net' ? parsed.href : null;
  } catch { return null; }
}
function formatSeconds(milliseconds) {
  return (Math.max(0, Number(milliseconds) || 0) / 1000).toFixed(1) + 's';
}
function render(model, {artifactRoot, artifactBaseUrl, playwrightUrl='../html/index.html', allureUrl='../allure-report/index.html'}) {
  const esc = escape;
  const counts = model.counts || {};
  const official = Math.max(0, Number(model.official) || 0);
  const executed = Math.max(0, Number(model.executed) || 0);
  const isTargeted = Boolean(model.targetIds?.length);
  const selected = isTargeted ? Number(model.selected) || model.targetIds.length : official;
  const remaining = Math.max(0, official - executed);
  const gate = String(model.gate || 'NOT_RUN');
  const gateTone = /FAIL|INFRA_ERROR/.test(gate) ? 'failed' : /BLOCKED|DEFECT|NOT_RUN/.test(gate) ? 'blocked' : 'pass';
  const pass = Number(counts.PASS) || 0;
  const fail = Number(counts.FAIL) || 0;
  const blocked = Math.max(0, executed - pass - fail);
  const width = n => official ? Math.max(0, Math.min(100, 100 * n / official)).toFixed(2) : '0';
  const kpis = Object.entries(STATUS_LABEL).map(([status, label]) =>
    '<article class="epp-kpi epp-kpi--' + status + '"><small>' + esc(label) + '</small><b>' + (Number(counts[status]) || 0) + '</b></article>'
  ).join('');
  const orders = (model.orders || []).map(order =>
    '<tr><td><strong>' + esc(order.publicOrderNumber) + '</strong></td><td>' + esc(order.method) +
    '</td><td>' + esc((order.tcs || []).join(', ')) + '</td><td>' +
    (order.newOrderInCurrentRun && order.confirmationValidated ?
      '<span class="epp-pill epp-pill--pass">Current run · confirmation validated</span>' :
      '<span class="epp-pill epp-pill--warn">Unproven</span>') + '</td></tr>'
  ).join('');
  const orderSection = orders ?
    '<div class="epp-table-wrap epp-table"><table><thead><tr><th>Public order number</th><th>Method</th><th>Causal scenarios</th><th>Evidence</th></tr></thead><tbody>' + orders + '</tbody></table></div>' :
    '<div class="epp-order-empty"><div class="epp-order-empty-icon" aria-hidden="true">◇</div><div><strong>No newly confirmed order proven in this campaign</strong><p>Historical reconciliation does not count as a new payment PASS. Only an order causally created and confirmed during this run appears here.</p></div></div>';
  const rows = (model.rows || []).map(row => {
    const evidence = (row.evidence || []).map(a => {
      const href = evidenceHref(artifactRoot, a.path, artifactBaseUrl);
      return href ? '<a class="epp-evidence-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">Evidence</a>' : '';
    }).join('');
    const jira = safeExternal(row.url);
    const reference = row.reference && jira ? '<a class="epp-tc" href="' + esc(jira) + '" target="_blank" rel="noopener noreferrer">' + esc(row.reference) + '</a>' : '—';
    const raw = row.raw || 'NOT_RUN';
    const reason = row.errorSummary || row.reasonCode;
    const name = row.name || 'Official scenario';
    const tc = /^SAM-\d+$/.test(row.tc || '') ? row.tc : '';
    const tcLink = tc ? '<a class="epp-tc" href="https://jira.secext.samsung.net/browse/' + esc(tc) + '" target="_blank" rel="noopener noreferrer">' + esc(tc) + '</a>' : esc(row.tc);
    return '<tr class="' + (row.quality === 'NOT_RUN' ? 'epp-row--notrun' : '') + '"><td>' + tcLink +
      '</td><td><span class="epp-scenario">' + esc(name) + '</span>' +
      (reason ? '<span class="epp-detail">' + esc(reason) + '</span>' : '') +
      '</td><td>' + statusPill(raw, true) + '</td><td>' + statusPill(row.quality) +
      '</td><td>' + formatSeconds(row.duration) + '</td><td>' + reference +
      '</td><td>' + evidence + '<a class="epp-evidence-link" href="' + esc(row.allureUrl || allureUrl) +
      '" target="_blank" rel="noopener noreferrer">Allure</a></td></tr>';
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><title>Samsung · ' + esc(model.market) + ' EPP Quality</title>' +
    '<link rel="stylesheet" href="dashboard.css"><link rel="stylesheet" href="epp-theme.css">' +
    '<style>.epp-table{overflow-x:auto}</style></head><body class="epp-report">' +
    '<header class="epp-hero"><div class="epp-hero-top"><div>' +
    '<p class="epp-eyebrow">Samsung SMB / QA Automation / Official EPP QST</p>' +
    '<h1>' + esc(model.market) + ' <span>· ' + esc(model.environment) + ' · ' + esc(model.program) + '</span></h1>' +
    '<p class="epp-hero-sub">Execution quality, official scenario coverage and auditable evidence</p></div>' +
    '<div class="epp-gate epp-gate--' + gateTone + '"><small>Quality gate</small><strong>' + esc(gate) + '</strong></div></div>' +
    '<div class="epp-hero-meta"><span>Build ' + esc(model.buildNumber || 'LOCAL') + '</span><span>Run ' + esc(model.runId) +
    '</span><span>Commit ' + esc(model.gitCommit ? model.gitCommit.slice(0, 10) : 'unavailable') +
    '</span><span>Duration ' + formatSeconds(model.durationMs) + '</span></div>' +
    '<nav class="epp-actions" aria-label="Related reports"><a class="epp-action epp-action--primary" href="' + esc(allureUrl) +
    '" target="_blank" rel="noopener noreferrer">View Allure</a><a class="epp-action" href="' + esc(playwrightUrl) +
    '" target="_blank" rel="noopener noreferrer">Playwright report</a><a class="epp-action" href="quality.json">Quality JSON</a></nav></header>' +
    '<main class="epp-shell"><div class="epp-overlap"><section class="epp-panel epp-overview" aria-labelledby="epp-overview-title">' +
    '<div class="epp-panel-head"><div><span class="epp-section-kicker">01 / Executive overview</span><h2 id="epp-overview-title">Execution health</h2><p>Current campaign results only — no historical PASS substitution</p></div>' +
    '<span class="epp-pill">' + (isTargeted ? 'Targeted execution' : 'Full official campaign') + '</span></div>' +
    '<div class="epp-kpis">' + kpis + '</div><div class="epp-progress-head"><strong>' + executed + ' / ' + official +
    ' executed</strong><span>' + remaining + ' official scenarios not executed in this campaign</span></div>' +
    '<div class="epp-progress" role="img" aria-label="Execution coverage: ' + executed + ' of ' + official + ' official scenarios">' +
    '<span class="passed" style="width:' + width(pass) + '%"></span><span class="failed" style="width:' + width(fail) +
    '%"></span><span class="blocked" style="width:' + width(blocked) + '%"></span><span class="remaining" style="width:' +
    width(remaining) + '%"></span></div><p class="epp-note">Raw results remain unchanged. Known defects do not count as PASS. ' +
    (isTargeted ? 'Targeted execution: ' + selected + ' selected; complete official homologation remains unproven.' :
      'The current full campaign controls homologation readiness.') + '</p></section></div>' +
    '<section class="epp-panel" aria-labelledby="epp-summary-title"><div class="epp-panel-head"><div>' +
    '<span class="epp-section-kicker">02 / Run context</span><h2 id="epp-summary-title">Execution summary</h2>' +
    '<p>Separate run scope from functional approval</p></div></div><div class="epp-summary-grid">' +
    '<div class="epp-summary-stat"><span>Execution scope</span><strong>' + (isTargeted ? 'Targeted' : 'Full campaign') +
    '</strong></div><div class="epp-summary-stat"><span>Selected official TCs</span><strong>' + selected +
    '</strong></div><div class="epp-summary-stat"><span>Executed / official</span><strong>' + executed + ' / ' + official +
    '</strong></div><div class="epp-summary-stat"><span>New proven orders</span><strong>' + (model.orders || []).filter(o => o.newOrderInCurrentRun && o.confirmationValidated).length +
    '</strong></div></div></section>' +
    '<section class="epp-panel" aria-labelledby="epp-orders-title"><div class="epp-panel-head"><div>' +
    '<span class="epp-section-kicker">03 / Payment traceability</span><h2 id="epp-orders-title">Orders created in this campaign</h2>' +
    '<p>Only current-run, causally validated orders qualify</p></div></div>' + orderSection + '</section>' +
    '<section class="epp-panel" aria-labelledby="epp-matrix-title"><div class="epp-panel-head"><div>' +
    '<span class="epp-section-kicker">04 / Official test inventory</span><h2 id="epp-matrix-title">Official test execution matrix</h2>' +
    '<p>Raw Playwright results and QA classification are intentionally separate</p></div>' +
    '<span class="epp-pill">' + official + ' official TCs</span></div>' +
    '<div class="epp-table-wrap epp-table"><table><thead><tr><th>SAM</th><th>Scenario</th><th>Raw</th><th>Quality</th>' +
    '<th>Duration</th><th>Matched defect</th><th>Evidence</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
    '<section class="epp-panel" aria-labelledby="epp-gates-title"><div class="epp-panel-head"><div>' +
    '<span class="epp-section-kicker">05 / Governance</span><h2 id="epp-gates-title">Gate rules</h2></div></div>' +
    '<div class="epp-rule-grid"><div class="epp-rule"><strong>Regressions take priority</strong><span>Infrastructure errors and unexpected functional failures override a successful gate.</span></div>' +
    '<div class="epp-rule"><strong>Known defects are not PASS</strong><span>Existing defects and missing test data remain visible and require their own evidence.</span></div>' +
    '<div class="epp-rule"><strong>Full approval requires full scope</strong><span>Only a complete current official campaign can be FULLY PASSED.</span></div></div></section>' +
    '<footer class="epp-footer"><span>Samsung SMB · QA Automation · EPP S2</span><span>Current-build evidence only · No financial retries inferred</span></footer></main></body></html>';
}
module.exports = {render, evidenceHref, escape};
