#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const stripAnsi = value => String(value ?? '').replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '');
const redact = value => stripAnsi(value).replace(/(password|passwd|token|authorization|cookie|secret|api_?key|card_?number|cvv|cvc)(\s*[=:]\s*)["']?[^\s,;\]}]+/gi, '$1$2[REDACTED]');
const duration = (ms = 0) => ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`;
const percent = (value, total) => total ? `${(value / total * 100).toFixed(1)}%` : 'N/A';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
  catch { return null; }
}

function safeArtifact(file, outputRoot) {
  if (!file) return null;
  return path.relative(outputRoot, path.resolve(file)).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}

function buildModel(evidence = {}, smb = null, mx = null) {
  const raw = Array.isArray(evidence.tests) ? evidence.tests : [];
  const clean = raw.filter(test => !/[\\/]reporter-tests[\\/]/i.test(test.specFile || ''));
  const unique = new Map();
  for (const test of clean) unique.set(test.testId || JSON.stringify(test.titlePath || test.title), test);
  const tests = [...unique.values()].map(test => {
    const coverage = mx?.cases?.[test.zephyrId];
    return {
      ...test,
      coverage: coverage?.coverage || 'unmapped',
      officialSummary: coverage?.test || test.title || 'Untitled test',
    };
  });
  const passed = tests.filter(test => test.result === 'passed').length;
  const failed = tests.filter(test => ['failed', 'timedOut'].includes(test.result)).length;
  const flaky = tests.filter(test => test.flaky).length;
  return {
    execution: evidence.execution || {},
    summary: { ...evidence.summary, total: tests.length, passed, failed, flaky },
    tests,
    health: !tests.length ? 'N/A' : failed ? 'FAILED' : flaky ? 'ATTENTION' : 'PASSED',
    excluded: raw.length - clean.length,
    official: {
      total: smb?.total ?? null,
      markets: Object.fromEntries(Object.entries(smb?.markets || {}).map(([market, value]) => [market, value.count])),
      mxTotal: mx?.officialTotal ?? smb?.markets?.MX?.count ?? null,
      full: mx?.summary?.full ?? null,
      partial: mx?.summary?.partial ?? null,
      missing: mx?.summary?.missing ?? null,
    },
  };
}

function badge(value, css = value) {
  return `<span class="badge ${esc(css)}">${esc(value)}</span>`;
}

function generateHtml(evidence, outputRoot, mappings = {}) {
  const model = buildModel(evidence, mappings.smb, mappings.mx);
  const { tests, summary, execution, official } = model;
  const markets = [...new Set([...Object.keys(official.markets), ...tests.map(test => test.market).filter(Boolean)])];
  const groups = key => Object.entries(tests.reduce((acc, test) => {
    (acc[test[key] || 'Unmapped'] ||= []).push(test);
    return acc;
  }, {}));

  const marketCards = markets.map(market => {
    const rows = tests.filter(test => test.market === market);
    const passed = rows.filter(test => test.result === 'passed').length;
    const failed = rows.filter(test => ['failed', 'timedOut'].includes(test.result)).length;
    return `<article class="market"><header><strong>${esc(market)}</strong>${rows.length ? badge(`${percent(passed, rows.length)} pass`, 'passed') : badge('Not executed', 'neutral')}</header><dl><dt>Official</dt><dd>${official.markets[market] ?? 'N/A'}</dd><dt>Executed</dt><dd>${rows.length}</dd><dt>Passed</dt><dd>${passed}</dd><dt>Failed</dt><dd>${failed}</dd></dl></article>`;
  }).join('');

  const breakdown = key => groups(key).map(([name, rows]) => {
    const passed = rows.filter(test => test.result === 'passed').length;
    return `<article class="break"><div><strong>${esc(name)}</strong><span>${passed}/${rows.length} passed</span></div><progress max="${rows.length}" value="${passed}"></progress><small>${percent(passed, rows.length)}</small></article>`;
  }).join('') || '<p class="empty">No execution metadata.</p>';

  const rows = tests.map(test => {
    const artifacts = (test.attachments || []).map(attachment => {
      const href = safeArtifact(attachment.path, outputRoot);
      return href ? `<a href="${esc(href)}">${esc(attachment.name || 'artifact')}</a>` : '';
    }).filter(Boolean).join(' · ');
    const error = redact(test.error?.message || '');
    return `<details class="case" data-market="${esc(test.market || '')}" data-result="${esc(test.result || '')}" data-feature="${esc(test.feature || 'Unmapped')}" data-store="${esc(test.store || 'Unmapped')}" data-coverage="${esc(test.coverage)}" data-duration="${Number(test.durationMs || 0)}" data-zephyr="${esc(test.zephyrId || '')}" data-search="${esc([test.zephyrId, test.officialSummary, test.orderCode].join(' ').toLowerCase())}"><summary><strong>${esc(test.zephyrId || 'Unmapped')}</strong><span>${esc(test.officialSummary)}</span><span>${esc(test.market || '—')}</span><span>${esc(test.store || 'Unmapped')}</span>${badge(test.coverage, test.coverage)}${badge(test.flaky ? 'flaky' : test.result, test.flaky ? 'flaky' : test.result)}<span>${duration(test.durationMs)}</span></summary><section>${artifacts ? `<p><b>Artifacts:</b> ${artifacts}</p>` : ''}${error ? `<aside>${esc(error.split('\n')[0])}</aside>` : '<p>No failure reason.</p>'}</section></details>`;
  }).join('') || '<p class="empty">No real execution evidence. Internal reporter fixtures are excluded.</p>';

  const failures = tests.filter(test => ['failed', 'timedOut'].includes(test.result)).map(test => `<article><strong>${esc(test.zephyrId || 'Unmapped')} · ${esc(test.officialSummary)}</strong>${badge(test.result, test.result)}<p>${esc(redact(test.error?.message || 'No error').split('\n')[0])}</p></article>`).join('') || '<p class="empty">No failures in final results.</p>';
  const scope = [...new Set(tests.map(test => test.market).filter(Boolean))].join(', ') || 'N/A';
  const suite = [...new Set(tests.map(test => test.suite).filter(Boolean))].join(', ') || 'N/A';

  const css = `
:root{--navy:#071d3b;--blue:#1769d2;--ink:#17233a;--muted:#6d7a90;--line:#dfe6f0;--green:#087b52;--red:#b5293b;--amber:#a76500;--bg:#f4f7fb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px Segoe UI,Arial,sans-serif}.hero{padding:32px max(24px,calc((100vw - 1480px)/2)) 72px;background:linear-gradient(120deg,var(--navy),#145092);color:#fff}.hero-top{display:flex;justify-content:space-between;gap:24px}.hero h1{margin:0;font-size:30px}.hero p,.meta{color:#d9e8f8}.health{text-align:right}.health b{display:block;font-size:28px}.PASSED b{color:#65dfaa}.ATTENTION b{color:#ffcb69}.FAILED b{color:#ff8f9b}.meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:18px}.wrap{max-width:1480px;margin:-45px auto 0;padding:0 28px 36px}.grid{display:grid;gap:14px}.kpis{grid-template-columns:repeat(6,minmax(0,1fr))}.kpi,.panel{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 24px rgba(20,45,75,.05)}.kpi{padding:18px}.kpi small{display:block;color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:.04em}.kpi b{display:block;font-size:25px;margin-top:6px}.panel{padding:22px;margin-top:18px}.panel h2{margin:0 0 14px}.coverage{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.market-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.market,.break{border:1px solid var(--line);border-radius:12px;padding:14px}.market header,.break>div{display:flex;justify-content:space-between;gap:12px}.market dl{display:grid;grid-template-columns:1fr 1fr}.market dd{font-weight:700;font-size:17px}.split{display:grid;grid-template-columns:1fr 1fr;gap:18px}.break-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.break progress{width:100%;height:9px}.badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#edf2f7;font-size:11px}.passed,.full{background:#ddf5e9;color:var(--green)}.failed,.timedOut,.missing{background:#fde4e7;color:var(--red)}.partial,.flaky{background:#fff0d0;color:var(--amber)}.filters{display:grid;grid-template-columns:repeat(5,1fr) 2fr 120px;gap:8px;margin-bottom:12px}.filters select,.filters input{width:100%;padding:9px;border:1px solid var(--line);border-radius:8px;background:#fff}.case{border-top:1px solid var(--line)}.case>summary{display:grid;grid-template-columns:95px minmax(260px,1fr) 55px 80px 80px 80px 65px;gap:10px;align-items:center;padding:13px 4px;cursor:pointer}.case>section{padding:14px;background:#f8fafc;border-radius:10px;margin-bottom:10px}.case aside{border-left:4px solid var(--red);padding:10px;background:#fff5f6}.failures article{padding:12px;margin:8px 0;border-left:4px solid var(--red);background:#fff7f8}.failures .badge{float:right}.empty{color:var(--muted)}footer{text-align:center;color:var(--muted);padding:22px}.note{color:var(--muted)}
@media(max-width:1000px){.kpis,.coverage{grid-template-columns:repeat(3,1fr)}.market-grid{grid-template-columns:repeat(2,1fr)}.split{grid-template-columns:1fr}.filters{grid-template-columns:repeat(3,1fr)}}
@media(max-width:650px){.kpis,.coverage,.market-grid,.filters{grid-template-columns:1fr 1fr}.wrap{padding:0 12px}.case>summary{grid-template-columns:95px 1fr 70px}.case>summary>*:nth-child(n+4){display:none}}
`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Samsung SMB QA Automation</title><style>${css}</style></head><body><header class="hero"><div class="hero-top"><div><h1>Samsung SMB QA Automation</h1><p>Executive Quality Engineering Dashboard</p></div><div class="health ${model.health}"><small>RELEASE HEALTH</small><b>${model.health}</b></div></div><div class="meta"><span>Environment: ${esc(execution.environment || 'N/A')}</span><span>Release: ${esc(execution.release || 'N/A')}</span><span>Cycle: ${esc(execution.cycle || 'N/A')}</span><span>Executed: ${esc(execution.timestamp || 'N/A')}</span><span>Market scope: ${esc(scope)}</span><span>Suite: ${esc(suite)}</span></div></header><main class="wrap"><section class="grid kpis"><article class="kpi"><small>Tests Executed</small><b>${summary.total}</b></article><article class="kpi"><small>Passed</small><b>${summary.passed}</b></article><article class="kpi"><small>Failed</small><b>${summary.failed}</b></article><article class="kpi"><small>Pass Rate</small><b>${percent(summary.passed, summary.total)}</b></article><article class="kpi"><small>Flaky</small><b>${summary.flaky}</b></article><article class="kpi"><small>Execution Time</small><b>${duration(summary.durationMs)}</b></article></section><section class="panel"><h2>Official Coverage</h2><p class="note">Independent from execution results; sourced from official mappings.</p><div class="coverage"><article class="kpi"><small>Official SMB TCs</small><b>${official.total ?? 'N/A'}</b></article><article class="kpi"><small>Official MX TCs</small><b>${official.mxTotal ?? 'N/A'}</b></article><article class="kpi"><small>Full Coverage</small><b>${official.full ?? 'N/A'}</b></article><article class="kpi"><small>Partial Coverage</small><b>${official.partial ?? 'N/A'}</b></article><article class="kpi"><small>Missing</small><b>${official.missing ?? 'N/A'}</b></article><article class="kpi"><small>Full Coverage %</small><b>${official.full == null ? 'N/A' : percent(official.full, official.mxTotal)}</b></article></div></section><section class="panel"><h2>Market Overview</h2><div class="market-grid">${marketCards}</div></section><div class="split"><section class="panel"><h2>Execution by Feature</h2><div class="break-grid">${breakdown('feature')}</div></section><section class="panel"><h2>Execution by Store</h2><div class="break-grid">${breakdown('store')}</div></section></div><section class="panel"><h2>Latest Execution / Test Cases</h2><div class="filters"><select id="market"><option value="">All markets</option>${markets.map(value => `<option>${esc(value)}</option>`).join('')}</select><select id="result"><option value="">All results</option><option>passed</option><option>failed</option><option>skipped</option></select><select id="feature"><option value="">All features</option>${groups('feature').map(([value]) => `<option>${esc(value)}</option>`).join('')}</select><select id="store"><option value="">All stores</option>${groups('store').map(([value]) => `<option>${esc(value)}</option>`).join('')}</select><select id="coverage"><option value="">All coverage</option><option>full</option><option>partial</option><option>missing</option><option>unmapped</option></select><input id="search" placeholder="SAM ID, test or order"><select id="sort"><option value="zephyr">Sort: Zephyr</option><option value="result">Result</option><option value="duration">Duration</option><option value="market">Market</option></select></div><div id="cases">${rows}</div></section><section class="panel"><h2>Failures</h2><div class="failures">${failures}</div></section></main><footer>Execution and coverage are intentionally independent · ${model.excluded} internal result(s) excluded</footer><script>const controls=[...document.querySelectorAll('.filters select,.filters input')],box=document.querySelector('#cases');function apply(){const values=Object.fromEntries(controls.map(control=>[control.id,control.value.toLowerCase()])),cases=[...box.querySelectorAll('.case')];cases.forEach(row=>row.hidden=!!(['market','result','feature','store','coverage'].some(key=>values[key]&&row.dataset[key].toLowerCase()!==values[key])||(values.search&&!row.dataset.search.includes(values.search))));cases.sort((a,b)=>values.sort==='duration'?+b.dataset.duration-+a.dataset.duration:(a.dataset[values.sort]||'').localeCompare(b.dataset[values.sort]||''));cases.forEach(row=>box.appendChild(row))}controls.forEach(control=>control.addEventListener('input',apply));apply();</script></body></html>`;
}

function generateExecutiveReport(options = {}) {
  const inputPath = options.inputPath || 'test-results/evidence/qst-evidence.json';
  const outputPath = path.resolve(options.outputPath || 'test-results/executive/index.html');
  const evidence = readJson(inputPath) || { execution: {}, summary: {}, tests: [] };
  const mappings = {
    smb: readJson(options.smbMappingPath || 'governance/smb-qst.json'),
    mx: readJson(options.mxCoveragePath || 'governance/mx-qst-coverage.json'),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generateHtml(evidence, path.dirname(outputPath), mappings));
  return {
    outputPath,
    hasEvidence: evidence.tests?.some(test => !/[\\/]reporter-tests[\\/]/i.test(test.specFile || '')),
  };
}

if (require.main === module) {
  const result = generateExecutiveReport();
  console.log(result.outputPath + (result.hasEvidence ? '' : ' (generated without real execution evidence)'));
}

module.exports = { esc, stripAnsi, redact, readJson, safeArtifact, buildModel, generateHtml, generateExecutiveReport };
