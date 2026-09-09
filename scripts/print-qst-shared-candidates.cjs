const { getSharedCandidatesByMarket } = require("../utils/qstSharedCandidates");

for (const market of ["MX", "CL", "CO", "PE"]) {
  const candidates = getSharedCandidatesByMarket(market);
  console.log(`${market}: ${candidates.length} shared-core candidate IDs`);
  for (const candidate of candidates) {
    console.log(`- ${candidate.id} | ${candidate.family} | ${candidate.feature}`);
  }
}
