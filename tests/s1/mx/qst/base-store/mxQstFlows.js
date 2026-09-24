import { expect, test } from "@playwright/test";
import CartPage from "../../../../../pages/CartPage";
import ProductPage from "../../../../../pages/ProductPage";
import cartPresentation from "../../../../../flows/smb/cartPresentation";
import mxStagingGuard from "../../../../../utils/mxStagingGuard";

const { validateCartItemPresentation, validateStickyControl } = cartPresentation;
const { assertMxStagingPage } = mxStagingGuard;

async function bootstrapMx(page, config) {
  await test.step(`Bootstrap MX ${config.environment || "staging"} storefront session`, async () => {
    const currentUrl = new URL(page.url());
    const alreadyReady =
      currentUrl.hostname === config.hostname &&
      (currentUrl.pathname === "/mx" || currentUrl.pathname.startsWith("/mx/"));

    if (!alreadyReady) {
      await page.goto(config.bootstrapUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.goto(config.baseUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await assertMxStagingPage(page, "MX QST flow bootstrap");
  });
}

export function mxQstCart(page, config) {
  return new CartPage(page, {
    cartUrl: config.cartUrl.toString(),
    sku: config.sku,
    productNamePattern: null,
    orderSummaryPattern: /Resumen de tu pedido/i,
    totalPattern: /Total con IVA/i,
    checkoutButtonPattern: /Finalizar Compra/i,
    currencyPattern: /\$\s*[\d,.]+/,
  });
}

async function readMxCartUiState(page) {
  const main = page.getByRole("main");
  const emptyCart = main
    .getByText(/(?:Su|Tu) carrito est[aá] vac[ií]o|carrito.*vac[ií]o/i)
    .filter({ visible: true });
  if (await emptyCart.first().isVisible().catch(() => false)) {
    return { kind: "empty", removeCount: 0 };
  }

  const removeButtons = main
    .locator('button[aria-label="Remove"]:enabled')
    .filter({ visible: true });
  const removeCount = await removeButtons.count();
  if (removeCount > 0) {
    return { kind: "removable", removeCount, removeButtons };
  }

  const loadingCount = await page
    .locator('[aria-busy="true"], [class*="skeleton" i], [class*="loading" i], [class*="spinner" i]')
    .filter({ visible: true })
    .count()
    .catch(() => 0);

  return { kind: "pending", removeCount: 0, loadingCount };
}

async function waitForMxCartUiState(page, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let lastState = { kind: "pending", removeCount: 0, loadingCount: 0 };

  while (Date.now() < deadline) {
    lastState = await readMxCartUiState(page);
    if (lastState.kind !== "pending") return lastState;
    await page.waitForTimeout(500);
  }

  return lastState;
}

async function cartDiagnostic(page) {
  const mainText = await page
    .getByRole("main")
    .innerText({ timeout: 5000 })
    .catch(() => "");
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    main: String(mainText || "").replace(/\s+/g, " ").trim().slice(0, 500),
  };
}

async function resetMxCartViaUi(page, config) {
  await page.goto(config.cartUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  const main = page.getByRole("main");
  await main.waitFor({ state: "attached", timeout: 30000 });

  let recoveryReloads = 0;

  for (let removed = 0; removed < 20; removed += 1) {
    const state = await waitForMxCartUiState(page, 30000);
    if (state.kind === "empty") return;

    if (state.kind === "pending") {
      if (recoveryReloads < 1) {
        recoveryReloads += 1;
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        await main.waitFor({ state: "attached", timeout: 30000 });
        continue;
      }

      const diagnostic = await cartDiagnostic(page);
      throw new Error(
        `MX cart reset remained in an indeterminate UI state after controlled recovery. ` +
        `url=${diagnostic.url} title=${diagnostic.title} loading=${state.loadingCount || 0} main=${diagnostic.main || "<empty>"}`
      );
    }

    recoveryReloads = 0;
    const removeButton = state.removeButtons.first();
    try {
      await removeButton.click();
    } catch (error) {
      if ((await readMxCartUiState(page)).kind === "empty") return;
      throw error;
    }

    const dialog = page
      .getByRole("dialog")
      .or(page.getByRole("alertdialog"))
      .filter({ hasText: /Eliminar producto del carrito/i })
      .filter({ visible: true })
      .first();
    await dialog.waitFor({ state: "visible", timeout: 30000 });

    const confirm = dialog
      .getByRole("button", { name: /^S[ií]$/i })
      .filter({ visible: true })
      .first();
    await confirm.waitFor({ state: "visible", timeout: 30000 });

    await Promise.all([
      dialog.waitFor({ state: "hidden", timeout: 30000 }),
      confirm.click(),
    ]);
  }

  throw new Error("MX cart reset exceeded the 20-item safety limit.");
}

async function normalizeControlledQuantity(item, quantity) {
  let current = Number(await quantity.inputValue());
  if (!Number.isInteger(current) || current < 1) {
    throw new Error(`Controlled MX cart rendered invalid quantity: ${await quantity.inputValue()}.`);
  }

  if (current === 1) return;

  const minus = item.getByRole("button", { name: "-", exact: true });
  await expect(minus).toBeVisible({ timeout: 30000 });

  while (current > 1) {
    await expect(minus).toBeEnabled({ timeout: 30000 });
    const expected = String(current - 1);
    await minus.click();
    await expect(quantity).toHaveValue(expected, { timeout: 30000 });
    current -= 1;
  }
}

async function validateControlledCartUi(page, config) {
  const main = page.getByRole("main");
  const sku = main.getByText(config.sku, { exact: true }).filter({ visible: true });
  await expect(sku).toHaveCount(1, { timeout: 30000 });

  const item = sku.first().locator(
    "xpath=ancestor::*[.//input[@aria-label='Quantity'] and .//button[@aria-label='Remove']][1]"
  );
  const quantity = item.getByRole("textbox", { name: "Quantity" });
  await expect(quantity).toBeVisible({ timeout: 30000 });
  await normalizeControlledQuantity(item, quantity);
  await expect(quantity).toHaveValue("1", { timeout: 30000 });
  await expect(main.getByRole("button", { name: /^Remove$/i })).toHaveCount(1, { timeout: 30000 });
}

export async function openMxQstPdp(page, config) {
  await bootstrapMx(page, config);
  await test.step("Open controlled MX product detail page", async () => {
    await page.goto(config.pdpUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).toHaveURL(new RegExp(`/mx/p/${config.sku}`, "i"));
    const sku = page.getByText(config.sku, { exact: true }).first();
    const loaded = await sku.waitFor({ state: "visible", timeout: 30000 }).then(() => true).catch(() => false);
    if (!loaded) {
      const hasProductAction = await page.getByRole("button", { name: /^(Comprar|Agregar al carrito|Add to cart)$/i })
        .first().isVisible().catch(() => false);
      if (!hasProductAction) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        await expect(page).toHaveURL(new RegExp(`/mx/p/${config.sku}`, "i"));
      }
    }
    await expect(sku).toBeVisible({ timeout: 60000 });
  });
}

export async function prepareMxQstCart(page, config) {
  const cart = mxQstCart(page, config);
  await bootstrapMx(page, config);
  await test.step("Reset cart to a controlled state", async () => {
    await resetMxCartViaUi(page, config);
  });
  await openMxQstPdp(page, config);

  const product = new ProductPage(page, {
    setupUrl: config.bootstrapUrl.toString(),
    sku: config.sku,
    pdpUrl: config.pdpUrl.toString(),
    cartUrl: config.cartUrl.toString(),
  });
  await test.step("Add configured product to cart", async () => {
    await product.addConfiguredPdpToCart({
      waitForCartMutation: true,
      configureProduct: async (pdp) => {
        const storage = pdp.getByRole("button", { name: "512GB", exact: true });
        await expect(storage).toBeVisible({ timeout: 30000 });
        if (!/\bselected\b/.test((await storage.getAttribute("class")) || "")) {
          await storage.click();
        }
      },
    });
  });
  await test.step("Validate controlled cart state", async () => {
    await validateControlledCartUi(page, config);
  });
  return cart;
}

export async function validateMxCartProductPresentation(page, config) {
  return validateCartItemPresentation(page, {
    sku: config.sku,
    currencyPattern: /\$\s*[\d,.]+/,
  });
}

export async function validateMxExternalServicesPresentation(page) {
  const main = page.getByRole("main");
  const serviceLabels = ["Galaxy Canje", "Samsung Care+"];

  for (const serviceName of serviceLabels) {
    await expect(
      main.getByText(serviceName, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 30000 });
  }

  const addActions = main
    .getByText(/^Agregar ahora$/i, { exact: true })
    .filter({ visible: true });
  expect(await addActions.count()).toBeGreaterThanOrEqual(serviceLabels.length);
}

function parseMxCurrency(text) {
  const match = String(text || "").match(/\$\s*([\d,.]+)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}

export async function validateMxCheckoutSummaryPresentation(page) {
  return test.step("Validate checkout order summary", async () => {
    const summaryHeading = page.getByRole("heading", {
      name: "Resumen de tu pedido",
      level: 2,
    });
    const totalHeading = page.getByRole("heading", {
      name: "Total con IVA",
      level: 3,
    });

    await expect(summaryHeading).toBeVisible({ timeout: 30000 });
    await expect(totalHeading).toBeVisible({ timeout: 30000 });

    const summaryBlock = summaryHeading.locator(
      "xpath=ancestor::*[.//*[normalize-space()='Subtotal'] and .//*[normalize-space()='IVA']][1]"
    );
    await expect(summaryBlock).toBeVisible({ timeout: 30000 });

    const summaryText = await summaryBlock.innerText();
    const totalText = await totalHeading.locator("..").innerText();

    expect(summaryText).toMatch(/Subtotal/i);
    expect(summaryText).toMatch(/\bIVA\b/i);

    const subtotalMatch = summaryText.match(/Subtotal\s*\$\s*([\d,.]+)/i);
    const ivaMatch = summaryText.match(/\bIVA\s*\$\s*([\d,.]+)/i);
    const subtotal = parseMxCurrency(subtotalMatch ? `$${subtotalMatch[1]}` : "");
    const iva = parseMxCurrency(ivaMatch ? `$${ivaMatch[1]}` : "");
    const total = parseMxCurrency(totalText);

    expect(subtotal).not.toBeNull();
    expect(iva).not.toBeNull();
    expect(total).not.toBeNull();
    expect(subtotal).toBeGreaterThan(0);
    expect(iva).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);

    return {
      subtotal,
      iva,
      total,
      voucherVisible: (await page.getByText(/Voucher|Cup[oó]n/i).filter({ visible: true }).count()) > 0,
      promoVisible: (await page.getByText(/Promoci[oó]n|Promo/i).filter({ visible: true }).count()) > 0,
    };
  });
}

export { validateStickyControl };

export async function openMxService(page, name) {
  return test.step(`Open ${name.replace(/\\\\/g, "")} service configuration`, async () => {
    const button = page.getByRole("button", {
      name: new RegExp(`Agregar ahora\\s*${name}`, "i"),
    });
    await expect(button).toBeVisible({ timeout: 30000 });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const surface = page.getByRole("dialog").filter({ visible: true }).or(
      page.locator("[role='presentation']:visible").filter({ hasText: new RegExp(name, "i") })
    ).first();
    await expect(page.getByText(new RegExp(name, "i")).filter({ visible: true }).last()).toBeVisible({
      timeout: 30000,
    });
    return surface;
  });
}
