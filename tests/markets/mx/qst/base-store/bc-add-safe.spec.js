import { test } from "./mxQst.fixture";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { addProductFromPreQaBc } from "../../../../../flows/smb/preQaBcCart";

test.describe.configure({ timeout: 420000 });
test.use({ screenshot: "off" });
test("SAM-24969 @qst @mx @base-store @safe - Add product from BC page", async ({}, testInfo) => {
  evidenceContext.recordBusinessEvidence(testInfo, qstEvidenceMetadata.getMxQstEvidenceMetadata("SAM-24969"));
  await test.step("Add the configured BC product and verify its persisted cart quantity", async () => {
    const result = await addProductFromPreQaBc({ market: 'mx', sku: 'SM-A065MLBALTM', plpPath: '/mx/smartphones/all-smartphones/', pdpBuyingTool: true, testInfo });
    evidenceContext.recordBusinessEvidence(testInfo, { ...result, sku: result.modelCode });
  });
});
