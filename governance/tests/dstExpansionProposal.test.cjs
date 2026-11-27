const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const proposal = require('../dst-p1-expansion-proposal.json');
const p2 = require('../dst-p2-source-inventory.json');
const official = require('../smb-qst.json');
const baseline = require('../dst-phase2-coverage.json');
const { executionPlan } = require('../../utils/dstExecution.cjs');
const root = path.resolve(__dirname, '../..');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

test('P1 proposal binds all 144 exact market/SAM identities without declaring implementation', () => {
  assert.equal(proposal.rows.length, 144);
  assert.equal(new Set(proposal.rows.map(r => `${r.market}/${r.store}/${r.id}`)).size, 144);
  for (const market of ['MX', 'PE', 'CO', 'CL']) {
    assert.deepEqual(proposal.rows.filter(r => r.market === market).map(r => r.id).sort(), [...official.markets[market].cases].sort());
  }
  assert.equal(proposal.massImplementationStarted, false);
  assert.equal(proposal.fullCampaignAllowed, false);
  assert.equal(proposal.paymentSubmissionAllowed, false);
  for (const row of proposal.rows) {
    assert.equal(row.priority, 'P1');
    assert.equal(row.formalHomologation, 'NOT_DECLARED');
    assert.match(row.source.sha256, /^[a-f0-9]{64}$/);
    assert.match(row.source.range, /^A\d+:[IJ]\d+$/);
    for (const field of ['description', 'steps', 'preconditions', 'expectedResults']) assert.ok(row.officialFields[field].trim());
    assert.doesNotMatch(Object.values(row.officialFields).join('\n'), /\b(?:\d[ -]?){13,19}\b/, 'Exported payment data must not enter the proposal');
    assert.match(row.qstOwner.file, new RegExp(`^tests/markets/${row.market.toLowerCase()}/qst/`));
    assert.equal(digest(row.qstOwner.file), row.qstOwner.sourceSha256);
    assert.equal(row.store === 'EPP', row.qstOwner.file.includes('/epp/'));
    for (const file of row.reuseCandidates) assert.ok(fs.existsSync(path.join(root, file)), `${row.id}: ${file}`);
  }
});

test('proposal preserves nine real Phase2 results and immutable historical snapshots', () => {
  for (const [file, sha] of Object.entries(proposal.historicalSnapshotHashes)) assert.equal(digest(file), sha, file);
  const pilots = proposal.rows.filter(r => r.existingDstSpec);
  assert.equal(pilots.length, 9);
  assert.equal(pilots.filter(r => r.dstRuntime === 'PASS').length, 8);
  assert.equal(pilots.filter(r => r.dstRuntime === 'FAIL').length, 1);
  for (const row of proposal.rows) {
    const previous = baseline.rows.find(r => r.market === row.market && r.officialId === row.id && r.executionHistory);
    if (previous) {
      assert.equal(row.dstRuntime, previous.runtime);
      assert.deepEqual(row.dstEvidence, previous.evidence);
    } else {
      assert.equal(row.dstRuntime, 'NOT_RUN');
      assert.equal(row.dstImplementation, 'NOT_IMPLEMENTED_OFFICIALLY');
      assert.equal(row.comparison.status, 'STATIC_COMPARISON_PENDING_CLAUSE_REVIEW');
    }
  }
});

test('reuse proposal records fixture boundaries, source disagreements and operator clarification', () => {
  const epp = proposal.rows.filter(r => r.store === 'EPP');
  assert.equal(epp.length, 26);
  for (const row of epp) assert.ok(row.comparison.additionalChecks.some(s => s.includes('DST-aware adapter')));
  for (const id of ['SAM-24920', 'SAM-24830']) {
    const row = proposal.rows.find(r => r.id === id);
    assert.match(row.officialFields.preconditions, /User is on payment page/);
    assert.ok(row.comparison.additionalChecks.some(s => s.includes('no checkout required')));
    assert.ok(!row.comparison.additionalChecks.some(s => s.startsWith('Review payment-page boilerplate')));
  }
  assert.deepEqual(proposal.rows.filter(r => !r.source.corroboratingCsv.fieldsMatch).map(r => r.id).sort(), ['SAM-25002', 'SAM-25045']);
  assert.deepEqual(proposal.crossMarketSamReferences.map(r => `${r.market}/${r.id}`).sort(), ['CL/SAM-24806', 'CO/SAM-24806']);
});

