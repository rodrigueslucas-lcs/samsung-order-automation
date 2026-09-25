const pePlan = require("../test-mapping/pe-qst-reuse-plan.json");
const { validateOfficialImplementation } = require("./qstImplementation");

function getPeImplementationProgress() {
  const inventory = validateOfficialImplementation().PE;
  const implemented = new Set(inventory.implementedIds);
  const progress = {
    officialTotal: pePlan.officialTotal,
    implementedCount: implemented.size,
    pendingCount: pePlan.officialTotal - implemented.size,
    implementedIds: [...implemented].sort(),
    pendingIds: [],
    byReuse: {},
  };

  for (const reuse of ["directCandidate", "extensionCandidate", "destructiveCandidate", "missing"]) {
    progress.byReuse[reuse] = { implemented: 0, pending: 0, implementedIds: [], pendingIds: [] };
  }

  for (const [id, entry] of Object.entries(pePlan.cases || {})) {
    const bucket = progress.byReuse[entry.reuse];
    if (!bucket) throw new Error(`Unexpected PE reuse classification for ${id}: ${entry.reuse}`);
    if (implemented.has(id)) {
      bucket.implemented += 1;
      bucket.implementedIds.push(id);
    } else {
      bucket.pending += 1;
      bucket.pendingIds.push(id);
      progress.pendingIds.push(id);
    }
  }

  progress.pendingIds.sort();
  for (const bucket of Object.values(progress.byReuse)) {
    bucket.implementedIds.sort();
    bucket.pendingIds.sort();
  }
  return progress;
}

// Temporary compatibility export for any external caller that still uses the
// old environment-specific function name.
const getPeS1ImplementationProgress = getPeImplementationProgress;

module.exports = { getPeImplementationProgress, getPeS1ImplementationProgress };
