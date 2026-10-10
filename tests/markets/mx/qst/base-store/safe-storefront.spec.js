import evidenceContext from "../../../../../reporting/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "./mxQst.fixture";
import { openMxQstPdp, openMxService, prepareMxQstCart } from "./mxQstFlows";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

test.describe.configure({ timeout: 300000 });

test("MX QST 05 @qst @mx @base-store @safe - PDP variants other than color", async ({ page, mxConfig }) => {
  await openMxQstPdp(page, mxConfig);
  const color = page.getByRole("button", { name: "Azul", exact: true });
  const storage256 = page.getByRole("button", { name: "256GB", exact: true });
  const storage512 = page.getByRole("button", { name: "512GB", exact: true });
  await expect(color).toBeVisible();
  await expect(storage256).toBeVisible();
  await expect(storage512).toBeVisible();
  await expect(page.getByText("Choose your color", { exact: true })).toBeVisible();
  expect(await storage256.innerText()).toBe("256GB");
  expect(await storage512.innerText()).toBe("512GB");
  await storage512.click();
  await expect(page.getByText(/Almacenamiento \(GB\)/i)).toBeVisible({ timeout: 30000 });
});

test("SAM-24981 @qst @mx @base-store @safe - Add Samsung Care+", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24981"));

  await test.step("Prepare the controlled MX cart", async () => {
    await prepareMxQstCart(page, mxConfig);
  });

  await test.step("Open Samsung Care+ and validate the available protection option", async () => {
    await openMxService(page, "Samsung Care\\+");
    const careText = page.getByText(/Samsung Care\+/i).filter({ visible: true });
    await expect(careText.last()).toBeVisible();
    const checkedOption = page.getByRole("radio", { checked: true }).filter({ visible: true });
    await expect(checkedOption.first()).toBeVisible({ timeout: 30000 });
  });

  await test.step("Accept Samsung Care+ terms and add the service to the cart", async () => {
    const terms = page.getByRole("checkbox").filter({ visible: true });
    expect(await terms.count()).toBeGreaterThan(0);
    for (let index = 0; index < await terms.count(); index += 1) {
      const checkbox = terms.nth(index);
      if (!(await checkbox.isChecked())) {
        await checkbox.locator("..").click();
        await expect(checkbox).toBeChecked();
      }
    }
    const add = page.getByRole("button", { name: /Agregar al carrito/i }).filter({ visible: true }).last();
    await expect(add).toBeEnabled({ timeout: 30000 });
    await add.click();
  });

  await test.step("Validate Samsung Care+ is attached to the cart item", async () => {
    await expect(page.getByRole("main").getByText(/Samsung Care\+/i).filter({ visible: true }).last()).toBeVisible({
      timeout: 30000,
    });
  });
});