test('coverage estimates are disjoint proposal waves, never runtime PASS totals', () => {
  const counts = {};
  for (const row of proposal.rows) counts[row.wave] = (counts[row.wave] || 0) + 1;
  assert.deepEqual(counts, {
    W1_READ_ONLY: 14, W0_CONSOLIDATE_EXISTING_NINE: 9,
    W4_EXPLICIT_BUSINESS_AUTHORIZATION: 32, W2_CART_AND_QUOTE: 60,
    W3_CONTROLLED_WRITES: 21, HOLD_EXISTING_BLOCKER: 8,
  });
  for(const id of ['SAM-24786','SAM-25057','SAM-24919','SAM-25010']) {
    assert.equal(proposal.rows.find(r=>r.id===id).wave,'W4_EXPLICIT_BUSINESS_AUTHORIZATION','Official Place order steps cannot be treated as read-only history/track lookup');
  }
  for(const id of ['SAM-24896','SAM-24986']) assert.equal(proposal.rows.find(r=>r.id===id).wave,'W3_CONTROLLED_WRITES');
  assert.equal(proposal.rows.find(r=>r.id==='SAM-24962').wave,'HOLD_EXISTING_BLOCKER');
  for(const row of proposal.rows.filter(r=>r.wave==='W1_READ_ONLY')) assert.doesNotMatch(row.officialFields.steps,/\b(?:place|submit|create)(?: an?| the)? order\b/i);
  for (const [key, summary] of Object.entries(proposal.summary)) {
    const rows = proposal.rows.filter(r => `${r.market}_${r.store}` === key);
    assert.equal(rows.length, summary.officialP1);
    assert.equal(Object.values(summary.waves).reduce((a, b) => a + b, 0), rows.length);
    assert.equal(summary.dstPass, rows.filter(r => r.dstRuntime === 'PASS').length);
  }
});

test('P2 retains exactly 218 canonical inventory rows without executable promotion or detailed content', () => {
  const sourceRows = baseline.rows.filter(r => r.priority === 'P2');
  assert.equal(p2.approvedDetailedDefinitions, 0);
  assert.equal(p2.rows.length, 218);
  assert.deepEqual(p2.rows.map(r => r.sourceRowKey).sort(), sourceRows.map(r => r.sourceRowKey).sort());
  for (const [file, sha] of Object.entries(p2.sourceHashes)) assert.equal(digest(file), sha);
  for (const row of p2.rows) {
    assert.equal(row.implementation, 'INVENTORY_ONLY');
    assert.equal(row.runtime, 'NOT_RUN');
    assert.equal(row.formalHomologation, 'NOT_DECLARED');
    assert.equal(row.approvedDetailedDefinitionStatus, 'NOT_VERIFIED');
    assert.ok(!row.officialFields);
    assert.ok(!row.spec);
    for (const file of row.reuseCandidates) assert.ok(fs.existsSync(path.join(root, file)));
  }
  assert.equal(p2.rows.filter(r => r.candidateExport.correspondence === 'EXACT_DESCRIPTION_AND_MARKET_STORE').length, 213);
  assert.equal(p2.rows.filter(r => r.candidateExport.ambiguousCandidates.length > 1).length, 5);
  assert.throws(() => executionPlan(['MX', '--store', 'BASE_STORE', '--priority', 'P2', '--ids', 'MX-BASE_STORE-1'], {}));
});

test('Phase3 follow-up preserves the functional FAIL separately from successful trace and QST regression', () => {
  const followUp = require('../dst-phase3-validation.json');
  // sourceHashes describe the historical run, not a ban on later validated
  // maintenance of shared QST/DST code. Keep that snapshot and bind each
  // subsequent revision explicitly instead of replacing historical hashes.
  assert.equal(followUp.sourceHashes['flows/mx/bcAddToCart.js'],'1168dbc0a18d0cfa04639e1d4139f08daef61becfe3f4f51dd8501a5391aabb7');
  for (const revision of followUp.subsequentSourceRevisions || []) {
    assert.ok(Object.hasOwn(followUp.sourceHashes,revision.file));
    assert.match(revision.previousCommit,/^[a-f0-9]{40}$/);
    assert.ok(revision.reason.length>30);
  }
  for (const [file,sha] of Object.entries(followUp.sourceHashes)) {
    let expected=sha;
    for(const revision of (followUp.subsequentSourceRevisions||[]).filter(r=>r.file===file)){
      assert.equal(revision.previousSha256,expected,'Source revision must preserve a continuous historical chain');
      assert.match(revision.currentSha256,/^[a-f0-9]{64}$/);
      expected=revision.currentSha256;
    }
    assert.equal(digest(file),expected,file);
  }
  for (const [file,sha] of Object.entries(followUp.authProbeValidation.sourceHashes)) assert.equal(digest(file),sha,file);
  assert.equal(followUp.authProbeValidation.temporaryProfilesOnly,true);
  assert.equal(followUp.authProbeValidation.unknownOwnerStillBlocked,true);
  assert.equal(followUp.fullSuiteApproval,false);
  assert.equal(followUp.paymentSubmitted,false);
  assert.equal(followUp.orderCreated,false);
  assert.equal(followUp.authRenewed,false);
  assert.equal(followUp.mxDstBcFollowUp.runtime,'FAIL');
  assert.equal(followUp.mxDstBcFollowUp.reason,'DST_BC_COLOUR_NOT_RENDERED');
  assert.equal(followUp.mxDstBcFollowUp.traceArchiveValidated,true);
  assert.deepEqual(followUp.mxDstBcFollowUp.trace.entries,['trace.trace','trace.network']);
  assert.equal(followUp.mxBcPostChangeRegression.suite,'QST');
  assert.deepEqual(followUp.mxBcPostChangeRegression.results,[{id:'SAM-24969',status:'passed'}]);
  assert.equal(followUp.mxBuild24Revalidation.results.length,4);
  assert.ok(followUp.mxBuild24Revalidation.results.every(r=>r.status==='passed'));
  assert.deepEqual(followUp.currentDstBaseline,{executedUnique:9,pass:8,fail:1,p1NotRun:135,p2NotRun:218});
});
