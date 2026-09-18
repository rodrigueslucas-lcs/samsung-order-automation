#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildDashboardModel } = require('./dashboardModel');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const pct = value => value == null ? 'N/A' : `${Number(value).toFixed(1)}%`;
const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const duration = ms => `${(Number(ms || 0) / 60000).toFixed(1)}m`;
const statusClass = status => ({ PASS:'ok', FAIL:'bad-chip', BLOCKED:'warn-chip', 'SKIPPED-BLOCKED':'warn-chip', NOT_APPLICABLE:'muted-chip', NOT_RUN:'muted-chip', full:'ok', partial:'warn-chip', missing:'bad-chip' }[status] || 'muted-chip');
const displayStatus = status => status === 'SKIPPED-BLOCKED' ? 'BLOCKED' : status;
const chip = value => `<span class="chip ${statusClass(value)}">${esc(displayStatus(value))}</span>`;
const empty = text => `<div class="empty">${esc(text)}</div>`;
const kpi = (label, value, hint='', tone='') => `<article class="kpi ${tone}"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(hint)}</span></article>`;
const bar = value => `<div class="bar"><progress max="100" value="${Math.max(0, Math.min(100, Number(value || 0)))}"></progress></div>`;
const successRate = summary => summary?.executed ? (Number(summary.passed || 0) / Number(summary.executed) * 100) : 0;

const OFFICIAL = {
  total: 362, p1: 144, p2: 218,
  markets: {
    MX: { total: 92, p1: 38, base: 56, epp: 36 },
    PE: { total: 92, p1: 34, base: 55, epp: 37 },
    CL: { total: 89, p1: 38, base: 53, epp: 36 },
    CO: { total: 89, p1: 34, base: 54, epp: 35 },
  },
};

