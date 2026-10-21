const { expect } = require('@playwright/test');

function clCareEvidence(cart, { sku, planSku }) {
  const entries = cart.entries || [];
  const product = entries.find(entry => entry.product?.code === sku && !entry.isServiceEntry);
  const selected = product?.selectedAddedServices?.filter(service => service.serviceProduct?.code === planSku) || [];
  const service = entries.filter(entry => entry.product?.code === planSku && entry.isServiceEntry);
  if (product?.quantity !== 1 || selected.length !== 1 || selected[0].quantity !== 1 ||
      service.length !== 1 || service[0].quantity !== 1 || !(service[0].totalPrice?.value > 0)) {
    throw new Error('CL cart did not persist the exact SC+ plan, linked to the quantity-one source product. Do not repeat the service addition.');
  }
  return { sku, planSku, productQuantity: product.quantity, serviceQuantity: service[0].quantity,
    servicePrice: service[0].totalPrice.value, total: cart.totalPrice?.value };
}

async function readClCart(page, config) {
  const response = page.waitForResponse(r => r.request().method() === 'GET' &&
    new URL(r.url()).hostname === `${config.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com` &&
    new URL(r.url()).pathname === '/tokocommercewebservices/v2/cl/users/current/carts/current', { timeout: 60000 });
  await page.goto(config.cartUrl.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const result = await response;
  if (!result.ok()) throw new Error(`CL cart readback failed with HTTP ${result.status()}.`);
  return result.json();
}

async function openClCareServices(page, config) {
  const services = page.waitForResponse(r => r.request().method() === 'GET' &&
    new URL(r.url()).hostname === `${config.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com` &&
    new URL(r.url()).pathname === `/tokocommercewebservices/v2/cl/servicesv2/externalService/${config.sku}`, { timeout: 60000 });
  // Native keyboard activation avoids losing the pointer target during hydration.
  const [available] = await Promise.all([services,
    page.getByRole('main').locator('button[data-an-la="add service:samsung care"]').press('Enter')]);
  if (!available.ok()) throw new Error(`CL Care+ services failed with HTTP ${available.status()}.`);
  await available.finished();
}

async function addAndValidateClCare(page, config) {
  if (!['https://stg.shop.samsung.com', 'https://stg2.shop.samsung.com'].includes(config.cartUrl.origin) ||
      config.cartUrl.pathname !== '/cl/cart') throw new Error('CL SC+ validation requires the CL staging cart.');
  const before = await readClCart(page, config);
  const product = before.entries?.find(entry => entry.product?.code === config.sku && !entry.isServiceEntry);
  if (product?.quantity !== 1 || product.selectedAddedServices?.length || before.entries?.some(entry => entry.isServiceEntry)) {
    throw new Error('CL SC+ requires a quantity-one source cart without an existing service; inspect before adding.');
  }
  await expect(page.getByRole('main').getByText(config.sku, { exact: true })).toBeVisible({ timeout: 60000 });
  await openClCareServices(page, config);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Servicios Adicionales', exact: true })).toBeVisible({ timeout: 30000 });
  const plan = dialog.locator('mat-radio-button').filter({ hasText: config.scPlusPlanSku });
  await expect(plan).toHaveCount(1);
  await plan.click();
  await expect(plan.locator('input[type="radio"]')).toBeChecked();
  const add = dialog.getByRole('button', { name: 'Agregar al carro', exact: true });
  const terms = dialog.getByRole('checkbox', { name: /He leído y acepto/ });
  await expect(terms).not.toBeChecked();
  await expect(add).toBeDisabled();
  // Click only the checkbox surface, never the legal link inside its label.
  await terms.locator('xpath=ancestor::mat-checkbox[1]').locator('.mdc-checkbox').click();
  await expect(terms).toBeChecked();
  await expect(add).toBeEnabled();
  const mutation = page.waitForResponse(r => r.request().method() === 'POST' &&
    new URL(r.url()).hostname === `${config.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com` &&
    /^\/tokocommercewebservices\/v2\/cl\/users\/current\/carts\/[^/]+\/entries\/\d+\/services$/.test(new URL(r.url()).pathname), { timeout: 60000 });
  await add.click();
  const result = await mutation;
  if (!result.ok()) throw new Error(`CL SC+ addition failed with HTTP ${result.status()}; inspect before retrying.`);
  await result.finished();
  await expect(dialog).toBeHidden({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Eliminar Samsung Care+', exact: true })).toBeVisible({ timeout: 60000 });
  // A second navigation proves server persistence, rather than optimistic UI.
  const after = await readClCart(page, config);
  const evidence = clCareEvidence(after, { sku: config.sku, planSku: config.scPlusPlanSku });
  expect(evidence.total).toBeCloseTo(before.totalPrice.value + evidence.servicePrice, 2);
  await expect(page.getByRole('button', { name: 'Eliminar Samsung Care+', exact: true })).toBeVisible({ timeout: 60000 });
  return evidence;
}

module.exports = { clCareEvidence, openClCareServices, addAndValidateClCare };
