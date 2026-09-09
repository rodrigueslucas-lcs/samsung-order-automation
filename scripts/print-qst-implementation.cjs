const { validateS1OfficialImplementation } = require("../utils/qstS1Implementation");

const inventory = validateS1OfficialImplementation();
for (const [market, entry] of Object.entries(inventory)) {
  console.log(`${market}: ${entry.implementedCount}/${entry.officialTotal} official IDs implemented in S1 specs`);
  for (const id of entry.implementedIds) console.log(`- ${id}`);
}
