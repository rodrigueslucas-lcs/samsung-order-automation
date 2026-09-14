import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-25001 @qst @mx @base-store @safe - Back to Top is behind cart tooltip", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-25001"));
  await prepareMxQstCart(page, mxConfig);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 30000 });

  const backToTop = page.locator([
    '[data-an-la*="back to top" i]',
    '[data-an-tr*="back to top" i]',
    '[aria-label*="back to top" i]',
    '[aria-label*="volver arriba" i]',
    '[aria-label*="subir" i]',
    '[title*="back to top" i]',
    '[title*="volver arriba" i]',
    '[class*="back-to-top" i]',
    '[class*="backtotop" i]',
    '[class*="scroll-top" i]',
    '[class*="scrolltop" i]',
    '[class*="go-top" i]',
    '[class*="gotop" i]',
  ].join(", ")).first();

  test.skip(
    (await backToTop.count()) === 0,
    "Live MX S1 cart did not expose a stable Back-to-Top selector from the currently known semantic/analytics attributes; keep this blocked instead of asserting the wrong element."
  );

  let tooltip = page
    .locator('[role="tooltip"]:visible, [class*="tooltip" i]:visible, [class*="popover" i]:visible')
    .last();

  if (!(await tooltip.isVisible().catch(() => false))) {
    const infoTrigger = page
      .locator([
        'button[aria-label*="info" i]:visible',
        '[role="button"][aria-label*="info" i]:visible',
        'button[title*="info" i]:visible',
        '[data-tooltip]:visible',
      ].join(", "))
      .last();

    test.skip(
      (await infoTrigger.count()) === 0,
      "No stable cart info/tooltip trigger was exposed in MX S1; the official TC requires the tooltip state, so it must not be replaced by a plain Back-to-Top click test."
    );

    await infoTrigger.scrollIntoViewIfNeeded();
    await infoTrigger.hover();
    if (!(await tooltip.isVisible().catch(() => false))) {
      await infoTrigger.click();
    }
    tooltip = page
      .locator('[role="tooltip"]:visible, [class*="tooltip" i]:visible, [class*="popover" i]:visible')
      .last();
  }

  await expect(tooltip).toBeVisible({ timeout: 30000 });

  const geometry = await page.evaluate(({ backSelector, tooltipSelector }) => {
    const back = document.querySelector(backSelector);
    const tipCandidates = [...document.querySelectorAll(tooltipSelector)].filter(
      (element) => element.getClientRects().length > 0
    );
    const tip = tipCandidates.at(-1);
    if (!back || !tip) return null;

    const backRect = back.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const overlap = !(
      backRect.right <= tipRect.left ||
      backRect.left >= tipRect.right ||
      backRect.bottom <= tipRect.top ||
      backRect.top >= tipRect.bottom
    );
    const x = Math.max(backRect.left, Math.min(backRect.right - 1, (backRect.left + backRect.right) / 2));
    const y = Math.max(backRect.top, Math.min(backRect.bottom - 1, (backRect.top + backRect.bottom) / 2));
    const top = document.elementFromPoint(x, y);
    return {
      overlap,
      tooltipIsTopHit: Boolean(top && (tip === top || tip.contains(top))),
      backPosition: getComputedStyle(back).position,
      tooltipPosition: getComputedStyle(tip).position,
    };
  }, {
    backSelector: [
      '[data-an-la*="back to top" i]',
      '[data-an-tr*="back to top" i]',
      '[aria-label*="back to top" i]',
      '[aria-label*="volver arriba" i]',
      '[aria-label*="subir" i]',
      '[title*="back to top" i]',
      '[title*="volver arriba" i]',
      '[class*="back-to-top" i]',
      '[class*="backtotop" i]',
      '[class*="scroll-top" i]',
      '[class*="scrolltop" i]',
      '[class*="go-top" i]',
      '[class*="gotop" i]',
    ].join(", "),
    tooltipSelector: '[role="tooltip"], [class*="tooltip" i], [class*="popover" i]',
  });

  expect(geometry, "Back-to-Top and tooltip geometry must be observable.").toBeTruthy();
  expect(geometry.overlap, "Official TC requires the cart tooltip to overlap the Back-to-Top control.").toBeTruthy();
  expect(geometry.tooltipIsTopHit, "Official TC requires Back-to-Top to stay behind the tooltip popup.").toBeTruthy();

  recordBusinessEvidence(testInfo, {
    tooltipVisible: true,
    overlapsBackToTop: geometry.overlap,
    tooltipAboveBackToTop: geometry.tooltipIsTopHit,
  });
});
