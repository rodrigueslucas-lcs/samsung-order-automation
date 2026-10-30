const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const markets = ['MX','CO','PE','CL'];

function prerequisiteReason(description = '') {
  const additional=['PRODUCTION_NAVIGATION_BLOCKED','BLOCKED_CALLBACK_TO_PRODUCTION','PROGRAM_CONTEXT_NOT_PROVEN','SESSION_NOT_PROVEN','EPP_IDENTITY_REQUIRED','SAMSUNG_ACCOUNT_SECURITY_BLOCKED','HUMAN_REQUIRED'];
  const precise=additional.find(reason=>description.includes(reason));if(precise)return precise;
  const exact=['AMBIGUOUS_EPP_ORDER_ATTEMPT','MISSING_OR_UNPROVEN_EPP_PLP','MISSING_OR_UNPROVEN_EPP_PRODUCT','MISSING_EPP_CONTACT_DATA','VERIFICATION_CODE_REJECTED','CORPORATE_ACTIVATION_REQUIRED','AUTH_OR_ENTITLEMENT_REQUIRED','EPP_COMMERCE_NOT_RENDERED','PAYMENT_FLOW_NOT_PROVEN','PAYMENT_SUBMIT_NOT_AUTHORIZED','PROVIDER_NOT_AVAILABLE','PAYMENT_DATA_REJECTED','ENVIRONMENT_DEFECT'];
  const classified=exact.find(reason=>description.includes(reason));if(classified)return classified;
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
        implementation: /@preflight/.test(match[2]) ? 'PREREQUISITE_FLOW' : /@blocked/.test(match[2]) ? 'BLOCKED_NOT_IMPLEMENTED' : 'IMPLEMENTED' })));
  });
}
function classifyObservation(row){
  if(row.result==='PASS')return{classification:'',manualAction:'NONE'};
  const reason=row.notes||'';
  if(/HUMAN_REQUIRED/.test(reason))return{classification:'HUMAN_REQUIRED',manualAction:'Complete the current dedicated verification challenge'};
  if(/AUTH_OR_ENTITLEMENT|IDENTITY_REQUIRED|SESSION_NOT_PROVEN|CORPORATE_ACTIVATION|SECURITY_BLOCKED/.test(reason))return{classification:'ACCESS_REQUIRED',manualAction:'Prove the isolated programme identity and entitlement; do not reuse Base Store proof'};
  if(/MISSING_OR_UNPROVEN_EPP_(PLP|PRODUCT)|MISSING_EPP_CONTACT_DATA|VERIFICATION_CODE_REJECTED|PAYMENT_DATA_REJECTED/.test(reason))return{classification:'MASS_REQUIRED',manualAction:'Provide or prove eligible programme-specific data'};
  if(/MISSING_EXPECTED_CART_FOOTER|ENVIRONMENT_DEFECT/.test(reason))return{classification:'APPLICATION_BUG',manualAction:'Samsung must review the recorded UI defect; no Jira ID inferred'};
  if(/PRODUCTION|ENVIRONMENT_BLOCKER/.test(reason))return{classification:'ENVIRONMENT_BLOCKER',manualAction:'Correct staging routing or availability; Production remains blocked'};
  if(/AMBIGUOUS_EPP_ORDER_ATTEMPT/.test(reason))return{classification:'ACCESS_REQUIRED',manualAction:'Reconcile the existing provider initiation before any new submit'};
  return{classification:'AUTOMATION_FIXABLE',manualAction:'Engineering investigation pending; no external root cause established'};
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
            notes: skipped ? prerequisiteReason(annotation?.description) : last.status === 'passed' ? 'EXPECTED_BEHAVIOR_PROVEN' : /getByRole\('contentinfo'\).*getByRole\('heading'[\s\S]*(?:Shop|Tienda)/.test(last.error?.message||'') ? 'MISSING_EXPECTED_CART_FOOTER' : 'INSPECT_IGNORED_PLAYWRIGHT_REPORT' });
        }
      }
      visit(suite.suites);
    }
  }
  visit(document.suites);
  return results;
}
function mergeObservation(previous, current) {
  if (previous?.result === 'PASS' && ['BLOCKED','HUMAN_REQUIRED','NOT_RUN'].includes(current.result)) {
    return { ...previous, runtime: 'HISTORICAL_TARGETED_RUNTIME',
      notes: `HISTORICAL_PASS_CURRENT_${current.notes}`,
      latestAttempt: { runtime: current.runtime, result: current.result, notes: current.notes } };
  }
  return current;
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
      for (const result of results) {
        const key = `${market}:${environment}:${result.tc}`;
        const metadata=JSON.parse(fs.readFileSync(file,'utf8')).config?.metadata?.epp;
        const program=metadata?.market===market&&metadata?.environment===environment&&/^[a-z][a-z0-9_]{1,60}$/.test(metadata.program||'')?metadata.program:'NOT_RECORDED';
        observed.set(key,mergeObservation(observed.get(key),{...result,program,evidence:path.relative(root,file).replace(/\\/g,'/')}));
      }
    }
  }
  const rows = buildRows(inventory(), observed).map(row=>({...row,...classifyObservation(row)}));
  const output = path.join(root,'test-results/epp/homologation');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'matrix.json'),JSON.stringify({ generatedAt:new Date().toISOString(), rows },null,2));
  const text = ['| TC | Market | Env | Program | Status | Classification | Result/blocker | Evidence | Manual action |','|---|---|---|---|---|---|---|---|---|',...rows.map(r => `| ${r.tc} | ${r.market} | ${r.environment} | ${r.program||'NOT_RECORDED'} | ${r.result} | ${r.classification} | ${r.notes} | ${r.evidence||'NONE'} | ${r.manualAction} |`)].join('\n');
  fs.writeFileSync(path.join(output,'matrix.md'),text+'\n');
  console.log(`[epp-homologation] ${rows.length} market/environment TC rows · PASS ${rows.filter(r=>r.result==='PASS').length} · FAIL ${rows.filter(r=>r.result==='FAIL').length} · BLOCKED ${rows.filter(r=>r.result==='BLOCKED').length} · NOT_RUN ${rows.filter(r=>r.result==='NOT_RUN').length}`);
  console.log(`[epp-homologation] ${path.relative(root,path.join(output,'matrix.md'))}`);
  return rows;
}
if (require.main === module) {
  try { report(); }
  catch { console.error('[epp-homologation] Unable to read/write a complete report; no raw report, identity or provider data printed.'); process.exitCode = 1; }
}
module.exports = { inventory, extractResults, buildRows, prerequisiteReason, mergeObservation, classifyObservation, report };
