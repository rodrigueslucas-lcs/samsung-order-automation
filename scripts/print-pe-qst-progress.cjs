const { getPeS1ImplementationProgress } = require("../utils/qstPeProgress");

const progress = getPeS1ImplementationProgress();
console.log(`PE S1 implementation: ${progress.implementedCount}/${progress.officialTotal}; pending=${progress.pendingCount}`);
for (const [reuse, bucket] of Object.entries(progress.byReuse)) {
  console.log(`${reuse}: implemented=${bucket.implemented}, pending=${bucket.pending}`);
  if (bucket.pendingIds.length) console.log(`  pending: ${bucket.pendingIds.join(", ")}`);
}
