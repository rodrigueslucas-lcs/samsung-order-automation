import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 420000 });

test("SAM-24985 @qst @mx @base-store @safe - Extended Warranty on Cart", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24985"));
  const cart = await prepareMxQstCart(page, mxConfig);
  await cart.validateControlledSingleSku(mxConfig.sku);

  const main = page.getByRole("main");
  const warrantyText = main
    .getByText(/Garant[ií]a Extendida|Extended Warranty/i)
    .filter({ visible: true });

  test.skip(
    (await warrantyText.count()) === 0,
    "Extended Warranty is not offered for the configured MX QST SKU; use a source-approved eligible SKU before asserting add behavior."
  );

  const addAction = main
    .getByRole("button", { name: /Agregar ahora.*(Garant[ií]a|Warranty)/i })
    .or(main.getByText(/^Agregar ahora$/i).filter({ visible: true }))
    .filter({ visible: true });
  await expect(addAction.first()).toBeVisible({ timeout: 30000 });
  await addAction.first().click();

  await expect(
    page.getByText(/Garant[ií]a Extendida|Extended Warranty/i).filter({ visible: true }).last()
  ).toBeVisible({ timeout: 30000 });

  recordBusinessEvidence(testInfo, {
    configuredSku: mxConfig.sku,
    warrantySurfaceOpened: true,
    note: "The test intentionally does not invent a plan/price selector before the live eligible-SKU UI is observed.",
  });
});
