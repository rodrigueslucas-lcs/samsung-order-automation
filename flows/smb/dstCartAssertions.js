const { expect } = require('@playwright/test');
const { validateCartItemPresentation, inspectAvailableServices, findCartItemBySku } = require('./cartPresentation');

async function validateMxDstCart(page, cart, sku) {
  await cart.validateCartPage();
  await cart.validateProductInCart();
  const item = await findCartItemBySku(page, sku);
  const name = item.getByRole('heading').first();
  await expect(name, 'Product name for the exact cart SKU').toBeVisible();
  expect((await name.innerText()).trim().length).toBeGreaterThan(0);
  const presentation = await validateCartItemPresentation(page, { sku, currencyPattern: /\$\s*[\d,.]+/ });
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
  const services = await inspectAvailableServices(page);
  // The official source makes services conditional. Record absence, never require an invented service.
  // Native accessible icon observed in the actual S2 cart trace, not an inferred CSS class.
  const info = page.getByRole('main').getByRole('img', { name: 'service-item-title-tooltip', exact: true });
  await expect(info.first(), 'Cart info icons required by the current official scenario').toBeVisible({ timeout: 30000 });
  const footer = page.getByRole('contentinfo');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible({ timeout: 30000 });
  expect(await footer.getByRole('link').filter({ visible: true }).count(), 'Rendered cart footer links').toBeGreaterThan(0);
  return { ...presentation, services, infoIconCount: await info.count() };
}

async function validatePeDstSummary(page, cart) {
  const summary = await cart.validateOrderSummary();
  expect(summary.subtotal).toBeTruthy();
  expect(summary.total).toBeTruthy();
  const heading = page.getByRole('heading', { name: /Resumen/i }).filter({ visible: true }).first();
  const panel = heading.locator('xpath=ancestor::*[.//input][1]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox', { name: /c[oó]digo|cup[oó]n/i }).or(
    panel.getByPlaceholder(/c[oó]digo|cup[oó]n/i)
  ).first()).toBeVisible();
  await expect(page.getByText(/ver.*cupon|cupones disponibles|view available coupon/i).filter({ visible: true }).first()).toBeVisible();
  await expect(panel.getByText(/ahorro|descuento total|total savings/i).filter({ visible: true }).first()).toBeVisible();
  const info = panel.getByText(/By submitting your order|Al continuar|t[eé]rminos|privacidad|cantidad final de puntos/i).filter({ visible: true });
  await expect(info.first(), 'Order summary information text').toBeVisible();
  const panelBox = await panel.boundingBox();
  const itemBox = await page.getByText(cart.sku, { exact: true }).filter({ visible: true }).first().boundingBox();
  expect(panelBox && itemBox && panelBox.x > itemBox.x, 'Summary must be on the right of cart items at desktop viewport').toBe(true);
  return { ...summary, rightSide: true, couponField: true, availableCoupons: true, savings: true, infoText: true };
}

async function validateRewardsText(page, stage) {
  const panel = page.locator('.summary-rewards-benefit').filter({ visible: true }).first();
  const text = panel.getByText(/Gana.*puntos.*Samsung Rewards/i).first();
  await expect(text, `Rewards text on ${stage}`).toBeVisible({ timeout: 30000 });
  // Observed native structures differ: Cart uses delivery-info-tooltip;
  // Checkout uses order-summary-reward-tooltip inside the same Rewards panel.
  const trigger = panel.locator('.delivery-info-tooltip, .order-summary-reward-tooltip');
  await expect(trigger, `Rewards tooltip trigger on ${stage}`).toBeVisible();
  await trigger.hover();
  const tooltip = page.getByRole('tooltip').filter({ visible: true });
  await expect(tooltip, `Rendered Rewards tooltip on ${stage}`).toBeVisible();
  // The export requires meaningful tooltip text, but does not prescribe copy.
  // Prove Rewards membership/points content, not the static disclaimer or SVG title.
  await expect(tooltip).toContainText(/Rewards/i);
  await expect(tooltip).toContainText(/puntos|miembro|inscrib/i);
  const tooltipText = (await tooltip.innerText()).trim();
  expect(tooltipText.length).toBeGreaterThan(20);
  await page.mouse.move(0, 0);
  return { stage, rewardsText: (await text.innerText()).trim(), tooltipText };
}

module.exports = { validateMxDstCart, validatePeDstSummary, validateRewardsText };
