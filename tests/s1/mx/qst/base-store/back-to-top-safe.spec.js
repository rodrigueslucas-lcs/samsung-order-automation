import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-25001 @qst @mx @base-store @safe - Back to Top remains actionable with cart UI present", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25001"));
  await prepareMxQstCart(page, mxConfig);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 30000 });

  const backToTop = page
    .getByRole("button", { name: /Back to Top|Volver arriba|Ir arriba|Subir/i })
    .or(page.locator('button[class*="top" i], a[class*="top" i]').filter({ visible: true }))
    .filter({ visible: true })
    .first();

  await expect(backToTop).toBeVisible({ timeout: 30000 });
  await backToTop.scrollIntoViewIfNeeded();

  const hitTarget = await backToTop.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return top === element || element.contains(top) || top?.contains(element) || false;
  });
  expect(hitTarget, "Back to Top is visually covered by another cart element.").toBeTruthy();

  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 30000 }).toBeLessThan(100);

  recordBusinessEvidence(testInfo, {
    visibleAtBottom: true,
    unobstructedHitTarget: true,
    returnedToTop: true,
  });
});
