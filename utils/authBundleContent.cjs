const crypto = require('node:crypto');
const fs = require('node:fs');
const { writeJsonAtomically } = require('./atomicJson');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sessionContentHash(bundle) {
  if (!bundle || bundle.schemaVersion !== 1 || !['MX','PE','CO','CL'].includes(bundle.market) || !['S1','S2'].includes(bundle.environment) || !bundle.primary?.storageState || !bundle.primary?.sessionStorage) throw new Error('Invalid session bundle; publication refused.');
  const content = { schemaVersion: bundle.schemaVersion, market: bundle.market, environment: bundle.environment, primary: bundle.primary, second: bundle.second || null };
  return crypto.createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
}
function writeStableSessionBundle(file, bundle) {
  if (fs.existsSync(file)) {
    let previous;
    try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('Existing session bundle is unreadable; refusing to replace it silently.'); }
    if (sessionContentHash(previous) === sessionContentHash(bundle)) return previous;
  }
  sessionContentHash(bundle);
  writeJsonAtomically(file, bundle);
  return bundle;
}
module.exports = { canonical, sessionContentHash, writeStableSessionBundle };
