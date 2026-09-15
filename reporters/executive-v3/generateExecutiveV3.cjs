#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildDashboardModel } = require('./dashboardModel');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;' }[c]));
const pct = value => value == null ? 'N/A' : `${Number(value).toFixed(1)}%`;
const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const kpi = (label, value, hint='', tone='') => `<article class="kpi ${tone}"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(hint)}</span></article>`;
const statusClass = status => ({ PASS:'ok', FAIL:'bad-chip', BLOCKED:'warn-chip', 'SKIPPED-BLOCKED':'warn-chip', NOT_APPLICABLE:'muted-chip', NOT_RUN:'muted-chip', full:'ok', partial:'warn-chip', missing:'bad-chip' }[status] || 'muted-chip');
const chip = value => `<span class="chip ${statusClass(value)}">${esc(value)}</span>`;
const empty = text => `<div class="empty">${esc(text)}</div>`;
const duration = ms => `${(Number(ms || 0) / 60000).toFixed(1)}m`;
const bar = value => `<div class="bar"><progress max="100" value="${Math.max(0, Math.min(100, Number(value || 0)))}"></progress></div>`;

function evidenceHref(execution, artifactPath) {
  if (!execution?.buildUrl || !artifactPath) return null;
  const base = String(execution.buildUrl).replace(/\/?$/, '/');
  return `${base}artifact/${String(artifactPath).split('/').map(encodeURIComponent).join('/')}`;
}

