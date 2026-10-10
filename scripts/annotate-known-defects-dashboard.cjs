const fs = require('node:fs');
const path = require('node:path');

const artifactDir = path.resolve(process.argv[2] || process.env.JENKINS_ARTIFACT_DIR || process.env.MX_QST_ARTIFACT_DIR || 'test-results/jenkins/smb-suite');
const dashboardFile = path.join(artifactDir, 'executive', 'index.html');
const runtimeFile = path.join(artifactDir, 'runtime-summary.json');
const registryFile = path.resolve('governance/known-defects.json');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function normalizeEnvironment(value) {
  const text = String(value || '').toUpperCase();
  if (/S2|STG2|STAGING2|PREQA2/.test(text)) return 'S2';
  if (/S1|STG1|STAGING1/.test(text)) return 'S1';
  return text;
}

function normalizeStore(value) {
  return String(value || '').toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
}

function runtimeSamId(test) {
  return String(test?.samId || test?.id || test?.officialTc || '').toUpperCase();
}

function activeKnownDefects(runtime, registry) {
  if (!runtime || !Array.isArray(runtime.tests) || !Array.isArray(registry?.defects)) return [];
  const market = String(runtime.market || process.env.TEST_MARKET || process.env.MARKET || '').toUpperCase();
  const environment = normalizeEnvironment(runtime.environment || process.env.ENVIRONMENT);
  const store = normalizeStore(runtime.store || process.env.TEST_STORE || '');
  const actionableStatuses = new Set(['FAIL', 'BLOCKED', 'SKIPPED-BLOCKED']);

  return registry.defects.flatMap(defect => {
    const matchesScope = String(defect.market || '').toUpperCase() === market
      && normalizeEnvironment(defect.environment) === environment
      && (!defect.store || !store || normalizeStore(defect.store) === store);
    if (!matchesScope || String(defect.status || 'OPEN').toUpperCase() === 'CLOSED') return [];
    const test = runtime.tests.find(item => runtimeSamId(item) === String(defect.samId || '').toUpperCase());
    if (!test || !actionableStatuses.has(String(test.status || '').toUpperCase())) return [];
    return [{ defect, test }];
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function defectLink(defect) {
  return `<a class="defect-link" href="${escapeHtml(defect.url)}" target="_blank" rel="noopener" title="${escapeHtml(defect.title || defect.jira)}">${escapeHtml(defect.jira)} ↗</a>`;
}

function annotateRuntimeFragments(html, active) {
  let output = html;
  for (const { defect } of active) {
    const sam = escapeHtml(defect.samId);
    const link = defectLink(defect);
    const mutate = fragment => {
      let next = fragment;
      next = next.replace(/<span class="chip (?:warn-chip|bad-chip)">(?:BLOCKED|FAIL)<\/span>/, '<span class="chip defect-chip">KNOWN DEFECT</span>');
      next = next.replace(/<span class="category">[^<]*<\/span>/, '<span class="category defect-category">Known Functional Defect</span>');
      if (!next.includes(`>${escapeHtml(defect.jira)} ↗</a>`)) {
        next = next.replace(new RegExp(`(>${sam}<\\/a>)`), `$1${link}`);
      }
      return next;
    };

    output = output.replace(/<article\b[^>]*>[\s\S]*?<\/article>/g, fragment => {
      if (!fragment.includes(`>${sam}</a>`) || !/chip (?:warn-chip|bad-chip)/.test(fragment)) return fragment;
      const annotated = mutate(fragment);
      return annotated.replace('<article>', `<article class="known-defect" data-defect="${escapeHtml(defect.jira)}">`)
        .replace(/<article class="([^"]*)">/, `<article class="$1 known-defect" data-defect="${escapeHtml(defect.jira)}">`);
    });

    output = output.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/g, fragment => {
      if (!fragment.includes(`>${sam}</a>`) || !/chip (?:warn-chip|bad-chip)/.test(fragment)) return fragment;
      const annotated = mutate(fragment);
      return annotated.replace('<tr>', `<tr class="known-defect-row" data-defect="${escapeHtml(defect.jira)}">`)
        .replace(/<tr class="([^"]*)">/, `<tr class="$1 known-defect-row" data-defect="${escapeHtml(defect.jira)}">`);
    });
  }
  return output;
}

