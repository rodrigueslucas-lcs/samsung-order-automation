const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const Reporter = require("../reporters/evidence/SmbEvidenceReporter");
const { recordBusinessEvidence, readBusinessEvidence } = require("../reporters/evidence/evidenceContext");
const { sanitize, sanitizeString } = require("../reporters/evidence/sanitizer");

test("redacts sensitive values recursively", () => {
  const clean = sanitize({
    password: "x", nested: { token: "y", cardNumber: "1", cvv: "2" },
    items: [{ authorization: "z", orderCode: "MX1" }],
  });
  assert.equal(clean.password, "[REDACTED]");
  assert.equal(clean.nested.token, "[REDACTED]");
  assert.equal(clean.nested.cardNumber, "[REDACTED]");
  assert.equal(clean.nested.cvv, "[REDACTED]");
  assert.equal(clean.items[0].authorization, "[REDACTED]");
  assert.equal(clean.items[0].orderCode, "MX1");
  assert.doesNotMatch(sanitizeString('token: "must-not-leak"'), /must-not-leak/);
});

test("records and merges optional business metadata", () => {
  const testInfo = { annotations: [] };
  recordBusinessEvidence(testInfo, { zephyrId: "SAM-25002", market: "MX" });
  recordBusinessEvidence(testInfo, { orderCode: "MX123", paymentMethod: "credit-card" });
  assert.deepEqual(readBusinessEvidence(testInfo.annotations), {
    zephyrId: "SAM-25002", market: "MX", orderCode: "MX123", paymentMethod: "credit-card",
  });
});

test("serializes pass, fail, retry, artifacts and resets between runs", async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-evidence-"));
  const reporter = new Reporter({ outputDir });
  const suite = { project: () => ({ name: "chromium" }) };
  const makeTest = (title) => ({
    id: title, title, parent: suite, location: { file: __filename }, annotations: [],
    titlePath: () => ["dummy", title],
  });

  reporter.onBegin();
  reporter.onTestEnd(makeTest("pass"), {
    status: "passed", retry: 1, workerIndex: 0, duration: 12,
    startTime: new Date("2026-01-01T00:00:00Z"), annotations: [],
    attachments: [{ name: "screenshot", contentType: "image/png", path: __filename }],
  });
  reporter.onTestEnd(makeTest("fail"), {
    status: "failed", retry: 0, workerIndex: 0, duration: 5,
    startTime: new Date("2026-01-01T00:00:01Z"), annotations: [], attachments: [],
    error: { message: "expected failure" },
  });
  await reporter.onEnd();

  const evidencePath = path.join(outputDir, "qst-evidence.json");
  const summaryPath = path.join(outputDir, "qst-summary.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.summary.total, 2);
  assert.equal(evidence.summary.attempts, 2);
  assert.equal(evidence.summary.passed, 1);
  assert.equal(evidence.summary.failed, 1);
  assert.equal(evidence.tests[0].retry, 1);
  assert.equal(evidence.tests[0].flaky, true);
  assert.equal(evidence.tests[0].screenshots.length, 1);
  assert.ok(JSON.parse(fs.readFileSync(summaryPath, "utf8")));

  reporter.onBegin();
  reporter.onTestEnd(makeTest("next run"), {
    status: "passed", retry: 0, workerIndex: 0, duration: 1,
    startTime: new Date(), annotations: [], attachments: [],
  });
  await reporter.onEnd();
  assert.equal(JSON.parse(fs.readFileSync(evidencePath, "utf8")).tests.length, 1);
});
