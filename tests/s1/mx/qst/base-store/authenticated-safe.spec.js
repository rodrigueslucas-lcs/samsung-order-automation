import { test, expect } from "../../dst/base-store/mx.auth.fixture";

test("MX QST 15 @qst @mx @base-store @safe @registered - Login via Home Page", async ({ page, mxConfig }) => {
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);
  await expect(page.getByRole("button", { name: "My Profile" })).toBeVisible({ timeout: 60000 });
});