function evidenceHref(execution, artifactPath) {
  if (!execution?.buildUrl || !artifactPath) return null;
  const base = String(execution.buildUrl).replace(/\/?$/, '/');
  return `${base}artifact/${String(artifactPath).split('/').map(encodeURIComponent).join('/')}`;
}
function traceViewerHref(href) {
  return href ? `https://trace.playwright.dev/?trace=${encodeURIComponent(href)}` : null;
}
function attachmentKind(item) {
  const value = `${item?.name || ''} ${item?.path || ''}`.toLowerCase();
  if (/trace\.zip|\btrace\b/.test(value)) return 'trace';
  if (/\.(png|jpe?g|webp|gif)\b|screenshot/.test(value)) return 'screenshot';
  if (/\.(webm|mp4)\b|\bvideo\b/.test(value)) return 'video';
  if (/error-context|\.md\b|context/.test(value)) return 'context';
  return 'artifact';
}
function renderAttachments(execution, attachments = []) {
  const safe = attachments.filter(item => item?.path && !/(^|\/)playwright\/\.auth(\/|$)/i.test(item.path));
  if (!safe.length) return '<span class="no-evidence">—</span>';
  const labels = { trace:'Open Trace', screenshot:'Screenshot', video:'Video', context:'Error Context', artifact:'Artifact' };
  return safe.map(item => {
    const href = evidenceHref(execution, item.path);
    const kind = attachmentKind(item);
    const target = kind === 'trace' ? traceViewerHref(href) : href;
    const icon = { trace:'⌁', screenshot:'▣', video:'▶', context:'≡', artifact:'↗' }[kind];
    return target ? `<a class="evidence-link ${kind}" href="${esc(target)}" target="_blank" rel="noopener" title="${esc(item.name || path.basename(item.path))}"><span>${icon}</span>${labels[kind]}</a>` : `<span>${esc(labels[kind])}</span>`;
  }).join('');
}
function blockerCategory(test) {
  const text = `${test?.blockedReason || ''} ${test?.error || ''}`;
  if (/auth|session|login|account|credential/i.test(text)) return 'Authentication';
  if (/sku|product|eligible|test data|address|order|email/i.test(text)) return 'Test Data';
  if (/environment|staging|s1|backend|server|maintenance|timeout|unavailable|endpoint|cdp|network/i.test(text)) return 'Environment';
  return test?.status === 'FAIL' ? 'Functional / Automation' : 'Prerequisite';
}
function resultBar(s) {
  const total = Number(s.official || 0) || 1;
  const segments = [
    ['pass', s.passed, 'PASS'], ['fail', s.failed, 'FAIL'], ['blocked', s.blocked, 'BLOCKED'], ['notrun', s.notRun, 'NOT RUN'],
  ];
  return `<div class="result-bar" aria-label="Execution result distribution">${segments.filter(([,v])=>v).map(([c,v,l]) => `<span class="${c}" style="width:${Number(v)/total*100}%" title="${l}: ${v}"></span>`).join('')}</div><div class="result-legend">${segments.map(([c,v,l]) => `<span><i class="${c}"></i><b>${v}</b> ${l}</span>`).join('')}</div>`;
}
function executionMeta(execution, reconciled) {
  return `<div class="runtime-meta"><span><strong>Build</strong> #${esc(execution.buildNumber || 'local')}</span><span><strong>Environment</strong> ${esc(execution.environment || 'unavailable')}</span><span><strong>Scope</strong> ${esc(execution.market || 'MX')} · ${esc(execution.store || 'BASE_STORE')} · ${esc(execution.suite || 'P1/QST')}</span><span><strong>Commit</strong> ${esc(String(execution.gitCommit || 'unavailable').slice(0, 10))}</span><span><strong>Reconciliation</strong> ${reconciled ? 'OK' : 'CHECK'}</span></div>`;
}
function renderAttention(execution) {
  if (!Array.isArray(execution?.tests)) return empty('No current runtime supplied.');
  const rows = execution.tests.filter(test => test.status === 'FAIL' || test.status === 'SKIPPED-BLOCKED' || test.status === 'BLOCKED');
  if (!rows.length) return '<div class="success-callout">No failures or blockers in the current build.</div>';
  return `<div class="attention-list">${rows.map(test => `<article><div><strong>${esc(test.samId)}</strong><span>${esc(test.title || '')}</span></div>${chip(test.status)}<span class="category">${esc(blockerCategory(test))}</span><p>${esc(String(test.blockedReason || test.error || '').split('\n')[0])}</p><div class="evidence">${renderAttachments(execution, test.attachments)}</div></article>`).join('')}</div>`;
}
function renderExecution(execution) {
  if (!execution?.summary || !Array.isArray(execution.tests)) return empty('No real execution artifact was supplied.');
  const s = execution.summary;
  const reconciled = s.passed + s.failed + s.blocked + s.notRun === s.official;
  const rows = execution.tests.map(test => `<tr><td><strong>${esc(test.samId)}</strong><small>${esc(test.title || '')}</small></td><td>${chip(test.status)}</td><td>${esc(blockerCategory(test))}</td><td>${duration(test.duration)}</td><td class="evidence">${renderAttachments(execution, test.attachments)}</td><td class="evidence-text" title="${esc(test.blockedReason || test.error || '')}">${esc(String(test.blockedReason || test.error || '').split('\n')[0])}</td></tr>`).join('');
  return `${executionMeta(execution,reconciled)}<div class="grid runtime-kpis">${kpi('Official selected',s.official,'Current build only')}${kpi('Executed',s.executed,'PASS + FAIL')}${kpi('PASS',s.passed,pct(s.passRate),'good')}${kpi('FAIL',s.failed,'Current build failures',s.failed?'bad':'')}${kpi('Blocked',s.blocked,'Known prerequisites',s.blocked?'warn':'')}${kpi('Duration',duration(s.duration),'Total runtime')}</div>${resultBar(s)}<div class="table-wrap execution-table"><table><thead><tr><th>Test case</th><th>Status</th><th>Category</th><th>Duration</th><th>Evidence</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderOfficialMarkets() {
  return Object.entries(OFFICIAL.markets).map(([market,m]) => `<article class="market-card"><div class="market-head"><strong>${market}</strong><span>${m.total} DST scenarios</span></div><div class="market-number">${m.p1} <small>P1 / QST</small></div><div class="market-stats"><span><b>${m.base}</b> Base Store</span><span><b>${m.epp}</b> EPP</span></div><footer>Current official priority template</footer></article>`).join('');
}
function renderFeatureRows(features) { return features.map(row => `<tr><td><strong>${esc(row.feature)}</strong><small>${row.baseStore} BS · ${row.epp} EPP</small></td><td>${row.total}</td><td>${row.full}</td><td>${row.partial}</td><td>${row.missing}</td><td>${pct(row.fullPercent)}</td></tr>`).join(''); }
function renderGaps(rows) { const top = rows.slice(0, 12); if (!top.length) return empty('No MX automation gaps.'); return top.map(row => `<tr><td><strong>${esc(row.id)}</strong><small>${esc(row.title || '')}</small></td><td>${esc(row.feature || '')}</td><td>${esc(row.store || '')}</td><td>${chip(row.coverage)}</td></tr>`).join(''); }
function renderMarketFeatureMatrix(rows) { return rows.map(row => `<tr><td><strong>${esc(row.feature)}</strong></td>${['MX','CL','CO','PE'].map(m => { const v = row.markets[m]; return !v.total ? '<td class="muted-cell">—</td>' : `<td><b>${v.executed}/${v.total}</b><small>${v.pass} P · ${v.fail} F · ${v.blocked} B · ${v.pending} pending</small></td>`; }).join('')}</tr>`).join(''); }
function renderAudit(audit) { return audit.checks.map(check => `<tr><td>${check.ok ? chip('PASS') : chip('FAIL')}</td><td><strong>${esc(check.key)}</strong></td><td>${esc(check.detail)}</td></tr>`).join(''); }
function renderCatalog(rows) { return rows.map(row => `<tr><td><strong>${esc(row.id)}</strong><small>${esc(row.title)}</small></td><td>${esc(row.market)}</td><td>${esc(row.feature)}</td><td>${esc(row.store)}</td><td>${chip(row.status)}</td><td>${row.coverage ? chip(row.coverage) : '—'}</td><td>${esc(row.context)}</td><td class="evidence-text">${esc(row.blocker || row.evidence || row.runtimePath || '')}</td></tr>`).join(''); }
function detail(title, subtitle, badge, content, open=false) {
  return `<details class="panel disclosure" ${open?'open':''}><summary><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><span class="tag">${esc(badge)}</span></summary><div class="detail-body">${content}</div></details>`;
}

function render(model) {
  const mx = model.automation;
  const execution = model.execution;
  const runtime = execution?.summary || null;
  const health = runtime ? (runtime.failed ? 'ATTENTION' : runtime.blocked ? 'WATCH' : runtime.executed ? 'HEALTHY' : 'NO EXECUTION') : model.releaseHealth;
  const headline = runtime ? `${esc(execution.market || 'MX')} · ${esc(execution.environment || 'S1/STG')} · ${esc(execution.store || 'BASE_STORE')} · ${esc(execution.suite || 'P1/QST')} · Build #${esc(execution.buildNumber || 'local')}` : 'Samsung LATAM · SMB Commerce · Playwright';
  const scopeReference = `<div class="official-kpis">${kpi('Official SMB',OFFICIAL.total,'DST scenarios')}${kpi('P1 / QST',OFFICIAL.p1,'Included in QST + DST')}${kpi('P2',OFFICIAL.p2,'DST only')}${kpi('Markets',4,'MX · PE · CL · CO')}</div><div class="grid markets">${renderOfficialMarkets()}</div><div class="scope-note">Current priority templates are the official source of truth. The preserved 144-ID Zephyr campaign is historical evidence and is shown only in the legacy drilldown below.</div>`;
  const heroCards = runtime ? `
    ${kpi('Official Tests',runtime.official,'Selected campaign')}
    ${kpi('Passed',runtime.passed,pct(successRate(runtime)),'good')}
    ${kpi('Failed',runtime.failed,'Current build',runtime.failed?'bad':'')}
    ${kpi('Blocked',runtime.blocked,'Known prerequisites',runtime.blocked?'warn':'')}
    ${kpi('Success Rate',pct(successRate(runtime)),'PASS / executed','good')}
    ${kpi('Duration',duration(runtime.duration),'Total runtime')}
    ${kpi('Environment',execution.environment || 'S1/STG','Runtime target')}
    ${kpi('Suite',execution.suite || 'P1/QST',execution.store || 'Base Store')}
  ` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Samsung SMB QA Automation</title><link rel="stylesheet" href="dashboard.css"></head><body><header class="hero"><div class="hero-row"><div><div class="eyebrow">Samsung · Quality Engineering · SMB</div><h1>QA Execution Dashboard</h1><p>${headline}</p></div><div class="health ${health.toLowerCase().replace(/\s+/g,'-')}"><span class="eyebrow">Current build health</span><strong>${esc(health)}</strong></div></div><div class="meta"><span>Generated ${esc(model.generatedAt)}</span><span>Official SMB 362</span><span>P1/QST 144</span><span>P2/DST 218</span><span>Data audit ${model.audit.ok ? 'OK' : 'CHECK'}</span></div></header><main>
<section class="overview">
  <div class="overview-head"><div><span class="section-kicker">CURRENT BUILD</span><h2>Execution at a glance</h2></div><span class="tag">REAL PLAYWRIGHT RUNTIME</span></div>
  <div class="hero-kpis">${runtime ? heroCards : empty('No real execution artifact was supplied.')}</div>
  ${runtime ? resultBar(runtime) : ''}
</section>
<section class="panel attention-panel"><div class="panel-title"><div><h2>Needs Attention</h2><p>Failures and known blockers only. Clean builds keep this section minimal.</p></div><span class="tag">${runtime ? runtime.failed + runtime.blocked : 0} ITEMS</span></div>${renderAttention(execution)}</section>
${detail('Test Execution','TC-level runtime and browser-first evidence.','CURRENT BUILD',renderExecution(execution))}
${detail('Official SMB Scope','Current P1/P2 priority model across LATAM.','362 SCENARIOS',scopeReference)}
${detail('MX Automation Coverage','Implementation maturity for the preserved MX case mapping; separate from runtime.','LEGACY 37-ID MAP',`<div class="coverage-row"><div class="coverage-box"><small>FULL</small><b>${mx.full ?? 'N/A'}</b></div><div class="coverage-box"><small>PARTIAL</small><b>${mx.partial ?? 'N/A'}</b></div><div class="coverage-box"><small>MISSING</small><b>${mx.missing ?? 'N/A'}</b></div><div class="coverage-box"><small>FULL COVERAGE</small><b>${pct(mx.fullPercent)}</b></div></div><div class="scope-note">This 37-ID mapping is retained for implementation traceability. It is not the current official MX P1 denominator (38) and not the current Base Store runner selection (30).</div>`)}
${detail('Coverage Details','Feature maturity and prioritized implementation gaps.','TECHNICAL',`<div class="section-grid"><div><h3>MX Coverage by Feature</h3><div class="table-wrap"><table><thead><tr><th>Feature</th><th>Total</th><th>Full</th><th>Partial</th><th>Missing</th><th>Full %</th></tr></thead><tbody>${renderFeatureRows(mx.features)}</tbody></table></div></div><div><h3>Automation Gap Queue</h3><div class="table-wrap"><table><thead><tr><th>TC</th><th>Feature</th><th>Store</th><th>Coverage</th></tr></thead><tbody>${renderGaps(mx.gaps)}</tbody></table></div></div></div>`)}
${detail('Regional Validation Matrix','Historical 144-ID execution ledger by market and feature.','LEGACY REFERENCE',`<div class="static-note">Current Build Runtime uses ${runtime ? `${runtime.official} selected TCs` : 'its own runtime denominator'}. This matrix is the preserved 144-ID campaign and does not replace the current 362-row priority model.</div><div class="table-wrap"><table><thead><tr><th>Feature</th><th>MX</th><th>CL</th><th>CO</th><th>PE</th></tr></thead><tbody>${renderMarketFeatureMatrix(model.validation.marketFeatureMatrix)}</tbody></table></div>`)}
${detail('Data Integrity','Registry, coverage and ledger consistency checks.','AUDIT ' + (model.audit.ok?'OK':'CHECK'),`<div class="table-wrap"><table><thead><tr><th>Result</th><th>Check</th><th>Detail</th></tr></thead><tbody>${renderAudit(model.audit)}</tbody></table></div>`)}
${detail('Historical TC Inventory',`Preserved ${model.validation.catalog.length}-ID Zephyr campaign for traceability.`,'ARCHIVE',`<div class="table-wrap"><table><thead><tr><th>TC</th><th>Market</th><th>Feature</th><th>Store</th><th>Ledger status</th><th>Coverage</th><th>Context</th><th>Evidence / blocker</th></tr></thead><tbody>${renderCatalog(model.validation.catalog)}</tbody></table></div>`)}
<footer class="report-footer"><strong>Samsung SMB QA Automation</strong><span>Runtime · Evidence · Coverage · Governance</span></footer>
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
module.exports = { render, evidenceHref, traceViewerHref, attachmentKind };
