import { test, expect } from "./mxQst.fixture";
import { openMxQstPdp, openMxService, prepareMxQstCart } from "./mxQstFlows";

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

test("MX QST 09 @qst @mx @base-store @safe - Add Trade-In", async ({ page, mxConfig }) => {
  await prepareMxQstCart(page, mxConfig);
  await openMxService(page, "Galaxy Canje");
  await expect(page.getByText(/Selecciona el dispositivo/i).filter({ visible: true }).last()).toBeVisible();
  await expect(page.getByText(/Recibe una oferta por tu dispositivo actual/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Continuar/i }).filter({ visible: true })).toBeVisible();
});

test("MX QST 10 @qst @mx @base-store @safe - Add Samsung Care+", async ({ page, mxConfig }) => {
  await prepareMxQstCart(page, mxConfig);
  await openMxService(page, "Samsung Care\\+");
  const careText = page.getByText(/Samsung Care\+/i).filter({ visible: true });
  await expect(careText.last()).toBeVisible();
  const checkedOption = page.getByRole("radio", { checked: true }).filter({ visible: true });
  await expect(checkedOption.first()).toBeVisible({ timeout: 30000 });
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
  await expect(page.getByRole("main").getByText(/Samsung Care\+/i).filter({ visible: true }).last()).toBeVisible({
    timeout: 30000,
  });
});
