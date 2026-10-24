const installed = new WeakSet();
function reminder(page) {
  return page.locator('[role="dialog"][aria-modal="true"][class*="ins-preview-wrapper"]')
    .filter({ has: page.locator('.ins-web-opt-in-reminder-body') });
}
async function dismissCoNotificationReminder(page) {
  const dialog = reminder(page);
  if (!await dialog.isVisible().catch(() => false)) return;
  const button = dialog.getByText(/¡Listo!/i).last();
  const overlay = page.locator('#ins-frameless-overlay[close-on-click="true"]');
  try {
    if (await button.isVisible()) await button.click({ timeout: 5000 });
    else if (await overlay.isVisible()) await overlay.click({ position: { x: 1, y: 1 }, timeout: 5000 });
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  } catch (error) {
    // A locator handler or a completed dismiss can remove both nodes between checks.
    if (!await dialog.isVisible().catch(() => false)) return;
    if (!await overlay.isVisible().catch(() => false)) throw error;
    try { await overlay.click({ position: { x: 1, y: 1 }, timeout: 5000 }); }
    catch (fallback) { if (await dialog.isVisible().catch(() => false)) throw fallback; }
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  }
}
async function installCoNotificationReminder(page) {
  if (installed.has(page)) return;
  await page.addLocatorHandler(reminder(page), () => dismissCoNotificationReminder(page));
  installed.add(page);
}
module.exports = { installCoNotificationReminder, dismissCoNotificationReminder };
