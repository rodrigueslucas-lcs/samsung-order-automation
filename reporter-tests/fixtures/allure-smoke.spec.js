const { test, expect } = require("@playwright/test");

test("Allure reporter smoke generates a passing result", async ({}, testInfo) => {
  await testInfo.attach("smoke-evidence", {
    body: Buffer.from("allure-smoke-evidence"),
    contentType: "text/plain",
  });

  expect(2 + 2).toBe(4);
});
