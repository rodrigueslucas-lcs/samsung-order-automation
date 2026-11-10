const { inventory } = require('../../scripts/report-epp-homologation.cjs');
const registry = require('../../governance/known-defects.json');
const { matchesKnownDefectEvidence } = require('../knownDefectEvidence.cjs');

const statuses = ['PASS','FAIL','KNOWN_DEFECT','TEST_DATA_REQUIRED','AUTH_BLOCKED','RECONCILIATION_REQUIRED','NOT_RUN'];
function classify({raw, reason = '', tc, market, program, evidence = []}) {
  if (raw === 'passed') return {quality:'PASS'};
  if (!raw || raw === 'interrupted') return {quality:'NOT_RUN'};
  if (/AMBIGUOUS_EPP_ORDER_ATTEMPT|RECONCILIATION_REQUIRED/.test(reason)) return {quality:'RECONCILIATION_REQUIRED'};
  if (/AUTH_OR_ENTITLEMENT_REQUIRED|EPP_IDENTITY_REQUIRED|SESSION_NOT_PROVEN|CORPORATE_ACTIVATION_REQUIRED|SAMSUNG_ACCOUNT_SECURITY_BLOCKED|HUMAN_REQUIRED/.test(reason)) return {quality:'AUTH_BLOCKED'};
  if (/MASS_REQUIRED:|MISSING_OR_UNPROVEN_EPP_(?:PRODUCT|PLP)|MISSING_EPP_CONTACT_DATA|VERIFICATION_CODE_REJECTED/.test(reason)) return {quality:'TEST_DATA_REQUIRED'};
  // A Jira association alone never proves a known defect. Require causal
  // runtime evidence as well as the precise market/program/TC signature.
  const hasEvidence = evidence.length > 0;
  const programme = {MX:'pymesmx',CL:'alianzas',PE:'pe_membership_vip',CO:'co_epp_agre'}[market];
  const issue = hasEvidence && program === programme && registry.defects.find(d =>
    d.market === market && d.environment === 'S2' && d.store === 'EPP' && d.samId === tc && d.status !== 'CLOSED'
    && ['SAM-25146','RT-779284','SAM-25161','RT-746043'].includes(d.jira)
    && matchesKnownDefectEvidence(d,{status:raw === 'skipped' ? 'BLOCKED':'FAIL',error:reason}));
  if (issue) return {quality:'KNOWN_DEFECT',reference:issue.jira,url:issue.url};
  return {quality:raw === 'skipped' ? 'NOT_RUN' : 'FAIL'};
}

