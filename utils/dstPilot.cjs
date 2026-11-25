const fs = require('node:fs');
const crypto = require('node:crypto');
const registry = require('../governance/dst-pilot.json');

function pilotCase(id) {
  const entry = registry.cases.find(entry => entry.id === id);
  if (!entry) throw new Error(`DST_PILOT_UNKNOWN_ID: ${id}`);
  return entry;
}

function selectPilot({ market, ids, environment = 'S2' }) {
  market = String(market || '').toUpperCase();
  environment = String(environment).toUpperCase();
  if (!['MX', 'PE'].includes(market) || !['S1', 'S2'].includes(environment)) {
    throw new Error('DST_PILOT_INVALID_TARGET: use MX/PE and S1/S2.');
  }
  const requested = [...new Set(String(ids || '').split(/[\s,;]+/).filter(Boolean))];
  if (!requested.length) throw new Error('DST_PILOT_TARGET_REQUIRED: select explicit pilot SAM IDs; full campaigns are disabled.');
  return requested.map(id => {
    const entry = pilotCase(id);
    if (entry.market !== market) throw new Error(`DST_PILOT_WRONG_MARKET: ${id}`);
    if (entry.environmentRequired === 'S2_AND_PREQA2' && environment !== 'S2') {
      throw new Error(`DST_PILOT_ENVIRONMENT_REQUIRED: ${id} requires S2 and authenticated PreQA2.`);
    }
    return entry;
  });
}

function validateSources(read = file => fs.readFileSync(file)) {
  for (const [file, expected] of Object.entries(registry.sourceHashes)) {
    const actual = crypto.createHash('sha256').update(read(file).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
    if (actual !== expected) throw new Error(`DST_SOURCE_CHANGED: review official source ${file} before running.`);
  }
}

function evidence(id, environment) {
  const entry = pilotCase(id);
  return {
    suite: 'DST', market: entry.market, store: entry.store, environment,
    zephyrId: id, sourceRowKey: entry.sourceRowKey, officialScenario: entry.scenario,
    definitionStatus: entry.definitionStatus,
    formalHomologation: entry.formalHomologation,
  };
}

// Payment/order endpoints remain forbidden even if the operator exported an ALLOW flag.
function isFinancialSubmission(method, value) {
  const url = new URL(value);
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) &&
    /(?:place.?order|submit.?order|(?:^|\/)orders(?:\/|$)|(?:^|\/)payments?(?:\/|$)|mercadoCc|mercadoCC|adyen|authorize|capture)/i.test(url.pathname);
}

module.exports = { registry, pilotCase, selectPilot, validateSources, evidence, isFinancialSubmission };
