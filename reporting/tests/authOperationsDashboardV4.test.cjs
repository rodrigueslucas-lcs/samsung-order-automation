const test = require('node:test');
const assert = require('node:assert/strict');
const { view } = require('../auth-operations/view.cjs');

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const helpers = {
  escape,
  time: value => value || 'Not recorded',
  elapsed: value => Number.isFinite(value) ? value + 'ms' : 'Not recorded',
  flag: market => market.toUpperCase(),
  chip: (label, color) => '<span class="chip ' + color + '">' + escape(label) + '</span>',
  eventType: () => 'Identity',
};
const primary = [
  ['mx', 'pymesmx'],
  ['pe', 'pe_membership_vip'],
  ['co', 'co_epp_agre'],
  ['cl', 'alianzas'],
];
function model({ action = false } = {}) {
  return {
    environment: 'S2', generatedAt: '2026-11-04T18:00:00.000Z',
    sessions: [['mx','primary'],['mx','second'],['pe','primary'],['co','primary'],['co','second'],['cl','primary']].map(([market,slot]) => ({
      market, environment: 'S2', slot, health: 'HEALTHY',
      operation: 'IDLE', bundle: 'SAME', jenkins: 'UPDATED',
    })),
    epp: { sessions: [
      { market: 'cl', program: 'alianzas', environment: 'S1', health: 'HEALTHY', operation: 'IDLE', identity: 'AUTHENTICATED', entitlement: 'VALID' },
      ...primary.map(([market, program]) => ({
        market, program, environment: 'S2', health: action && market === 'co' ? 'HUMAN_REQUIRED' : 'STALE',
        status: 'NO_DATA', operation: 'IDLE', reason: action && market === 'co' ? 'CORPORATE_ACTIVATION_REQUIRED' : null,
        identity: 'UNKNOWN', entitlement: 'UNKNOWN', storefront: 'UNKNOWN',
      })),
      { market: 'co', program: 'alianzas_co', environment: 'S2',
        health: 'HUMAN_REQUIRED', reason: 'CORPORATE_ACTIVATION_REQUIRED',
        identity: 'UNKNOWN', entitlement: 'UNKNOWN', operation: 'IDLE' },
    ] },
    scheduler: { status: 'RUNNING', lastResult: 0 },
    eppScheduler: { status: 'RUNNING', lastResult: 1 },
    activity: { known: true, active: [], queued: [] }, metrics: { availability: null },
  };
}
test('S2 summary renders four named primary EPP programmes and keeps alternatives in inventory', () => {
  const html = view(model(), {}, helpers);
  assert.match(html, /class="kpi health-kpi green"/);
  assert.match(html, /<p>Base Store<\/p>/);
  assert.match(html, /6<em> \/ 6 healthy<\/em>/);
  assert.match(html, /aria-label="Base Store identities"/);
  assert.equal((html.match(/data-identity="/g) || []).length, 6);
  assert.match(html, /SECOND/);
  assert.match(html, /FIRST/);
  assert.ok(html.indexOf('<p>Base Store</p>') < html.indexOf("epp-primary-kpi"));
  assert.doesNotMatch(html, /base-session-grid/);
  assert.match(html, /4 TARGET MARKETS/);
  for (const [, program] of primary) assert.match(html, new RegExp('>' + program + '<'));
  assert.match(html, /Other configured EPP programmes/);
  assert.match(html, /1 not in active scope/);
  assert.doesNotMatch(html, /data-epp-identity="cl:S1:alianzas"/);
  assert.match(html, /data-epp-identity="cl:S2:alianzas"/);
  assert.doesNotMatch(html, /aria-label="Human Action Required"/);
  assert.match(html, /data-event-market-filter/);
  assert.match(html, /data-event-type-filter/);
  assert.match(html, /<span class="chip slate">IDLE<\/span>/);
  assert.match(html, /EPP scheduler <span class="chip amber">REVIEW<\/span>/);
  assert.match(html, /1 · REVIEW SESSION RESULTS/);
  assert.match(html, /Last check/);
  assert.match(html, /Evidence/);
});
test('human action panel appears for primary intervention, not alternative-only intervention', () => {
  const noPrimaryAction = view(model(), {}, helpers);
  assert.doesNotMatch(noPrimaryAction, /aria-label="Human Action Required"/);
  const actualPrimaryAction = view(model({ action: true }), {}, helpers);
  assert.match(actualPrimaryAction, /aria-label="Human Action Required"/);
  assert.match(actualPrimaryAction, /Confirm corporate activation/);
});
