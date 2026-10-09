import { test, expect } from "./epp.fixture";
import { openEppHome } from "./eppFlows";

test("TC10 @dst @epp @base-store - EPP homepage attributes", async ({ page, eppConfig }) => {
  test.setTimeout(180000);
  const home = await openEppHome(page, eppConfig);
  const attributes = await home.validateHomepageAttributes();
  expect(attributes.headerVisible).toBe(true);
  expect(attributes.footerVisible).toBe(true);
});
