const installed = new WeakSet();

async function installCoNotificationReminder(page) {
  if (installed.has(page)) return;
  const dialog = page.locator('[role="dialog"][aria-modal="true"][class*="ins-preview-wrapper"]')
    .filter({ has: page.locator('.ins-web-opt-in-reminder-body') });
  await page.addLocatorHandler(dialog, async () => {
    const dismiss = dialog.getByText(/¡Listo!/i).last();
    if (await dismiss.isVisible()) await dismiss.click({ timeout: 5000 });
    else await page.locator('#ins-frameless-overlay[close-on-click="true"]')
      .click({ position: { x: 1, y: 1 }, timeout: 5000 });
  });
  installed.add(page);
}

module.exports = { installCoNotificationReminder };
