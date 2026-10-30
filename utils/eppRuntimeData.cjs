const fs = require('node:fs');
const path = require('node:path');
const filename = path.resolve(__dirname, '../playwright/.auth/epp/runtime-data.json');

function getEppRuntimeData(config, io = fs) {
  if (!io.existsSync(filename)) return null;
  try {
    const source = JSON.parse(io.readFileSync(filename, 'utf8'));
    const market = source[config.environment]?.[config.market];
    const data = config.programNamespace ? market?.programs?.[config.programNamespace] : market;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch { throw new Error('EPP ignored QA data file is invalid; contents suppressed.'); }
}
function getEppContact(config, io = fs) {
  const contact = getEppRuntimeData(config, io)?.contact;
  if (!contact) return null;
  if (!['firstName','lastName','phone'].every(name => typeof contact[name] === 'string' && contact[name].trim())) throw new Error('EPP QA contact fields are incomplete; contents suppressed.');
  return contact;
}
module.exports = { getEppRuntimeData, getEppContact };
