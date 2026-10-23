const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { matchesKnownDefectEvidence } = require('../knownDefectEvidence.cjs');
const { activeKnownDefects } = require('../../scripts/annotate-known-defects-dashboard.cjs');
const registry = require('../../governance/known-defects.json');
const defect = registry.defects.find(item => item.jira === 'RT-738525');
const exact = 'Guest Track Order accepted the OTP but could not find MX-QA in the current BaseSite';
const missing = 'TC13 OTP email was not found within 600000ms. Inbox=qa; observed=[]';
test('build 177 missing OTP is a real failure, not the post-OTP BaseSite defect', () => {
  assert.equal(matchesKnownDefectEvidence(defect, { error: missing }), false);
  assert.equal(activeKnownDefects({ market:'MX',environment:'S2',store:'BASE_STORE',tests:[{
    samId:'SAM-25010',status:'FAIL',error:missing,
  }] },registry).length,0);
});
test('runtime and Allure recognize the causal post-OTP error', () => {
  for (const result of [{error:exact},{statusDetails:{message:exact}},
    {blockedReason:'KNOWN DEFECT RT-738525 · MX Guest Track Order accepts OTP but cannot resolve MX-QA in the current BaseSite.'}]) {
    assert.equal(matchesKnownDefectEvidence(defect,result),true);
  }
});
test('ID, ticket, expected description or generic timeout alone cannot quarantine a failure', () => {
  for(const result of [{}, {description:exact}, {error:'TimeoutError: page.waitForURL'},
    {error:'RT-738525 SAM-25010'}, {error:missing,blockedReason:exact}]) {
    assert.equal(matchesKnownDefectEvidence(defect,result),false);
  }
});
test('Allure finalization preserves missing-OTP FAIL and quarantines only the exact BaseSite failure', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mx-otp-defect-'));
  try {
    for(const [id,message] of [['missing',missing],['exact',exact]]) fs.writeFileSync(path.join(dir,`${id}-result.json`),JSON.stringify({
      uuid:id,name:'SAM-25010 Track Order',fullName:'MX SAM-25010',status:'failed',stage:'finished',
      statusDetails:{message},parameters:[{name:'Market',value:'MX'},{name:'Environment',value:'S2'},{name:'Store',value:'BASE_STORE'}],
      labels:[],links:[],steps:[],attachments:[],
    }));
    execFileSync(process.execPath,[path.resolve('scripts/dedupe-allure-evidence.cjs'),dir],{stdio:'pipe'});
    const missed=JSON.parse(fs.readFileSync(path.join(dir,'missing-result.json'),'utf8'));
    const matched=JSON.parse(fs.readFileSync(path.join(dir,'exact-result.json'),'utf8'));
    assert.equal(missed.status,'failed');
    assert.equal(missed.parameters.some(item=>item.name==='Known Defect'),false);
    assert.equal(matched.status,'skipped');
    assert.equal(matched.parameters.find(item=>item.name==='Known Defect').value,'RT-738525');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
