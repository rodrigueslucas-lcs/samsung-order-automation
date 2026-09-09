const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs } = require("../scripts/record-preqa2-result.cjs");

test("result recorder CLI maps supported arguments and defaults to no overwrite", () => {
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
      allowOverwrite: false,
      runtimeUrl: "/mx/smartphones/",
      context: "guest",
      evidence: "Facet changed result set",
      automation: "implemented",
    }
  );
});

test("result recorder CLI only enables replacement explicitly", () => {
  const parsed = parseArgs([
    "MX", "SAM-24968", "FAIL",
    "--evidence", "Official filter behavior failed",
    "--replace", "true",
  ]);
  assert.equal(parsed.allowOverwrite, true);
  assert.throws(
    () => parseArgs(["MX", "SAM-24968", "FAIL", "--replace", "yes"]),
    /--replace must be true or false/
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
