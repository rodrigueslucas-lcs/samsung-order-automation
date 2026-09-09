const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs } = require("../scripts/record-preqa2-result.cjs");

test("result recorder CLI maps supported arguments", () => {
  assert.deepEqual(
    parseArgs([
      "MX", "SAM-24968", "PASS",
      "--path", "/mx/smartphones/",
      "--context", "guest",
      "--evidence", "Facet changed result set",
      "--automation", "implemented",
    ]),
    {
      market: "MX",
      id: "SAM-24968",
      status: "PASS",
      runtimeUrl: "/mx/smartphones/",
      context: "guest",
      evidence: "Facet changed result set",
      automation: "implemented",
    }
  );
});

test("result recorder CLI fails closed for missing and unsupported arguments", () => {
  assert.throws(() => parseArgs(["MX", "SAM-24968"]), /Usage:/);
  assert.throws(
    () => parseArgs(["MX", "SAM-24968", "PASS", "--secret", "x"]),
    /Unsupported option/
  );
  assert.throws(
    () => parseArgs(["MX", "SAM-24968", "PASS", "--evidence"]),
    /Invalid argument/
  );
});