function splitResultDistribution(html, runtime, active) {
  const summary = runtime?.summary || {};
  const rawBlocked = Number(summary.blocked || 0);
  const rawFailed = Number(summary.failed || 0);
  const official = Number(summary.official || 0) || 1;
  const knownBlocked = active.filter(({ test }) => ['BLOCKED', 'SKIPPED-BLOCKED'].includes(String(test.status || '').toUpperCase())).length;
  const knownFailed = active.filter(({ test }) => String(test.status || '').toUpperCase() === 'FAIL').length;
  const known = knownBlocked + knownFailed;
  if (!known) return html;
  const otherBlocked = Math.max(0, rawBlocked - knownBlocked);
  const otherFailed = Math.max(0, rawFailed - knownFailed);
  const knownWidth = known / official * 100;
  const blockedWidth = otherBlocked / official * 100;
  const failedWidth = otherFailed / official * 100;

  let output = html;
  if (rawBlocked) {
    const blockedSegment = new RegExp(`<span class="blocked" style="width:[^"]+" title="BLOCKED: ${rawBlocked}"><\\/span>`, 'g');
    const pieces = `${otherBlocked ? `<span class="blocked" style="width:${blockedWidth}%" title="BLOCKED: ${otherBlocked}"></span>` : ''}<span class="defect" style="width:${knownWidth}%" title="KNOWN DEFECT: ${known}"></span>`;
    output = output.replace(blockedSegment, pieces);
    output = output.replace(new RegExp(`<span><i class="blocked"><\\/i><b>${rawBlocked}<\\/b> BLOCKED<\\/span>`, 'g'), `${otherBlocked ? `<span><i class="blocked"></i><b>${otherBlocked}</b> BLOCKED</span>` : ''}<span><i class="defect"></i><b>${known}</b> KNOWN DEFECT</span>`);
  }
  if (knownFailed && rawFailed) {
    output = output.replace(new RegExp(`<span class="fail" style="width:[^"]+" title="FAIL: ${rawFailed}"><\\/span>`, 'g'), `${otherFailed ? `<span class="fail" style="width:${failedWidth}%" title="FAIL: ${otherFailed}"></span>` : ''}<span class="defect" style="width:${knownWidth}%" title="KNOWN DEFECT: ${known}"></span>`);
    output = output.replace(new RegExp(`<span><i class="fail"><\\/i><b>${rawFailed}<\\/b> FAIL<\\/span>`, 'g'), `${otherFailed ? `<span><i class="fail"></i><b>${otherFailed}</b> FAIL</span>` : ''}<span><i class="defect"></i><b>${known}</b> KNOWN DEFECT</span>`);
  }
  return output;
}

function splitKpis(html, runtime, active) {
  const summary = runtime?.summary || {};
  const rawBlocked = Number(summary.blocked || 0);
  const rawFailed = Number(summary.failed || 0);
  const knownBlocked = active.filter(({ test }) => ['BLOCKED', 'SKIPPED-BLOCKED'].includes(String(test.status || '').toUpperCase())).length;
  const knownFailed = active.filter(({ test }) => String(test.status || '').toUpperCase() === 'FAIL').length;
  const known = knownBlocked + knownFailed;
  const otherBlocked = Math.max(0, rawBlocked - knownBlocked);
  const otherFailed = Math.max(0, rawFailed - knownFailed);
  if (!known) return html;

  const knownCard = `<article class="kpi defect-kpi"><small>Known Defect</small><b>${known}</b><span>Mapped Jira bug${known === 1 ? '' : 's'}</span></article>`;
  let output = html;
  if (rawBlocked) {
    output = output.replace(new RegExp(`<article class="kpi warn"><small>Blocked<\\/small><b>${rawBlocked}<\\/b><span>Known prerequisites<\\/span><\\/article>`, 'g'), `${otherBlocked ? `<article class="kpi warn"><small>Blocked</small><b>${otherBlocked}</b><span>Other prerequisites</span></article>` : ''}${knownCard}`);
  } else {
    output = output.replace(/(<div class="hero-kpis">)/, `$1${knownCard}`);
  }
  if (knownFailed && rawFailed) {
    output = output.replace(new RegExp(`<article class="kpi bad"><small>Failed<\\/small><b>${rawFailed}<\\/b><span>Current build<\\/span><\\/article>`, 'g'), `${otherFailed ? `<article class="kpi bad"><small>Failed</small><b>${otherFailed}</b><span>Current build</span></article>` : ''}${knownCard}`);
    output = output.replace(new RegExp(`<article class="kpi bad"><small>FAIL<\\/small><b>${rawFailed}<\\/b><span>Current build failures<\\/span><\\/article>`, 'g'), `${otherFailed ? `<article class="kpi bad"><small>FAIL</small><b>${otherFailed}</b><span>Current build failures</span></article>` : ''}${knownCard}`);
  }
  return output;
}

