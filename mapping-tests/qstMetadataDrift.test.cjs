const test = require("node:test");
const assert = require("node:assert/strict");
const { auditMxMetadataDrift } = require("../utils/qstMetadataDrift");

test("MX coverage and architecture registries contain the same 37 official IDs", () => {
  const audit = auditMxMetadataDrift();
  assert.equal(audit.officialCoverageCount, 37);
  assert.equal(audit.architectureCount, 37);
  assert.deepEqual(audit.missingArchitecture, []);
  assert.deepEqual(audit.architectureOnly, []);
});

test("metadata audit reports taxonomy/title drift without rewriting either source", () => {
  const audit = auditMxMetadataDrift();
  assert.ok(Array.isArray(audit.titleDrift));
  assert.ok(Array.isArray(audit.featureDrift));
  assert.ok(audit.titleDrift.length > 0 || audit.featureDrift.length > 0);
  for (const item of [...audit.titleDrift, ...audit.featureDrift]) {
    assert.match(item.id, /^SAM-\d+$/);
  }
});
