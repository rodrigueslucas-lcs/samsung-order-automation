#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildDashboardModel } = require('./dashboardModel');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;' }[c]));
const pct = value => value == null ? 'N/A' : `${Number(value).toFixed(1)}%`;
const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const duration = ms => `${(Number(ms || 0) / 60000).toFixed(1)}m`;
const statusClass = status => ({ PASS:'ok', FAIL:'bad-chip', BLOCKED:'warn-chip', 'SKIPPED-BLOCKED':'warn-chip', NOT_APPLICABLE:'muted-chip', NOT_RUN:'muted-chip', EXCLUDED:'muted-chip', full:'ok', partial:'warn-chip', missing:'bad-chip' }[status] || 'muted-chip');
const displayStatus = status => status === 'SKIPPED-BLOCKED' ? 'BLOCKED' : status;
const chip = value => `<span class="chip ${statusClass(value)}">${esc(displayStatus(value))}</span>`;
const empty = text => `<div class="empty">${esc(text)}</div>`;
const kpi = (label, value, hint='', tone='') => `<article class="kpi ${tone}"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(hint)}</span></article>`;
const successRate = summary => summary?.executed ? (Number(summary.passed || 0) / Number(summary.executed) * 100) : 0;
const jiraHref = samId => `https://jira.secext.samsung.net/browse/${encodeURIComponent(String(samId || ''))}`;
const samLink = samId => `<a class="sam-link" href="${jiraHref(samId)}" target="_blank" rel="noopener">${esc(samId)}</a>`;