function renderAttachments(execution, attachments = []) {
  const safe = attachments.filter(item => item?.path && !/(^|\/)playwright\/\.auth(\/|$)/i.test(item.path));
  if (!safe.length) return '—';
  return safe.map(item => {
    const href = evidenceHref(execution, item.path);
    const label = esc(item.name || path.basename(item.path));
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>` : `<span>${label}</span>`;
  }).join(' ');
}

function renderExecution(execution) {
  if (!execution?.summary || !Array.isArray(execution.tests)) return empty('No real execution artifact was supplied.');
  const s = execution.summary;
  const reconciled = s.passed + s.failed + s.blocked + s.notRun === s.official;
  const rows = execution.tests.map(test => `<tr><td><strong>${esc(test.samId)}</strong><small>${esc(test.title || '')}</small></td><td>${chip(test.status)}</td><td>${duration(test.duration)}</td><td class="evidence">${renderAttachments(execution, test.attachments)}</td><td class="evidence-text">${esc(test.blockedReason || test.error || '')}</td></tr>`).join('');
  return `<div class="runtime-meta"><span><strong>Build</strong> #${esc(execution.buildNumber || 'local')}</span><span><strong>Commit</strong> ${esc(execution.gitCommit || 'unavailable')}</span><span><strong>Timestamp</strong> ${esc(execution.timestamp || 'unavailable')}</span><span><strong>Scope</strong> ${esc(execution.market)} / ${esc(execution.store)} / ${esc(execution.suite)}</span><span><strong>Environment</strong> ${esc(execution.environment || 'unavailable')}</span><span><strong>Reconciliation</strong> ${reconciled ? 'OK' : 'CHECK'}</span></div><div class="grid runtime-kpis">${kpi('Official selected',s.official,'Current build only')}${kpi('Executed',s.executed,'PASS + FAIL')}${kpi('PASS',s.passed,pct(s.passRate),'good')}${kpi('FAIL',s.failed,'Current build failures',s.failed?'bad':'')}${kpi('Blocked',s.blocked,'Runtime prerequisites',s.blocked?'warn':'')}${kpi('Not run',s.notRun,`Duration ${duration(s.duration)}`)}</div><div class="table-wrap"><table><thead><tr><th>TC</th><th>Status</th><th>Duration</th><th>Evidence</th><th>Error / blocker</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderFeatureRows(features) {
  return features.map(row => `<tr><td><strong>${esc(row.feature)}</strong><small>${row.baseStore} BS · ${row.epp} EPP</small></td><td>${row.total}</td><td>${row.full}</td><td>${row.partial}</td><td>${row.missing}</td><td>${pct(row.fullPercent)}</td></tr>`).join('');
}
function renderGaps(rows) {
  const top = rows.slice(0, 12);
  if (!top.length) return empty('No MX automation gaps.');
  return top.map(row => `<tr><td><strong>${esc(row.id)}</strong><small>${esc(row.title || '')}</small></td><td>${esc(row.feature || '')}</td><td>${esc(row.store || '')}</td><td>${chip(row.coverage)}</td></tr>`).join('');
}
function renderMarketFeatureMatrix(rows) {
  return rows.map(row => `<tr><td><strong>${esc(row.feature)}</strong></td>${['MX','CL','CO','PE'].map(m => { const v = row.markets[m]; return !v.total ? '<td class="muted-cell">—</td>' : `<td><b>${v.executed}/${v.total}</b><small>${v.pass} P · ${v.fail} F · ${v.blocked} B · ${v.pending} pending</small></td>`; }).join('')}</tr>`).join('');
}
function renderAudit(audit) { return audit.checks.map(check => `<tr><td>${check.ok ? chip('PASS') : chip('FAIL')}</td><td><strong>${esc(check.key)}</strong></td><td>${esc(check.detail)}</td></tr>`).join(''); }
function renderCatalog(rows) { return rows.map(row => `<tr><td><strong>${esc(row.id)}</strong><small>${esc(row.title)}</small></td><td>${esc(row.market)}</td><td>${esc(row.feature)}</td><td>${esc(row.store)}</td><td>${chip(row.status)}</td><td>${row.coverage ? chip(row.coverage) : '—'}</td><td>${esc(row.context)}</td><td class="evidence-text">${esc(row.blocker || row.evidence || row.runtimePath || '')}</td></tr>`).join(''); }

function render(model) {
  const t = model.totals;
  const mx = model.automation;
  const execution = model.execution;
  const runtime = execution?.summary || null;
  const health = runtime ? (runtime.failed ? 'ATTENTION' : runtime.blocked ? 'WATCH' : runtime.executed ? 'HEALTHY' : 'NO EXECUTION') : model.releaseHealth;
  const marketCards = model.markets.map(m => `<article class="market-card"><div class="market-head"><strong>${m.market}</strong><span>${m.executed}/${m.official} ledger validated</span></div><div class="market-number">${pct(m.validationPercent)}</div>${bar(m.validationPercent)}<div class="market-stats"><span><b>${m.pass}</b> PASS</span><span><b>${m.fail}</b> FAIL</span><span><b>${m.blocked}</b> BLOCKED</span><span><b>${m.pending}</b> PENDING</span></div><footer>Static official scope: ${m.official} TCs</footer></article>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Samsung Automation Control Center</title><link rel="stylesheet" href="dashboard.css"></head><body><header class="hero"><div class="hero-row"><div><div class="eyebrow">Quality Engineering · SMB</div><h1>Samsung Automation Control Center</h1><p>Current build runtime, evidence and automation coverage — explicitly separated.</p></div><div class="health"><span class="eyebrow">Current build health</span><strong>${esc(health)}</strong></div></div><div class="meta"><span>Generated: ${esc(model.generatedAt)}</span><span>Runtime source: runtime-summary.json</span><span>Coverage source: canonical mapping</span><span>Data audit: ${model.audit.ok ? 'OK' : 'CHECK'}</span></div></header><main>
<section class="panel runtime-banner"><div class="panel-title"><div><h2>Current Build Runtime</h2><p>Authoritative status for this Jenkins execution. Coverage and historical ledger data below do not change these numbers.</p></div><span class="tag">REAL PLAYWRIGHT RUNTIME</span></div>${renderExecution(execution)}</section>
<section class="panel static-zone"><div class="panel-title"><div><h2>Official Scope & Coverage Reference</h2><p>Static/canonical QA inventory. This is not the current build result.</p></div><span class="tag">REFERENCE DATA</span></div><div class="static-note">Current Build Runtime uses ${runtime ? `${runtime.official} selected TCs` : 'its own runtime denominator'}. The canonical SMB ledger contains ${t.official} TCs and MX automation coverage contains ${mx.official} TCs. These dimensions are intentionally independent.</div><div class="grid markets">${marketCards}</div></section>
<div class="split"><section class="panel"><div class="panel-title"><div><h2>MX Automation Coverage</h2><p>Coverage denominator is MX official scope (${mx.official}), not all ${t.official} SMB cases and not the current build runtime.</p></div><span class="tag">MX COVERAGE ONLY</span></div><div class="coverage-row"><div class="coverage-box"><small>FULL</small><b>${mx.full ?? 'N/A'}</b></div><div class="coverage-box"><small>PARTIAL</small><b>${mx.partial ?? 'N/A'}</b></div><div class="coverage-box"><small>MISSING</small><b>${mx.missing ?? 'N/A'}</b></div><div class="coverage-box"><small>FULL COVERAGE</small><b>${pct(mx.fullPercent)}</b></div></div><div class="scope-note">Official PASS does not automatically mean Full automation. Runtime execution and persisted automation coverage remain separate dimensions.</div></section><section class="panel"><div class="panel-title"><div><h2>Current Build Attention</h2><p>Derived only from runtime-summary.json.</p></div></div>${runtime ? `<div class="attention"><article><small>FAIL</small><strong>${runtime.failed}</strong></article><article><small>BLOCKED</small><strong>${runtime.blocked}</strong></article><article><small>NOT RUN</small><strong>${runtime.notRun}</strong></article></div>` : empty('No current runtime supplied.')}</section></div>
<div class="section-grid"><section class="panel"><div class="panel-title"><div><h2>MX Coverage by Feature</h2><p>Implementation maturity by official feature family.</p></div><span class="tag">STATIC COVERAGE</span></div><div class="table-wrap"><table><thead><tr><th>Feature</th><th>Total</th><th>Full</th><th>Partial</th><th>Missing</th><th>Full %</th></tr></thead><tbody>${renderFeatureRows(mx.features)}</tbody></table></div></section><section class="panel"><div class="panel-title"><div><h2>Automation Gap Queue</h2><p>MX Partial/Missing only; not current build validation status.</p></div><span class="tag">${mx.gaps.length} OPEN</span></div><div class="table-wrap"><table><thead><tr><th>TC</th><th>Feature</th><th>Store</th><th>Coverage</th></tr></thead><tbody>${renderGaps(mx.gaps)}</tbody></table></div></section></div>
<section class="panel"><div class="panel-title"><div><h2>Market × Feature Validation Matrix</h2><p>Canonical ledger reference prepared for MX, CL, CO and PE.</p></div><span class="tag">REFERENCE</span></div><div class="table-wrap"><table><thead><tr><th>Feature</th><th>MX</th><th>CL</th><th>CO</th><th>PE</th></tr></thead><tbody>${renderMarketFeatureMatrix(model.validation.marketFeatureMatrix)}</tbody></table></div></section>
<section class="panel"><div class="panel-title"><div><h2>Data Consistency Audit</h2><p>Registry, coverage totals and ledger integrity checks.</p></div><span class="tag">${model.audit.passed} PASS · ${model.audit.failed} FAIL</span></div><div class="table-wrap"><table><thead><tr><th>Result</th><th>Check</th><th>Detail</th></tr></thead><tbody>${renderAudit(model.audit)}</tbody></table></div></section>
<section class="panel"><div class="panel-title"><div><h2>Official TC Drilldown</h2><p>Canonical ${model.validation.catalog.length}-TC inventory. This table is reference data, not Current Build Runtime.</p></div><span class="tag">${model.validation.catalog.length} TCs</span></div><div class="table-wrap"><table><thead><tr><th>TC</th><th>Market</th><th>Feature</th><th>Store</th><th>Ledger status</th><th>Coverage</th><th>Context</th><th>Evidence / blocker</th></tr></thead><tbody>${renderCatalog(model.validation.catalog)}</tbody></table></div></section>
</main></body></html>`;
}

function main() {
  const root = path.resolve(__dirname, '../..');
  const ledgerPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'test-mapping/preqa2-validation.json');
  const output = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'test-results/executive-v3/index.html');
  const historyPath = process.argv[4] ? path.resolve(process.argv[4]) : path.join(root, 'test-results/executive-v3/history.json');
  const executionPath = process.argv[5] ? path.resolve(process.argv[5]) : null;
  const history = readJson(historyPath) || [];
  const model = buildDashboardModel({ ledger: readJson(ledgerPath), execution: executionPath ? readJson(executionPath) : null, history: Array.isArray(history) ? history : [] });
  const outputDir = path.dirname(output);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(output, render(model));
  fs.copyFileSync(path.join(__dirname, 'dashboard.css'), path.join(outputDir, 'dashboard.css'));
  console.log(`[executive-v3] ${output}`);
}

if (require.main === module) main();
module.exports = { render, evidenceHref };
