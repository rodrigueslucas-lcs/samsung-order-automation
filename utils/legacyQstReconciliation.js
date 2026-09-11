const legacy = require("../test-mapping/smb-qst.json");
const architecture = require("../test-mapping/smb-qst-architecture.json");
const mxCoverage = require("../test-mapping/mx-qst-coverage.json");
const peReuse = require("../test-mapping/pe-qst-reuse-plan.json");
const sharedFamilies = require("../test-mapping/smb-shared-core-families.json");
const { loadOfficialInventory } = require("./officialSmbInventory");
const { MX_P1_LEGACY_LINKS } = require("./officialRowEvidence");

const STOP = new Set(["a", "able", "and", "as", "be", "from", "in", "is", "of", "on", "page", "should", "the", "to", "user", "using", "validate", "verify", "verifiy", "verfiy"]);
const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/<br>/g, " ").replace(/[^a-z0-9+]+/g, " ").trim();
const tokens = (value) => new Set(normalize(value).split(/\s+/).filter((token) => token && !STOP.has(token)));

function similarity(left, right) {
  const a = tokens(left); const b = tokens(right);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function legacyDetails() {
  const details = { MX: {}, PE: {}, CL: {}, CO: {} };
  for (const row of architecture.markets.MX.cases) details.MX[row.id] = { title: row.title };
  for (const [id, row] of Object.entries(mxCoverage.cases)) details.MX[id] = { ...details.MX[id], title: row.title, context: row.store === "BS" ? "BASE_STORE" : "EPP" };
  for (const [id, row] of Object.entries(peReuse.cases)) details.PE[id] = { title: row.title, context: row.store === "BS" ? "BASE_STORE" : "EPP" };
  for (const family of sharedFamilies.families) for (const [market, ids] of Object.entries(family.ids)) for (const id of ids) details[market][id] ||= { title: family.family };
  return details;
}

function matchLegacyCase(market, officialId, detail, inventory) {
  if (market === "MX") {
    for (const [context, links] of Object.entries(MX_P1_LEGACY_LINKS)) {
      const serial = Object.keys(links).find((key) => links[key] === officialId);
      if (serial) return { classification: "CONFIDENT_MATCH", currentTemplateRowKey: `MX-${context}-${serial}`, currentContext: context, confidence: 1, basis: "explicit detailed legacy metadata to source-row mapping" };
    }
  }
  if (!detail?.title) return { classification: "NO_CURRENT_MATCH", currentTemplateRowKey: null, confidence: 0 };
  const candidates = [];
  for (const [context, data] of Object.entries(inventory.markets[market].contexts)) {
    if (detail.context && context !== detail.context) continue;
    for (const row of data.rows) candidates.push({ row, context, score: similarity(detail.title, row.scenario) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]; const second = candidates[1];
  if (!best || best.score < 0.24) return { classification: "NO_CURRENT_MATCH", currentTemplateRowKey: null, confidence: best?.score || 0 };
  if (second && best.score - second.score < 0.08) return { classification: "AMBIGUOUS", currentTemplateRowKey: null, confidence: best.score, candidates: candidates.slice(0, 2).map(({ row, score }) => ({ sourceRowKey: row.sourceRowKey, score })) };
  return { classification: best.score >= 0.5 ? "CONFIDENT_MATCH" : "LIKELY_MATCH", currentTemplateRowKey: best.row.sourceRowKey, currentContext: best.context, confidence: best.score };
}

function buildLegacyReconciliation() {
  const inventory = loadOfficialInventory(); const details = legacyDetails(); const markets = {};
  for (const [market, value] of Object.entries(legacy.markets)) markets[market] = value.cases.map((officialId) => {
    const detail = details[market][officialId];
    return { officialId, legacyTitle: detail?.title || null, legacyRepresentation: "QST_2026_09_02_EXECUTION_CAMPAIGN", legacyContext: detail?.context || "UNRESOLVED", ...matchLegacyCase(market, officialId, detail, inventory) };
  });
  const statuses = ["CONFIDENT_MATCH", "LIKELY_MATCH", "AMBIGUOUS", "NO_CURRENT_MATCH", "DUPLICATE_VARIANT"];
  const counts = Object.fromEntries(statuses.map((status) => [status, Object.values(markets).flat().filter((row) => row.classification === status).length]));
  return { generatedFrom: "test-mapping/smb-qst.json", sourceStatus: "READY", historicalTotal: legacy.total, counts, markets };
}

module.exports = { normalize, similarity, legacyDetails, matchLegacyCase, buildLegacyReconciliation };
