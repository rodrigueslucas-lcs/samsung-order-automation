const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const markets = ['MX','CO','PE','CL'];

function prerequisiteReason(description = '') {
  const rules = [
    [/BLOCKED_NOT_IMPLEMENTED/i,'PAYMENT_ADAPTER_NOT_IMPLEMENTED'],
    [/VERIFICATION_CODE_REJECTED/i,'VERIFICATION_CODE_REJECTED'],
    [/CORPORATE_ACTIVATION|corporate.*activation/i,'CORPORATE_ACTIVATION_REQUIRED'],
    [/contact QA data|contact fixture/i,'MISSING_EPP_CONTACT_DATA'],
    [/PLP/i,'MISSING_OR_UNPROVEN_EPP_PLP'],
    [/PDP|SKU|product\/cart/i,'MISSING_OR_UNPROVEN_EPP_PRODUCT'],
    [/COMMERCE_CONTENT_NOT_RENDERED/i,'EPP_COMMERCE_NOT_RENDERED'],
    [/HUMAN_REQUIRED|identity|authentication/i,'AUTH_OR_ENTITLEMENT_REQUIRED'],
    [/payment|provider|order|confirmation/i,'PAYMENT_FLOW_NOT_PROVEN'],
  ];
  return rules.find(([pattern])=>pattern.test(description))?.[1] || 'PREREQUISITE_NOT_MET';
}

function inventory() {
  return markets.flatMap(market => {
    const directory = path.join(root, 'tests/markets', market.toLowerCase(), 'qst/epp');
    return fs.readdirSync(directory).filter(name => name.endsWith('.spec.js')).flatMap(name =>
      [...fs.readFileSync(path.join(directory,name),'utf8').matchAll(/test\("(SAM-\d+)([^"\n]*)/g)].map(match => ({ market, tc:match[1],
        implementation: /@blocked/.test(match[2]) ? 'BLOCKED_NOT_IMPLEMENTED' : 'IMPLEMENTED' })));
  });
}
function extractResults(document) {
  const results = [];
  function visit(suites = []) {
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        const tc = spec.title?.match(/SAM-\d+/)?.[0];
        if (!tc) continue;
        for (const item of spec.tests || []) {
          const last = item.results?.at(-1);
          if (!last) continue;
          const annotation = (item.annotations || []).find(a => a.type === 'skip');
          const skipped = last.status === 'skipped';
          results.push({ tc, runtime: skipped ? 'PREREQUISITE_CHECK' : 'TARGETED_RUNTIME',
            result: last.status === 'passed' ? 'PASS' : skipped ? 'BLOCKED' : last.status === 'interrupted' ? 'NOT_RUN' : 'FAIL',
            notes: skipped ? prerequisiteReason(annotation?.description) : last.status === 'passed' ? 'EXPECTED_BEHAVIOR_PROVEN' : 'INSPECT_IGNORED_PLAYWRIGHT_REPORT' });
        }
      }
      visit(suite.suites);
    }
  }
  visit(document.suites);
  return results;
}
function buildRows(scope, observed = new Map()) {
  return scope.flatMap(item => ['S1','S2'].map(environment => {
    const found = observed.get(`${item.market}:${environment}:${item.tc}`);
    return { ...item, environment, runtime:'NOT_RUN', result:'NOT_RUN', notes:'NO_FUNCTIONAL_RUNTIME_EVIDENCE', ...found, market:item.market, tc:item.tc };
  }));
}
function report() {
  const observed = new Map();
  for (const market of markets) for (const environment of ['S1','S2']) {
    const directory = path.join(root,'test-results/epp',market.toLowerCase(),environment.toLowerCase());
    if (!fs.existsSync(directory)) continue;
    for (const run of fs.readdirSync(directory).sort()) {
      const file = path.join(directory,run,'results.json');
      if (!fs.existsSync(file)) continue;
      const results = extractResults(JSON.parse(fs.readFileSync(file,'utf8')));
      for (const result of results) observed.set(`${market}:${environment}:${result.tc}`,result);
    }
  }
  const rows = buildRows(inventory(), observed);
  const output = path.join(root,'test-results/epp/homologation');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'matrix.json'),JSON.stringify({ generatedAt:new Date().toISOString(), rows },null,2));
  const text = ['| Market | Env | TC | Implementation | Runtime | Result | Notes |','|---|---|---|---|---|---|---|',...rows.map(r => `| ${r.market} | ${r.environment} | ${r.tc} | ${r.implementation} | ${r.runtime} | ${r.result} | ${r.notes} |`)].join('\n');
  fs.writeFileSync(path.join(output,'matrix.md'),text+'\n');
  console.log(`[epp-homologation] ${rows.length} market/environment TC rows · PASS ${rows.filter(r=>r.result==='PASS').length} · FAIL ${rows.filter(r=>r.result==='FAIL').length} · BLOCKED ${rows.filter(r=>r.result==='BLOCKED').length} · NOT_RUN ${rows.filter(r=>r.result==='NOT_RUN').length}`);
  console.log(`[epp-homologation] ${path.relative(root,path.join(output,'matrix.md'))}`);
  return rows;
}
if (require.main === module) {
  try { report(); }
  catch { console.error('[epp-homologation] Unable to read/write a complete report; no raw report, identity or provider data printed.'); process.exitCode = 1; }
}
module.exports = { inventory, extractResults, buildRows, prerequisiteReason, report };