function injectKnownDefectPanel(html, active) {
  if (!active.length || html.includes('known-defect-registry')) return html;
  const items = active.map(({ defect, test }) => `<article><div><strong>${escapeHtml(defect.samId)}</strong><span>${escapeHtml(test.title || defect.title)}</span></div><span class="chip defect-chip">KNOWN DEFECT</span><div class="defect-meta">${defectLink(defect)}<span>${escapeHtml(defect.priority || '')}</span><span>${escapeHtml(defect.status || 'OPEN')}</span><span>${escapeHtml(defect.rootCause || '')}</span></div><p>${escapeHtml(defect.notes || defect.title || '')}</p></article>`).join('');
  const panel = `<section class="known-defect-registry"><div><span class="section-kicker">TRACKED DEFECTS</span><h3>Known defects mapped to this execution</h3><small>Runtime truth is preserved; this view separates mapped product/environment defects from generic blockers.</small></div><div class="known-defect-items">${items}</div></section>`;
  return html.replace('<div class="table-wrap execution-table">', `${panel}<div class="table-wrap execution-table">`);
}

function injectStyles(html) {
  if (html.includes('--defect:#7047c7')) return html;
  const css = `<style id="known-defect-style">:root{--defect:#7047c7;--defect-soft:#f3edff;--defect-line:#cbb9f4}.chip.defect-chip{background:var(--defect-soft);color:#5932aa;border:1px solid var(--defect-line)}.result-bar span.defect{background:var(--defect)}.result-legend i.defect{background:var(--defect)}.kpi.defect-kpi{border-color:var(--defect-line);background:linear-gradient(145deg,#fff,var(--defect-soft))}.kpi.defect-kpi b{color:var(--defect)}.defect-link{display:inline-flex;margin-left:7px;padding:3px 7px;border-radius:999px;background:var(--defect-soft);border:1px solid var(--defect-line);color:#5932aa!important;font-size:9px;font-weight:800;text-decoration:none}.defect-link:hover{background:#e9ddff}.attention-list article.known-defect{border-color:var(--defect-line);box-shadow:inset 4px 0 0 var(--defect)}.known-defect-row td:first-child{box-shadow:inset 3px 0 0 var(--defect)}.defect-category{color:#5932aa!important}.known-defect-registry{margin:16px 0;padding:16px;border:1px solid var(--defect-line);border-radius:12px;background:linear-gradient(145deg,#fff 0,#faf7ff 100%)}.known-defect-registry h3{margin:4px 0;font-size:15px}.known-defect-registry>div>small{color:#69778d}.known-defect-items{display:grid;gap:8px;margin-top:12px}.known-defect-items article{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:7px 12px;padding:12px;border:1px solid #e0d5f8;border-radius:10px;background:#fff}.known-defect-items article strong,.known-defect-items article span{display:block}.known-defect-items article div:first-child span{font-size:10px;color:#69778d;margin-top:2px}.known-defect-items .defect-meta{grid-column:1/-1;display:flex;gap:7px;align-items:center;flex-wrap:wrap}.known-defect-items .defect-meta .defect-link{margin-left:0}.known-defect-items .defect-meta>span{font-size:9px;padding:3px 7px;border-radius:999px;background:#f3f5f8;color:#59697e}.known-defect-items p{grid-column:1/-1;margin:0;color:#69778d;font-size:10px}.hero-kpis,.runtime-kpis{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}</style>`;
  return html.replace('</head>', `${css}</head>`);
}

function annotateDashboard({ artifactDir: inputArtifactDir = artifactDir } = {}) {
  const resolvedArtifactDir = path.resolve(inputArtifactDir);
  const dashboard = path.join(resolvedArtifactDir, 'executive', 'index.html');
  const runtimePath = path.join(resolvedArtifactDir, 'runtime-summary.json');
  const runtime = readJson(runtimePath);
  const registry = readJson(registryFile);
  if (!fs.existsSync(dashboard) || !runtime || !registry) {
    return { annotated: false, count: 0, reason: 'missing dashboard/runtime/registry' };
  }
  const active = activeKnownDefects(runtime, registry);
  if (!active.length) return { annotated: false, count: 0, reason: 'no active mapped defect in runtime' };

  let html = fs.readFileSync(dashboard, 'utf8');
  html = annotateRuntimeFragments(html, active);
  html = splitResultDistribution(html, runtime, active);
  html = splitKpis(html, runtime, active);
  html = injectKnownDefectPanel(html, active);
  html = injectStyles(html);
  fs.writeFileSync(dashboard, html);
  return { annotated: true, count: active.length, defects: active.map(({ defect }) => defect.jira) };
}

if (require.main === module) {
  const result = annotateDashboard();
  console.log(`[known-defects] ${result.annotated ? 'Annotated' : 'No annotation'} · ${result.count} mapped defect(s)${result.defects?.length ? ` · ${result.defects.join(', ')}` : ''}${result.reason ? ` · ${result.reason}` : ''}`);
}

module.exports = { normalizeEnvironment, activeKnownDefects, annotateDashboard };
