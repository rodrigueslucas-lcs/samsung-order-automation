#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const registry = require("../../test-mapping/smb-qst.json");
const ledger = require("../../test-mapping/preqa2-validation.json");
const mxCoverage = require("../../test-mapping/mx-qst-coverage.json");
const peReuse = require("../../test-mapping/pe-qst-reuse-plan.json");
const { validatePreqa2ValidationLedger } = require("../../utils/preqa2ValidationLedger");
const { validateS1OfficialImplementation } = require("../../utils/qstS1Implementation");
const { sanitizeString } = require("../evidence/sanitizer");

const MARKETS = Object.freeze(["MX", "CL", "CO", "PE"]);
const RESULT_STATES = Object.freeze(["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE"]);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function pct(value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

function metadataFor(market, id) {
  if (market === "MX") {
    const item = mxCoverage.cases?.[id];
    return item ? {
      title: item.title,
      store: item.store,
      feature: item.feature,
      baseline: item.coverage,
    } : {};
  }
  if (market === "PE") {
    const item = peReuse.cases?.[id];
    return item ? {
      title: item.title,
      store: item.store,
      feature: item.feature,
      baseline: item.reuse,
    } : {};
  }
  return {};
}

function buildPreqa2Model({ sourceLedger = ledger } = {}) {
  validatePreqa2ValidationLedger();
  const implementation = validateS1OfficialImplementation();
  const markets = {};
  const rows = [];

  for (const market of MARKETS) {
    const official = registry.markets[market].cases;
    const results = sourceLedger.markets?.[market]?.results || {};
    const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_APPLICABLE: 0 };

    for (const id of official) {
      const result = results[id];
      if (result && RESULT_STATES.includes(result.status)) counts[result.status] += 1;
      const meta = metadataFor(market, id);
      rows.push({
        market,
        id,
        title: result?.title || meta.title || null,
        store: result?.store || meta.store || "Unknown",
        feature: result?.feature || meta.feature || "Unknown",
        baseline: meta.baseline || "unclassified",
        status: result?.status || "NOT_RUN",
        context: result?.context || "unknown",
        runtimePath: result?.runtimePath || null,
        evidence: result?.evidence || null,
        blocker: result?.blocker || null,
        automation: result?.automation || (implementation[market].implementedIds.includes(id) ? "implemented" : "not-implemented"),
        validatedAt: result?.validatedAt || null,
      });
    }

    const executed = Object.keys(results).length;
    markets[market] = {
      officialTotal: official.length,
      executed,
      notRun: official.length - executed,
      implemented: implementation[market].implementedCount,
      ...counts,
      passRate: executed ? pct(counts.PASS, executed) : "0.0%",
    };
  }

  const total = Object.values(markets).reduce((sum, item) => sum + item.officialTotal, 0);
  const executed = Object.values(markets).reduce((sum, item) => sum + item.executed, 0);
  const passed = Object.values(markets).reduce((sum, item) => sum + item.PASS, 0);
  const failed = Object.values(markets).reduce((sum, item) => sum + item.FAIL, 0);
  const blocked = Object.values(markets).reduce((sum, item) => sum + item.BLOCKED, 0);

  return {
    environment: "PREQA2",
    authority: sourceLedger.authority,
    total,
    executed,
    passed,
    failed,
    blocked,
    notRun: total - executed,
    completion: pct(executed, total),
    passRate: executed ? pct(passed, executed) : "0.0%",
    markets,
    rows,
  };
}

function renderStatus(status) {
  return `<span class="badge ${esc(status.toLowerCase().replace(/_/g, "-"))}">${esc(status)}</span>`;
}