function buildModel({market, environment, program, runId, buildNumber, gitCommit, document, infraError = false, preflightType, orderEvidence, scope = inventory()}) {
  if (!['MX','PE','CO','CL'].includes(market) || environment !== 'S2' || !/^[a-z][a-z0-9_]{1,60}$/.test(program || '') || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(runId || '')) throw new Error('Invalid EPP quality execution identity.');
  const observed = new Map();
  const targetIds=document?.config?.metadata?.epp?.targetIds||[];
  if(!Array.isArray(targetIds)||new Set(targetIds).size!==targetIds.length||targetIds.some(id=>!scope.some(r=>r.market===market&&r.tc===id)))throw new Error('Invalid targeted EPP scope.');
  if (document) {
    const metadata = document.config?.metadata?.epp;
    if (!metadata || metadata.market !== market || metadata.environment !== environment || metadata.program !== program || metadata.runId !== runId) throw new Error('EPP result belongs to another execution.');
    function visit(suites = []) {
      for (const suite of suites) {
        for (const spec of suite.specs || []) {
          const tc = spec.title?.match(/\bSAM-\d+\b/)?.[0];
          if (!tc) continue;
          if (observed.has(tc) || spec.tests?.length !== 1) throw new Error('Duplicate EPP official result.');
          const test = spec.tests[0], result = test.results?.at(-1);
          if ((test.results?.length || 0) > 1) throw new Error('EPP CI retries are forbidden.');
          const reason = [...(test.annotations || []).map(a => a.description || ''), result?.error?.message || ''].join('\n');
          const evidence = (result?.attachments || []).filter(a => typeof a.path === 'string').map(a => ({name:a.name, path:a.path}));
          const recovery = metadata.executionMode === 'RECOVERY_ONLY' || test.annotations?.some(a => a.type === 'epp-execution-mode' && a.description === 'RECOVERY_ONLY');
          const raw = result?.status || null;
          const reasonCode=reason.match(/\b(?:MISSING_EXPECTED_CART_FOOTER|AUTH_OR_ENTITLEMENT_REQUIRED|EPP_IDENTITY_REQUIRED|CORPORATE_ACTIVATION_REQUIRED|SAMSUNG_ACCOUNT_SECURITY_BLOCKED|HUMAN_REQUIRED|VERIFICATION_CODE_REJECTED|MISSING_OR_UNPROVEN_EPP_PRODUCT|MISSING_OR_UNPROVEN_EPP_PLP|MISSING_EPP_CONTACT_DATA|EPP_TOOLTIP_TRIGGER_NOT_AVAILABLE|AMBIGUOUS_EPP_ORDER_ATTEMPT|RECONCILIATION_REQUIRED|CL_EPP_BANK_FORBIDDEN_403|MX_EPP_CASH_TRANSACTION_FAILED)\b/)?.[0];
          observed.set(tc, {tc, name:spec.title, raw, reasonCode, executionMode:recovery?'RECOVERY_ONLY':'NORMAL', duration:result?.duration || 0, evidence,
            ...(recovery ? {quality:'NOT_RUN'} : classify({raw,reason,tc,market,program,evidence}))});
        }
        visit(suite.suites);
      }
    }
    visit(document.suites);
  }
  const official = scope.filter(r => r.market === market);
  if (!official.length || new Set(official.map(r => r.tc)).size !== official.length) throw new Error('Invalid EPP official inventory.');
  if (observed.size && [...observed.keys()].some(tc => !official.some(r => r.tc === tc))) throw new Error('Foreign EPP official TC.');
  const prerequisite=['AUTH_BLOCKED','TEST_DATA_REQUIRED'].includes(preflightType)?preflightType:'NOT_RUN';
  const rows = official.map(r => observed.get(r.tc) || {tc:r.tc,raw:null,quality:prerequisite,duration:0,evidence:[]});
  if(orderEvidence){
    if(['market','environment','program','runId'].some(key=>orderEvidence[key]!==({market,environment,program,runId})[key]))throw new Error('Foreign EPP order validation.');
    for(const [tc,reason] of Object.entries(orderEvidence.errors||{})){
      const row=rows.find(r=>r.tc===tc);if(!row)throw new Error('Foreign EPP payment TC.');
      if(row.executionMode!=='RECOVERY_ONLY'){row.quality='FAIL';row.errorSummary=reason;}
    }
  }
  const selectedRows=targetIds.length?rows.filter(r=>targetIds.includes(r.tc)):rows;
  const gateCounts=Object.fromEntries(statuses.map(s=>[s,selectedRows.filter(r=>r.quality===s).length]));
  const counts = Object.fromEntries(statuses.map(s => [s,rows.filter(r => r.quality === s).length]));
  const gate = infraError ? 'INFRA_ERROR' : gateCounts.FAIL ? 'FAILED — NEW REGRESSION'
    : gateCounts.TEST_DATA_REQUIRED + gateCounts.AUTH_BLOCKED + gateCounts.RECONCILIATION_REQUIRED + gateCounts.NOT_RUN ? 'BLOCKED BY EXTERNAL DEPENDENCIES'
    : gateCounts.KNOWN_DEFECT ? 'PASSED WITH KNOWN DEFECTS' : targetIds.length ? 'TARGETED PASSED' : 'FULLY PASSED';
  return {schemaVersion:1,market,environment,program,runId,buildNumber,gitCommit:/^[a-f0-9]{40}$/i.test(gitCommit||'')?gitCommit:null,startedAt:document?.stats?.startTime||null,durationMs:Number(document?.stats?.duration)||0,official:rows.length,
    executed:rows.filter(r => r.executionMode !== 'RECOVERY_ONLY' && r.raw && r.raw !== 'skipped' && r.raw !== 'interrupted').length,counts,gate,targetIds,selected:selectedRows.length,rows,orders:orderEvidence?.orders||[]};
}
module.exports = {statuses,classify,buildModel};
