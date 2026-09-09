const { test, expect } = require("@playwright/test");
const { recordBusinessEvidence } = require("../../reporters/evidence/evidenceContext");

test("dummy pass with SMB evidence", async ({}, testInfo) => {
  recordBusinessEvidence(testInfo, {
    zephyrId: "SAM-DUMMY-1", market: "MX", store: "BS", suite: "QST",
    feature: "reporting", orderCode: "MX-DUMMY", password: "must-not-leak",
  });
  await testInfo.attach("dummy-screenshot", {
    body: Buffer.from("not a real image"), contentType: "image/png",
  });
  expect(true).toBe(true);
});

test("dummy expected failure", async ({}, testInfo) => {
  test.fail();
  recordBusinessEvidence(testInfo, { market: "CL", token: "must-not-leak" });
  expect(true).toBe(false);
});

test("dummy retry", async ({}, testInfo) => {
  if (testInfo.retry === 0) expect(true).toBe(false);
  expect(true).toBe(true);
});