function generatePreqa2Html(model) {
  const marketCards = MARKETS.map((market) => {
    const item = model.markets[market];
    return `<article class="market"><header><strong>${market}</strong>${renderStatus(item.executed ? "ACTIVE" : "NOT_RUN")}</header>
      <dl><dt>Official</dt><dd>${item.officialTotal}</dd><dt>Executed</dt><dd>${item.executed}</dd><dt>PASS</dt><dd>${item.PASS}</dd><dt>FAIL</dt><dd>${item.FAIL}</dd><dt>Blocked</dt><dd>${item.BLOCKED}</dd><dt>Automation</dt><dd>${item.implemented}</dd></dl>
      <div class="bar"><i style="width:${item.officialTotal ? item.executed / item.officialTotal * 100 : 0}%"></i></div>
      <small>${pct(item.executed, item.officialTotal)} executed · ${item.passRate} pass rate on executed TCs</small>
    </article>`;
  }).join("");

  const rows = model.rows.map((row) => {
    const evidence = row.evidence ? sanitizeString(row.evidence) : "";
    const blocker = row.blocker ? sanitizeString(row.blocker) : "";
    const search = [row.id, row.title, row.market, row.store, row.feature, row.status].filter(Boolean).join(" ").toLowerCase();
    return `<details class="case" data-market="${esc(row.market)}" data-status="${esc(row.status)}" data-store="${esc(row.store)}" data-feature="${esc(row.feature)}" data-search="${esc(search)}">
      <summary><b>${esc(row.id)}</b><span>${esc(row.title || "Official title not populated locally")}</span><span>${esc(row.market)}</span><span>${esc(row.store)}</span><span>${esc(row.feature)}</span>${renderStatus(row.status)}</summary>
      <section><dl>
        <dt>Baseline</dt><dd>${esc(row.baseline)}</dd><dt>Context</dt><dd>${esc(row.context)}</dd>
        <dt>Automation</dt><dd>${esc(row.automation)}</dd><dt>Runtime path</dt><dd>${esc(row.runtimePath || "—")}</dd>
        <dt>Validated at</dt><dd>${esc(row.validatedAt || "—")}</dd>
      </dl>${evidence ? `<p><b>Evidence:</b> ${esc(evidence)}</p>` : ""}${blocker ? `<p class="blocker"><b>Blocker:</b> ${esc(blocker)}</p>` : ""}</section>
    </details>`;
  }).join("");

  const failures = model.rows.filter((row) => ["FAIL", "BLOCKED"].includes(row.status)).map((row) =>
    `<article><b>${esc(row.id)} · ${esc(row.title || "Official TC")}</b>${renderStatus(row.status)}<p>${esc(sanitizeString(row.blocker || row.evidence || "No summary recorded"))}</p></article>`
  ).join("") || `<p class="empty">No PreQA2 failures or blockers recorded.</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Samsung SMB PreQA2 Validation</title><style>
  :root{--navy:#071d3b;--blue:#1469df;--ink:#17233a;--muted:#6c788c;--line:#dfe6f0;--green:#087f52;--red:#b5293b;--amber:#a76600;--bg:#f2f5fa}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px Segoe UI,Arial,sans-serif}.hero{background:linear-gradient(120deg,var(--navy),#145092);color:#fff;padding:32px max(24px,calc((100vw - 1480px)/2)) 74px}.hero h1{margin:0;font-size:30px}.hero p{color:#dce9f8;max-width:980px}.meta{display:flex;gap:24px;flex-wrap:wrap;margin-top:18px;color:#dce9f8}main{max-width:1536px;margin:-44px auto 0;padding:0 28px 36px}.grid{display:grid;gap:14px}.kpis{grid-template-columns:repeat(6,1fr)}.kpi,.panel,.market{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 7px 22px #17365d0d}.kpi{padding:17px}.kpi small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase}.kpi b{font-size:25px}.good b{color:var(--green)}.bad b{color:var(--red)}.panel{padding:22px;margin-top:18px}.panel h2{margin:0 0 14px}.markets{grid-template-columns:repeat(4,1fr)}.market{padding:16px}.market header{display:flex;justify-content:space-between;align-items:center}.market dl{display:grid;grid-template-columns:1fr 1fr}.market dd{font-weight:700;font-size:17px}.bar{height:8px;background:#e8edf4;border-radius:8px;overflow:hidden}.bar i{display:block;height:100%;background:var(--blue)}small,.empty{color:var(--muted)}.badge{display:inline-block;padding:3px 8px;border-radius:99px;background:#edf1f6;font-size:11px}.pass{background:#dff5eb;color:var(--green)}.fail{background:#fde5e8;color:var(--red)}.blocked{background:#fff0d3;color:var(--amber)}.not-run,.not-applicable{background:#edf1f6;color:var(--muted)}.active{background:#e5efff;color:var(--blue)}.filters{display:grid;grid-template-columns:repeat(4,1fr) 2fr;gap:8px;margin-bottom:10px}select,input{padding:9px;border:1px solid var(--line);border-radius:8px}.case{border-top:1px solid var(--line)}.case>summary{display:grid;grid-template-columns:100px minmax(260px,1fr) 45px 70px 110px 110px;gap:10px;align-items:center;padding:13px 4px;cursor:pointer}.case>section{background:#f7f9fc;padding:15px;border-radius:10px}.case dl{display:grid;grid-template-columns:120px 1fr 120px 1fr}.case dd{margin:0}.blocker{border-left:4px solid var(--amber);padding:8px 12px;background:#fffaf0}.issues article{border-left:4px solid var(--red);padding:12px;background:#fff7f8;margin:8px 0}.issues .badge{float:right}footer{text-align:center;color:var(--muted);padding:20px}@media(max-width:1050px){.kpis{grid-template-columns:repeat(3,1fr)}.markets{grid-template-columns:repeat(2,1fr)}.case>summary{grid-template-columns:100px 1fr 70px 90px}.case>summary>*:nth-child(n+5){display:none}}@media(max-width:620px){.kpis,.markets,.filters{grid-template-columns:1fr 1fr}main{padding:0 12px}}
  </style></head><body><header class="hero"><h1>Samsung SMB · PreQA2 Official Validation</h1><p>${esc(model.authority)}</p><div class="meta"><span>Environment: PREQA2</span><span>Official SMB TCs: ${model.total}</span><span>Completion: ${model.completion}</span><span>Pass rate on executed: ${model.passRate}</span></div></header><main>
  <div class="grid kpis"><article class="kpi"><small>Official TCs</small><b>${model.total}</b></article><article class="kpi"><small>Executed</small><b>${model.executed}</b></article><article class="kpi good"><small>PASS</small><b>${model.passed}</b></article><article class="kpi ${model.failed ? "bad" : ""}"><small>FAIL</small><b>${model.failed}</b></article><article class="kpi"><small>Blocked</small><b>${model.blocked}</b></article><article class="kpi"><small>Not Run</small><b>${model.notRun}</b></article></div>
  <section class="panel"><h2>Market Progress</h2><div class="grid markets">${marketCards}</div></section>
  <section class="panel"><h2>Official Test Cases</h2><div class="filters"><select id="market"><option value="">All markets</option>${MARKETS.map((market) => `<option>${market}</option>`).join("")}</select><select id="status"><option value="">All statuses</option><option>PASS</option><option>FAIL</option><option>BLOCKED</option><option>NOT_RUN</option><option>NOT_APPLICABLE</option></select><select id="store"><option value="">All stores</option><option>BS</option><option>EPP</option><option>Unknown</option></select><select id="feature"><option value="">All features</option></select><input id="search" placeholder="SAM ID, title, feature"></div><div id="cases">${rows}</div></section>
  <section class="panel"><h2>Failures / Blockers</h2><div class="issues">${failures}</div></section>
  </main><footer>PreQA2 PASS is official for this validation scope · No PASS is inferred from navigation-only discovery</footer><script>
  const cases=[...document.querySelectorAll('.case')],feature=document.querySelector('#feature');[...new Set(cases.map(x=>x.dataset.feature).filter(Boolean))].sort().forEach(v=>feature.insertAdjacentHTML('beforeend','<option>'+v+'</option>'));const controls=[...document.querySelectorAll('.filters select,.filters input')];function apply(){const v=Object.fromEntries(controls.map(x=>[x.id,x.value.toLowerCase()]));cases.forEach(x=>{x.hidden=!!(['market','status','store','feature'].some(k=>v[k]&&x.dataset[k].toLowerCase()!==v[k])||(v.search&&!x.dataset.search.includes(v.search)))})}controls.forEach(x=>x.addEventListener('input',apply));
  </script></body></html>`;
}

function generatePreqa2Report({ outputPath = "test-results/preqa2/executive/index.html" } = {}) {
  const model = buildPreqa2Model();
  const target = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, generatePreqa2Html(model));
  return { outputPath: target, model };
}

if (require.main === module) {
  const result = generatePreqa2Report();
  console.log(`PreQA2 executive report written to ${result.outputPath}`);
}

module.exports = { buildPreqa2Model, generatePreqa2Html, generatePreqa2Report, metadataFor };