const OFFICIAL = {
  sourceTotal: 362,
  sourceP1: 144,
  activeP1: 143,
  p2: 218,
  excludedP1: 1,
  markets: {
    MX: { total: 92, sourceP1: 38, activeP1: 37, p2: 54, base: 56, baseSourceP1: 30, baseActiveP1: 29, baseP2: 26, epp: 36, eppP1: 8, eppP2: 28, excludedP1: 1 },
    PE: { total: 92, sourceP1: 34, activeP1: 34, p2: 58, base: 55, baseSourceP1: 28, baseActiveP1: 28, baseP2: 27, epp: 37, eppP1: 6, eppP2: 31, excludedP1: 0 },
    CL: { total: 89, sourceP1: 38, activeP1: 38, p2: 51, base: 53, baseSourceP1: 31, baseActiveP1: 31, baseP2: 22, epp: 36, eppP1: 7, eppP2: 29, excludedP1: 0 },
    CO: { total: 89, sourceP1: 34, activeP1: 34, p2: 55, base: 54, baseSourceP1: 28, baseActiveP1: 28, baseP2: 26, epp: 35, eppP1: 6, eppP2: 29, excludedP1: 0 },
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
function publishedPlaywrightHref(execution) {
  if (!execution?.buildUrl) return null;
  const base = String(execution.buildUrl).replace(/\/?$/, '/');
  const environment = /S2/i.test(String(execution.environment || '')) ? 'S2' : 'S1';
  const suite = /FAST/i.test(String(execution.suite || '')) ? 'Fast' : 'P1';
  return `${base}02_20_c2b7_20Samsung_20MX_20${environment}_20${suite}_20_c2b7_20Playwright/`;
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
  const seen = new Set();
  const links = [];
  for (const item of safe) {
    const kind = attachmentKind(item);
    if (kind === 'context') continue;
    let target = evidenceHref(execution, item.path);
    let label = 'Artifact';
    let icon = '↗';
    if (kind === 'trace') {
      target = publishedPlaywrightHref(execution) || target;
      label = target ? 'Open Playwright' : 'Trace';
      icon = '⌁';
    } else if (kind === 'screenshot') {
      label = 'Screenshot'; icon = '▣';
    } else if (kind === 'video') {
      label = 'Video'; icon = '▶';
    }
    if (!target) continue;
    const signature = `${kind}:${target}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    links.push(`<a class="evidence-link ${kind}" href="${esc(target)}" target="_blank" rel="noopener" title="${esc(item.name || path.basename(item.path))}"><span>${icon}</span>${label}</a>`);
  }
  return links.join('') || '<span class="no-evidence">See reason</span>';
}
function blockerCategory(test) {
  const text = `${test?.blockedReason || ''} ${test?.error || ''}`;
  if (/executable doesn.t exist|browser.*executable|ms-playwright|ffmpeg|spawn (eperm|enoent)|playwright.*install/i.test(text)) return 'Infrastructure / Playwright';
  if (/auth|session|login|logged|account|credential/i.test(text)) return 'Authentication / Session';
  if (/environment|staging|s1|backend|server|maintenance|unavailable|endpoint|cdp|network|unexpected URL.*\/cart|postal.*not found|delivery.*skeleton|timeout.*delivery/i.test(text)) return 'Environment / Backend';
  if (/sku|product|eligible|test data|address|order|email/i.test(text)) return 'Test Data / Prerequisite';
  if (/expect|assert|expected|received/i.test(text)) return 'Functional Assertion';
  if (/locator|selector|strict mode|element|click|fill/i.test(text)) return 'Automation / Selector';
  return test?.status === 'FAIL' ? 'Needs Triage' : 'Prerequisite';
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
  if (!rows.length) return '';
  return `<div class="attention-list">${rows.map(test => `<article><div>${samLink(test.samId)}<span>${esc(test.title || '')}</span></div>${chip(test.status)}<span class="category">${esc(blockerCategory(test))}</span><p>${esc(String(test.blockedReason || test.error || '').split('\n')[0])}</p><div class="evidence">${renderAttachments(execution, test.attachments)}</div></article>`).join('')}</div>`;
}
function renderExecution(execution) {
  if (!execution?.summary || !Array.isArray(execution.tests)) return empty('No real execution artifact was supplied.');
  const s = execution.summary;
  const reconciled = s.passed + s.failed + s.blocked + s.notRun === s.official;
  const rows = execution.tests.map(test => `<tr><td>${samLink(test.samId)}<small>${esc(test.title || '')}</small></td><td>${chip(test.status)}</td><td>${esc(blockerCategory(test))}</td><td>${duration(test.duration)}</td><td class="evidence">${renderAttachments(execution, test.attachments)}</td><td class="evidence-text" title="${esc(test.blockedReason || test.error || '')}">${esc(String(test.blockedReason || test.error || '').split('\n')[0])}</td></tr>`).join('');
  const ev = evidenceStats(execution);
  return `${executionMeta(execution,reconciled)}<div class="evidence-summary"><div><span class="section-kicker">EXECUTION EVIDENCE</span><strong>${ev.withEvidence} / ${s.official} TCs with evidence</strong><small>${ev.totalFiles} browser artifacts available in this runtime summary</small></div><div class="evidence-key"><span>▣ Screenshot</span><span>▶ Video</span><span>⌁ Playwright report / trace</span><span>Reason shown inline</span></div></div><div class="grid runtime-kpis">${kpi('Official selected',s.official,'Current build only')}${kpi('Executed',s.executed,'PASS + FAIL')}${kpi('PASS',s.passed,pct(s.passRate),'good')}${kpi('FAIL',s.failed,'Current build failures',s.failed?'bad':'')}${kpi('Blocked',s.blocked,'Known prerequisites',s.blocked?'warn':'')}${kpi('Duration',duration(s.duration),'Total runtime')}</div>${resultBar(s)}<div class="table-wrap execution-table"><table><thead><tr><th>Test case</th><th>Status</th><th>Category</th><th>Duration</th><th>Evidence</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function evidenceStats(execution) {
  const tests = Array.isArray(execution?.tests) ? execution.tests : [];
  const hasSafePath = item => item?.path && !/(^|\/)playwright\/\.auth(\/|$)/i.test(item.path);
  const withEvidence = tests.filter(test => Array.isArray(test.attachments) && test.attachments.some(hasSafePath)).length;
  const totalFiles = tests.reduce((sum,test) => sum + ((test.attachments || []).filter(hasSafePath).length), 0);
  return { withEvidence, totalFiles };
}
function renderFeatureRows(features) { return features.map(row => `<tr><td><strong>${esc(row.feature)}</strong><small>${row.baseStore} BS · ${row.epp} EPP</small></td><td>${row.total}</td><td>${row.full}</td><td>${row.partial}</td><td>${row.missing}</td><td>${pct(row.fullPercent)}</td></tr>`).join(''); }
function renderGaps(rows) { const top = rows.slice(0, 12); if (!top.length) return empty('No MX automation gaps.'); return top.map(row => `<tr><td>${samLink(row.id)}<small>${esc(row.title || '')}</small></td><td>${esc(row.feature || '')}</td><td>${esc(row.store || '')}</td><td>${chip(row.coverage)}</td></tr>`).join(''); }
function renderMarketFeatureMatrix(rows) { return rows.map(row => `<tr><td><strong>${esc(row.feature)}</strong></td>${['MX','CL','CO','PE'].map(m => { const v = row.markets[m]; return !v.total ? '<td class="muted-cell">—</td>' : `<td><b>${v.executed}/${v.total}</b><small>${v.pass} P · ${v.fail} F · ${v.blocked} B · ${v.pending} pending</small></td>`; }).join('')}</tr>`).join(''); }
function renderAudit(audit) { return audit.checks.map(check => `<tr><td>${check.ok ? chip('PASS') : chip('FAIL')}</td><td><strong>${esc(check.key)}</strong></td><td>${esc(check.detail)}</td></tr>`).join(''); }
function renderCatalog(rows) { return rows.map(row => `<tr><td>${samLink(row.id)}<small>${esc(row.title)}</small></td><td>${esc(row.market)}</td><td>${esc(row.feature)}</td><td>${esc(row.store)}</td><td>${row.scopeExcluded ? chip('EXCLUDED') : chip(row.status)}</td><td>${row.coverage ? chip(row.coverage) : '—'}</td><td>${esc(row.scopeExcluded ? 'historical-only' : row.context)}</td><td class="evidence-text">${esc(row.scopeExclusionReason || row.blocker || row.evidence || row.runtimePath || '')}</td></tr>`).join(''); }
function detail(title, subtitle, badge, content, open=false) {
  return `<details class="panel disclosure" ${open?'open':''}><summary><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><span class="tag">${esc(badge)}</span></summary><div class="detail-body">${content}</div></details>`;
}
function governanceItem(title, subtitle, badge, content) {
  return `<details class="governance-item"><summary><div><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div><span class="governance-badge">${esc(badge)}</span></summary><div class="governance-body">${content}</div></details>`;
}

function render(model) {
  const mx = model.automation;
  const execution = model.execution;
  const runtime = execution?.summary || null;
  const attentionCount = runtime ? Number(runtime.failed || 0) + Number(runtime.blocked || 0) : 0;
  const auditPassed = (model.audit?.checks || []).filter(check => check.ok).length;
  const auditTotal = (model.audit?.checks || []).length;
  const catalog = model.validation?.catalog || [];
  const health = runtime ? (runtime.failed ? 'ATTENTION' : runtime.blocked ? 'WATCH' : runtime.executed ? 'HEALTHY' : 'NO EXECUTION') : model.releaseHealth;
  const headline = runtime ? `${esc(execution.market || 'MX')} · ${esc(execution.environment || 'S1/STG')} · ${esc(execution.store || 'BASE_STORE')} · ${esc(execution.suite || 'P1/QST')} · Build #${esc(execution.buildNumber || 'local')}` : 'Samsung LATAM · SMB Commerce · Playwright';
  const scopeReference = `<div class="scope-explainer compact"><strong>Scope denominators</strong><span><b>${OFFICIAL.sourceP1} source P1 rows</b> preserved from the current LATAM templates</span><span><b>${OFFICIAL.activeP1} active P1/QST</b> after ${OFFICIAL.excludedP1} documented MX exclusion</span><span><b>${OFFICIAL.sourceTotal} source P1+P2 rows</b> complete LATAM priority model</span><span><b>${mx.official} MX Base Store P1</b> current active runner</span></div><div class="official-kpis compact-kpis">${kpi('Source SMB',OFFICIAL.sourceTotal,'Template rows')}${kpi('Active P1 / QST',OFFICIAL.activeP1,'1 MX exclusion')}${kpi('P2 / DST only',OFFICIAL.p2,'All LATAM markets')}${kpi('Current Runner',mx.official,'MX · Base Store')}</div><div class="market-strip">${Object.entries(OFFICIAL.markets).map(([market,m])=>`<span><b>${market}</b>${m.activeP1} active P1 · ${m.p2} P2${m.excludedP1 ? ` · ${m.excludedP1} excluded` : ''}</span>`).join('')}</div>`;
  const exclusionNote = (mx.excluded || []).map(item => `${item.id}: ${item.reason}`).join(' ');
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
  const governance = `
    <div class="governance-summary"><div><span class="section-kicker">TECHNICAL GOVERNANCE</span><strong>3 supporting views</strong><small>Historical evidence and consistency checks stay available without competing with current-build results.</small></div><div class="governance-stats"><span><b>${auditPassed}/${auditTotal}</b> audit checks</span><span><b>${catalog.length}</b> historical TCs</span><span><b>4</b> LATAM markets</span></div></div>
    ${governanceItem('Historical Regional Validation Matrix','Preserved 144-ID ledger by market and feature.','HISTORICAL',`<div class="static-note">This is the preserved historical 144-ID campaign. It is not the active 29-TC MX Base Store runner and it does not replace the current-build runtime.</div><div class="table-wrap"><table><thead><tr><th>Feature</th><th>MX</th><th>CL</th><th>CO</th><th>PE</th></tr></thead><tbody>${renderMarketFeatureMatrix(model.validation.marketFeatureMatrix)}</tbody></table></div>`)}
    ${governanceItem('Data Integrity','Automated consistency checks for reporting inputs.',model.audit.ok ? 'ALL CHECKS PASS' : 'CHECK REQUIRED',`<div class="audit-summary ${model.audit.ok?'audit-ok':'audit-check'}"><strong>${auditPassed} of ${auditTotal} validation checks passed</strong><span>Historical registry · active ${mx.official}-TC runner coverage · scope exclusions · canonical ledger statuses · known IDs</span></div><div class="table-wrap"><table><thead><tr><th>Result</th><th>Check</th><th>Detail</th></tr></thead><tbody>${renderAudit(model.audit)}</tbody></table></div>`)}
    ${governanceItem('Historical TC Archive',`Preserved ${catalog.length}-ID Zephyr campaign for audit/traceability.`,'ARCHIVE',`<div class="archive-summary"><strong>${catalog.length} historical rows retained</strong><span>Reference only. Scope-excluded rows are labeled EXCLUDED and do not count in the active runner.</span></div><div class="table-wrap historical-table"><table><thead><tr><th>TC</th><th>Market</th><th>Feature</th><th>Store</th><th>Historical status</th><th>Coverage</th><th>Context</th><th>Evidence / blocker</th></tr></thead><tbody>${renderCatalog(catalog)}</tbody></table></div>`)}
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Samsung SMB QA Automation</title><link rel="stylesheet" href="dashboard.css"><style>
body{background:#f6f8fb}.hero{background:linear-gradient(118deg,#071d3b 0%,#0b376d 64%,#0e4b8f 100%)}main{max-width:1480px}.panel,.overview{box-shadow:0 10px 28px rgba(18,43,75,.055);border-color:#e3e9f1}.presentation-final .tag{background:#eef4fb;color:#32516f}.market-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.market-strip span{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;border:1px solid #e5eaf1;border-radius:10px;background:#fafbfd;color:#66778c}.market-strip b{color:#16365b;font-size:14px}.scope-explainer.compact{margin-bottom:12px}.compact-kpis{grid-template-columns:repeat(4,1fr)}.governance-shell{border:1px solid #dbe4ef;background:#fff}.governance-shell>summary{padding:20px 22px}.governance-shell[open]>summary{border-bottom:1px solid #e6ebf2}.governance-shell>.detail-body{padding:0}.governance-summary{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:18px 22px;background:#f8fafc}.governance-summary strong{display:block;font-size:18px;margin:3px 0}.governance-summary small{display:block;color:#6e7e91}.governance-stats{display:flex;gap:10px;flex-wrap:wrap}.governance-stats span{padding:8px 11px;background:#fff;border:1px solid #e0e6ee;border-radius:9px;color:#6a7889}.governance-stats b{color:#17395f}.governance-item{border-top:1px solid #e7ebf1;background:#fff}.governance-item>summary{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 22px;cursor:pointer;list-style:none}.governance-item>summary::-webkit-details-marker{display:none}.governance-item>summary div strong{display:block;color:#18395e;font-size:15px}.governance-item>summary div span{display:block;color:#758497;margin-top:3px;font-size:12px}.governance-badge{font-size:10px;font-weight:700;letter-spacing:.05em;color:#60758e;background:#f0f4f8;padding:5px 8px;border-radius:999px}.governance-body{padding:0 22px 22px}.audit-summary,.archive-summary{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:12px 14px;border-radius:10px;margin-bottom:12px;background:#f7f9fc;color:#68788d}.audit-ok strong{color:#087b52}.audit-check strong{color:#a75e00}.archive-summary strong{color:#284a6d}.historical-table{max-height:480px;overflow:auto}.attention-panel{border-left:4px solid #c43b4d}.coverage-row{gap:12px}.coverage-box{background:#fafbfd}.detail-body{padding-top:14px}.report-footer{opacity:.8}.presentation-final .section-grid{grid-template-columns:1fr;gap:22px}.presentation-final .section-grid>.table-wrap,.presentation-final .section-grid>div{min-width:0}.presentation-final .section-grid table{width:100%}.presentation-final .evidence-link.trace{background:#eef4fb;color:#184c82}@media(max-width:900px){.market-strip,.compact-kpis{grid-template-columns:repeat(2,1fr)}.governance-summary{align-items:flex-start;flex-direction:column}}@media(max-width:600px){.market-strip,.compact-kpis{grid-template-columns:1fr}.governance-stats{display:grid;grid-template-columns:1fr;width:100%}}
</style></head><body class="presentation-final"><header class="hero"><div class="hero-row"><div><div class="eyebrow">Samsung · Quality Engineering · SMB</div><h1>QA Execution Dashboard</h1><p>${headline}</p></div><div class="health ${health.toLowerCase().replace(/\s+/g,'-')}"><span class="eyebrow">Current build health</span><strong>${esc(health)}</strong></div></div><div class="meta"><span>Generated ${esc(model.generatedAt)}</span><span>Source SMB ${OFFICIAL.sourceTotal}</span><span>Active P1/QST ${OFFICIAL.activeP1}</span><span>P2/DST ${OFFICIAL.p2}</span><span>${OFFICIAL.excludedP1} MX exclusion</span><span>Data audit ${model.audit.ok ? 'OK' : 'CHECK'}</span></div></header><main>
<section class="overview">
  <div class="overview-head"><div><span class="section-kicker">CURRENT BUILD</span><h2>Execution at a glance</h2></div><span class="tag">REAL PLAYWRIGHT RUNTIME</span></div>
  <div class="hero-kpis">${runtime ? heroCards : empty('No real execution artifact was supplied.')}</div>
  ${runtime ? resultBar(runtime) : ''}
</section>
${attentionCount ? `<section class="panel attention-panel"><div class="panel-title"><div><h2>Needs Attention</h2><p>Failures and known blockers only.</p></div><span class="tag">${attentionCount} ITEMS</span></div>${renderAttention(execution)}</section>` : ''}
${detail('Test Execution','Current-build TCs with status, duration and browser evidence.','CURRENT BUILD',renderExecution(execution),true)}
${detail('MX Base Store P1 Automation Coverage',`Current implementation maturity for the active ${mx.official}-TC MX Base Store P1 runner.`,`${mx.official}-TC RUNNER`,`<div class="coverage-row"><div class="coverage-box"><small>FULL</small><b>${mx.full ?? 'N/A'}</b></div><div class="coverage-box"><small>PARTIAL</small><b>${mx.partial ?? 'N/A'}</b></div><div class="coverage-box"><small>MISSING</small><b>${mx.missing ?? 'N/A'}</b></div><div class="coverage-box"><small>FULL COVERAGE</small><b>${pct(mx.fullPercent)}</b></div></div><div class="scope-note">Coverage is calculated only over the ${mx.official} active MX Base Store P1 IDs. ${mx.sourceMapped - mx.official} source-mapped case is excluded from active QST and preserved only for audit. Runtime PASS/FAIL remains a separate dimension.</div>${exclusionNote ? `<div class="static-note"><strong>Active-scope exclusion</strong> ${esc(exclusionNote)}</div>` : ''}`,true)}
${detail('Official SMB Scope','Source-template denominators and active QST scope after documented exclusions.','SCOPE',scopeReference,true)}
${detail('Coverage by Feature + Gap Queue',`Current ${mx.official}-TC active runner maturity and prioritized implementation gaps.`,'COVERAGE',`<div class="section-grid"><div><h3>MX Base Store P1 Coverage by Feature</h3><div class="table-wrap"><table><thead><tr><th>Feature</th><th>Total</th><th>Full</th><th>Partial</th><th>Missing</th><th>Full %</th></tr></thead><tbody>${renderFeatureRows(mx.features)}</tbody></table></div></div><div><h3>Automation Gap Queue</h3><div class="table-wrap"><table><thead><tr><th>TC</th><th>Feature</th><th>Store</th><th>Coverage</th></tr></thead><tbody>${renderGaps(mx.gaps)}</tbody></table></div></div></div>`,true)}
<details class="panel disclosure governance-shell"><summary><div><h2>Technical Governance</h2><p>Historical ledger, integrity audit and archived TC inventory — available on demand.</p></div><span class="tag">3 SECTIONS · ${model.audit.ok?'AUDIT OK':'CHECK'}</span></summary><div class="detail-body">${governance}</div></details>
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
module.exports = { render, evidenceHref, traceViewerHref, publishedPlaywrightHref, attachmentKind };