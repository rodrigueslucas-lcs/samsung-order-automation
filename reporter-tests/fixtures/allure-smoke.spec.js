const { test, expect } = require("@playwright/test");

test("Allure reporter smoke generates a passing result", async () => {
  expect(2 + 2).toBe(4);
});
