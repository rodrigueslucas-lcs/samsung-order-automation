const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMxQstRuntimeSummary } = require('../../utils/mxQstRuntimeSummary.cjs');
const {
  activeKnownDefects,
  applyCoS1BlockedLabels,
} = require('../../scripts/annotate-known-defects-dashboard.cjs');
const registry = require('../../governance/known-defects.json');

function skippedSpec(samId, title, reason) {
  return {
    title: `${samId} ${title}`,
    file: 'tests/markets/co/qst/base-store/official-p1.spec.js',
    tests: [{
      annotations: [{ type: 'skip', description: reason }],
      results: [{ status: 'skipped', duration: 0, attachments: [] }],
    }],
  };
}

test('CO S1 prerequisite blockers remain blocked and do not become build failures', () => {
  const report = { suites: [{ specs: [
    skippedSpec('SAM-24892', 'Add SC+ from BC PDP Page',
      'Official CO Care+ case is BLOCKED: the configured fridge and verified mobile expose no Samsung Care+ option. An eligible SKU is required.'),
    skippedSpec('SAM-24893', 'Verify trade-up cart page',
      'CO S1 Trade-up is BLOCKED by known defect SAM-25148: Trade-up / Plan Canje / Renueva is currently unavailable for the verified S1 product set.'),
    skippedSpec('SAM-24914', 'Payment using ADDI pay',
      'Official source is BLOCKED and documents a PSE/BO/Kibana callback workflow; no automated bypass or fabricated payment completion.'),
    skippedSpec('SAM-24915', 'Payment using Rewards',
      'CO S1 Rewards payment is BLOCKED: Samsung Rewards redemption is currently unavailable in this environment.'),
  ] }] };

  const runtime = buildMxQstRuntimeSummary(report, {
    officialIds: ['SAM-24892', 'SAM-24893', 'SAM-24914', 'SAM-24915'],
    market: 'CO',
    store: 'BASE_STORE',
    environment: 'S1/STG1',
    titles: {},
    gitCommit: 'test',
  });

  assert.equal(runtime.summary.failed, 0);
  assert.equal(runtime.summary.blocked, 4);
  assert.deepEqual(runtime.tests.map(({ status }) => status), [
    'SKIPPED-BLOCKED', 'SKIPPED-BLOCKED', 'SKIPPED-BLOCKED', 'SKIPPED-BLOCKED',
  ]);
  assert.match(runtime.tests[0].blockedReason, /Care\+|eligible SKU/i);
  assert.match(runtime.tests[1].blockedReason, /SAM-25148/);
  assert.match(runtime.tests[2].blockedReason, /PSE\/BO\/Kibana/);
  assert.match(runtime.tests[3].blockedReason, /Rewards redemption/);

  const active = activeKnownDefects(runtime, registry);
  assert.equal(active.length, 1, 'Only the Jira-backed Trade-up blocker must become a purple KNOWN DEFECT in this blocker-only fixture.');
  assert.equal(active[0].defect.samId, 'SAM-24893');
  assert.equal(active[0].defect.jira, 'SAM-25148');
});

test('CO S1 SAM-24806 maps to footer defect SAM-25146', () => {
  const runtime = {
    market: 'CO',
    environment: 'S1/STG1',
    store: 'BASE_STORE',
    tests: [{ samId: 'SAM-24806', status: 'FAIL', error: 'Footer validation failed.' }],
  };
  const active = activeKnownDefects(runtime, registry);
  assert.equal(active.length, 1);
  assert.equal(active[0].defect.jira, 'SAM-25146');
  assert.equal(active[0].defect.url, 'https://jira.secext.samsung.net/browse/SAM-25146');
});

test('CO S1 blocker presentation uses explicit amber prerequisite labels', () => {
  const html = [
    '<article><div><a>SAM-24892</a></div><span class="chip warn-chip">BLOCKED</span><span class="category">Test Data / Prerequisite</span></article>',
    '<article><div><a>SAM-24914</a></div><span class="chip warn-chip">BLOCKED</span><span class="category">Environment / Backend</span></article>',
    '<article><div><a>SAM-24915</a></div><span class="chip warn-chip">BLOCKED</span><span class="category">Environment / Backend</span></article>',
  ].join('');
  const output = applyCoS1BlockedLabels(html);
  assert.match(output, /MISSING SC\+ PRODUCT/);
  assert.match(output, /PSE UNAVAILABLE/);
  assert.match(output, /REWARDS UNAVAILABLE/);
  assert.equal((output.match(/blocked-category/g) || []).length, 3);
});

test('CO S1 known-defect mappings do not leak into S2', () => {
  const runtime = {
    market: 'CO', environment: 'S2/STG2', store: 'BASE_STORE',
    tests: [
      { samId: 'SAM-24806', status: 'FAIL' },
      { samId: 'SAM-24893', status: 'SKIPPED-BLOCKED' },
    ],
  };
  assert.equal(activeKnownDefects(runtime, registry).length, 0);
});
