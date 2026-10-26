const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { writeJsonAtomically } = require('./atomicJson');
const { VERIFICATION_ISSUES } = require('./authVerificationResult.cjs');

const SLOTS = Object.freeze({ mx: ['primary', 'second'], pe: ['primary'], co: ['primary', 'second'], cl: ['primary'] });
const STATUSES = new Set(['VERIFYING', 'HEALTHY', 'NEEDS_REFRESH', 'REFRESHING', 'RECOVERED', 'REFRESHED', 'HUMAN_REQUIRED', 'HANDOFF_ENDED', 'WAITING_PRIMARY', 'BUSY', 'FAILED', 'TRANSIENT_ERROR', 'UNPROVEN']);
const FINAL_STATUSES = new Set(['READY', 'PACKAGE_FAILED', 'PUBLISH_FAILED', 'BROWSER_CLOSE_FAILED', 'SKIPPED']);
const FILE = /^cycle-\d{13}-[a-f0-9-]{36}\.json$/;
function dataDirectory(env = process.env) {
  return path.resolve(env.AUTH_OPERATIONS_DIR || path.join(env.ProgramData || env.PROGRAMDATA || require('node:os').tmpdir(), 'SamsungSMB', 'AuthOperations'));
}
function timestamp(value) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }
function duration(value) { return Number.isFinite(value) && value >= 0 && value <= 86400000 ? Math.round(value) : null; }
function identity(value) {
  if (!Object.hasOwn(SLOTS,value?.market) || !SLOTS[value.market].includes(value.slot) || !STATUSES.has(value.status)) return null;
  const safe = { market: value.market, slot: value.slot, status: value.status };
  if (VERIFICATION_ISSUES.includes(value.reason)) safe.reason = value.reason;
  if (Number.isInteger(value.attempts) && value.attempts >= 0 && value.attempts <= 2) safe.attempts = value.attempts;
  for (const key of ['verifyDurationMs', 'refreshDurationMs']) if (duration(value[key]) !== null) safe[key] = duration(value[key]);
  return safe;
}
function finalized(value) {
  if (!Object.hasOwn(SLOTS,value?.market) || !FINAL_STATUSES.has(value.status)) return null;
  return { market: value.market, status: value.status, ...(typeof value.changed==='boolean'?{changed:value.changed}:{}), published: value.published === true, ...(typeof value.synchronized==='boolean'?{synchronized:value.synchronized}:{}) };
}
function activity(value) {
  const markets = names => [...new Set((Array.isArray(names) ? names : []).flatMap(name => {
    if (Object.hasOwn(SLOTS, name) || name === 'shared') return [name];
    if (name === 'SAMSUNG-SMB-AUTOMATION') return ['shared'];
    const match = /^Samsung-SMB-(MX|PE|CO|CL)$/i.exec(String(name));
    return match ? [match[1].toLowerCase()] : [];
  }))];
  return { known: typeof value?.idle === 'boolean' || value?.known === true, active: markets(value?.active), queued: markets(value?.queued) };
}
function cleanCycle(input) {
  if (input?.schemaVersion !== 1 || !['S1', 'S2'].includes(input.environment) || !timestamp(input.startedAt)) return null;
  const result = {
    schemaVersion: 1, environment: input.environment, startedAt: timestamp(input.startedAt),
    origin: ['KEEPALIVE','MANUAL_REFRESH','LEGACY_HEALTH'].includes(input.origin) ? input.origin : 'KEEPALIVE',
    finishedAt: timestamp(input.finishedAt), state: ['RUNNING', 'COMPLETE', 'BUSY', 'FAILED'].includes(input.state) ? input.state : 'FAILED',
    identities: (Array.isArray(input.identities) ? input.identities : []).map(identity).filter(Boolean),
    finalized: (Array.isArray(input.finalized) ? input.finalized : []).map(finalized).filter(Boolean), events: [],
  };
  result.identities = [...new Map(result.identities.map(row=>[row.market+':'+row.slot,row])).values()];
  result.finalized = [...new Map(result.finalized.map(row=>[row.market,row])).values()];
  if (input.activity) result.activity = activity(input.activity);
  // Only enumerated metadata crosses this boundary. No error message, hash,
  // account identifier, URL, environment variable or child output is persisted.
  for (const event of (Array.isArray(input.events) ? input.events : []).slice(-100)) {
    if (!timestamp(event.at)) continue;
    const record = identity(event);
    const bundle = finalized(event);
    if (record) result.events.push({ at: timestamp(event.at), kind: 'identity', ...record });
    else if (bundle) result.events.push({ at: timestamp(event.at), kind: 'bundle', ...bundle });
    else if (event.kind === 'activity') result.events.push({ at: timestamp(event.at), kind: 'activity', ...activity(event) });
  }
  return result;
}
function readCycles({ directory = dataDirectory(), environment = 'S2' } = {}) {
  let names;
  try { names = fs.readdirSync(directory); } catch (error) { if (error.code === 'ENOENT') return { cycles: [], corrupt: 0 }; throw error; }
  let corrupt = 0;
  const cycles = [];
  for (const name of names.filter(name => FILE.test(name))) {
    try {
      if (fs.statSync(path.join(directory, name)).size > 262144) { corrupt++; continue; }
      const cycle = cleanCycle(JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
      if (!cycle) corrupt++;
      else if (cycle.environment === environment) cycles.push(cycle);
    } catch { corrupt++; }
  }
  return { cycles: cycles.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)), corrupt };
}
function prune({ directory, now = Date.now(), maxCycles = 3000, maxAgeMs = 30 * 86400000 }) {
  const names = fs.readdirSync(directory).filter(name => FILE.test(name)).sort();
  for (let index = 0; index < names.length; index++) {
    const name = names[index];
    if (index < names.length - maxCycles || now - Number(name.slice(6, 19)) > maxAgeMs) fs.rmSync(path.join(directory, name), { force: true });
  }
}
function beginCycle({ environment = 'S2', markets = Object.keys(SLOTS) } = {}, { directory = dataDirectory(), now = Date.now, write = writeJsonAtomically } = {}) {
  if (!['S1', 'S2'].includes(environment)) throw new Error('Invalid auth operations environment.');
  const start = now();
  const file = path.join(directory, `cycle-${start}-${crypto.randomUUID()}.json`);
  let cycle = { schemaVersion: 1, environment, startedAt: new Date(start).toISOString(), finishedAt: null, state: 'RUNNING', identities: [], finalized: [], events: [] };
  const persist = () => { cycle = cleanCycle(cycle); fs.mkdirSync(directory, { recursive: true }); write(file, cycle); };
  persist();
  return {
    event(event) {
      const record = identity(event), bundle = event?.kind === 'bundle' ? finalized(event) : null;
      const at = new Date(now()).toISOString();
      if (record) {
        const previous = cycle.identities.find(item => item.market === record.market && item.slot === record.slot);
        cycle.identities = cycle.identities.filter(item => item !== previous);
        cycle.identities.push({ ...previous, ...record });
        cycle.events.push({ at, kind: 'identity', ...record });
      } else if (bundle) {
        cycle.finalized = cycle.finalized.filter(item => item.market !== bundle.market).concat(bundle);
        cycle.events.push({ at, kind: 'bundle', ...bundle });
      } else if (event?.kind === 'activity') {
        cycle.activity = activity(event);
        cycle.events.push({ at, kind: 'activity', ...cycle.activity });
      }
      persist();
    },
    finish(summary, state = 'COMPLETE') {
      if (summary) {
        cycle.identities = (summary.identities || []).map(identity).filter(Boolean);
        cycle.finalized = (summary.finalized || []).map(finalized).filter(Boolean);
      } else if (state === 'BUSY') {
        cycle.identities = markets.flatMap(market => (SLOTS[market] || []).map(slot => ({ market, slot, status: 'BUSY' })));
      }
      cycle.state = state; cycle.finishedAt = new Date(now()).toISOString(); persist();
      prune({ directory, now: now() });
    },
  };
}
module.exports = { SLOTS, STATUSES, dataDirectory, identity, finalized, activity, cleanCycle, readCycles, prune, beginCycle };
