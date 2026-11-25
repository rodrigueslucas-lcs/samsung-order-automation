import { test } from "./mxQst.fixture";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { addMxBcProductToCart } from "../../../../../flows/mx/bcAddToCart";

test.describe.configure({ timeout: 420000 });
test.use({ screenshot: "off" });
test("SAM-24969 @qst @mx @base-store @safe - Add product from BC page", async ({}, testInfo) => {
  evidenceContext.recordBusinessEvidence(testInfo, qstEvidenceMetadata.getMxQstEvidenceMetadata("SAM-24969"));
  await test.step("Add the configured BC product and verify its persisted cart quantity", () => addMxBcProductToCart(testInfo));
});
