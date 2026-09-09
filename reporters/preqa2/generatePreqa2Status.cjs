#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const ledger = require("../../test-mapping/preqa2-validation.json");
const { getCampaignSummary } = require("../../utils/preqa2CampaignPlan");
const { reconciliationSummary } = require("../../utils/preqa2Reconciliation");
const { getPreqa2PromotionSummary } = require("../../utils/preqa2PromotionPlan");
const { validatePreqa2ValidationLedger } = require("../../utils/preqa2ValidationLedger");
const { sanitizeString } = require("../evidence/sanitizer");

function buildStatusModel() {
  validatePreqa2ValidationLedger();
  const campaign = getCampaignSummary();
  const reconciliation = reconciliationSummary();
  const promotions = getPreqa2PromotionSummary();
  const markets = {};

  for (const market of ["MX", "CL", "CO", "PE"]) {
    const results = ledger.markets[market].results || {};
    const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_APPLICABLE: 0 };
    for (const result of Object.values(results)) {
      if (Object.hasOwn(counts, result.status)) counts[result.status] += 1;
    }
    markets[market] = {
      ...campaign[market],
      ...reconciliation[market],
      ...counts,
      status: ledger.markets[market].status,
    };
  }

  return {
    authority: ledger.authority,
    total: Object.values(markets).reduce((sum, entry) => sum + entry.officialTotal, 0),
    executed: Object.values(markets).reduce((sum, entry) => sum + entry.executed, 0),
    pass: Object.values(markets).reduce((sum, entry) => sum + entry.PASS, 0),
    fail: Object.values(markets).reduce((sum, entry) => sum + entry.FAIL, 0),
    blocked: Object.values(markets).reduce((sum, entry) => sum + entry.BLOCKED, 0),
    markets,
    promotions,
  };
}

function renderStatusMarkdown(model = buildStatusModel()) {
  const lines = [
    "# Samsung SMB PreQA2 validation status",
    "",
    sanitizeString(model.authority),
    "",
    `Official: ${model.total} | Executed: ${model.executed} | PASS: ${model.pass} | FAIL: ${model.fail} | BLOCKED: ${model.blocked}`,
    "",
    "| Market | Official | Executed | PASS | FAIL | Blocked | Pending | Safe | Guarded | Official review | Implemented |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const market of ["MX", "CL", "CO", "PE"]) {
    const entry = model.markets[market];
    lines.push(
      `| ${market} | ${entry.officialTotal} | ${entry.executed} | ${entry.PASS} | ${entry.FAIL} | ${entry.BLOCKED} | ` +
      `${entry.pending} | ${entry.safeCandidates} | ${entry.guardedReview} | ${entry.needsOfficialReview} | ${entry.implemented} |`
    );
  }

  lines.push(
    "",
    "## Evidence-backed promotion review",
    "",
    `MX promotion candidates: ${model.promotions.MX.promotionCandidates}`,
    `MX retained Full: ${model.promotions.MX.retainedFull}`,
    `PE official PASS results: ${model.promotions.PE.officialPasses}`,
    "",
    "No PASS is inferred from implementation presence or navigation-only discovery.",
    ""
  );
  return lines.join("\n");
}

function generatePreqa2Status({ outputPath = "test-results/preqa2/status.md" } = {}) {
  const target = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const model = buildStatusModel();
  fs.writeFileSync(target, renderStatusMarkdown(model));
  return { outputPath: target, model };
}

if (require.main === module) {
  const result = generatePreqa2Status();
  console.log(`PreQA2 status written to ${result.outputPath}`);
}

module.exports = { buildStatusModel, generatePreqa2Status, renderStatusMarkdown };
