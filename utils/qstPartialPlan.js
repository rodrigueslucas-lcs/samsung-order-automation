const mxCoverage = require("../test-mapping/mx-qst-coverage.json");
const mxPartialPlan = require("../test-mapping/mx-qst-partial-plan.json");

const GROUPS = Object.freeze([
  "quickAssertion",
  "existingFlowExtension",
  "newBusinessFlow",
  "eppContext",
]);

function validateMxPartialPlan() {
  const errors = [];
  const expectedPartialIds = Object.entries(mxCoverage.cases || {})
    .filter(([, current]) => current.coverage === "partial")
    .map(([id]) => id)
    .sort();

  if (mxPartialPlan.market !== "MX") {
    errors.push(`partial plan market: expected MX, found ${mxPartialPlan.market || "<missing>"}`);
  }

  const plannedEntries = [];
  for (const group of GROUPS) {
    const entries = mxPartialPlan.groups?.[group] || [];
    plannedEntries.push(...entries.map((entry) => ({ ...entry, group })));

    if (mxPartialPlan.summary?.[group] !== entries.length) {
      errors.push(
        `${group}: declared ${mxPartialPlan.summary?.[group]}, actual ${entries.length}`
      );
    }

    for (const entry of entries) {
      if (!entry.id || !entry.title || !entry.reason) {
        errors.push(`${group}: every entry requires id, title and reason`);
      }
    }
  }

  const plannedIds = plannedEntries.map(({ id }) => id).filter(Boolean);
  const duplicates = plannedIds.filter((id, index) => plannedIds.indexOf(id) !== index);
  if (duplicates.length) {
    errors.push(`partial plan duplicate IDs: ${[...new Set(duplicates)].join(", ")}`);
  }

  const actualIds = [...new Set(plannedIds)].sort();
  const missing = expectedPartialIds.filter((id) => !actualIds.includes(id));
  const extra = actualIds.filter((id) => !expectedPartialIds.includes(id));
  if (missing.length) errors.push(`partial plan missing IDs: ${missing.join(", ")}`);
  if (extra.length) errors.push(`partial plan non-partial IDs: ${extra.join(", ")}`);

  if (mxPartialPlan.summary?.partialTotal !== expectedPartialIds.length) {
    errors.push(
      `partialTotal: declared ${mxPartialPlan.summary?.partialTotal}, actual ${expectedPartialIds.length}`
    );
  }

  const priority = mxPartialPlan.priority || [];
  const priorityDuplicates = priority.filter((id, index) => priority.indexOf(id) !== index);
  if (priorityDuplicates.length) {
    errors.push(`priority duplicate IDs: ${[...new Set(priorityDuplicates)].join(", ")}`);
  }
  const priorityMissing = expectedPartialIds.filter((id) => !priority.includes(id));
  const priorityExtra = priority.filter((id) => !expectedPartialIds.includes(id));
  if (priorityMissing.length) errors.push(`priority missing IDs: ${priorityMissing.join(", ")}`);
  if (priorityExtra.length) errors.push(`priority non-partial IDs: ${priorityExtra.join(", ")}`);

  if (errors.length) {
    throw new Error(`Invalid MX QST partial plan:\n${errors.join("\n")}`);
  }

  return {
    market: "MX",
    partialTotal: expectedPartialIds.length,
    groups: Object.fromEntries(
      GROUPS.map((group) => [group, (mxPartialPlan.groups?.[group] || []).length])
    ),
  };
}

module.exports = { GROUPS, validateMxPartialPlan };
