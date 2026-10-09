const installedPages = new WeakSet();

function closeChatNotices() {
  if (window.__clChatNoticeDismissalInstalled) return;
  window.__clChatNoticeDismissalInstalled = true;
  const dismiss = () => {
    for (const button of document.querySelectorAll('button[aria-label="Cerrar aviso"], button[title="Cerrar aviso"]')) {
      if (button.getClientRects().length && getComputedStyle(button).visibility !== "hidden") button.click();
    }
  };
  new MutationObserver(dismiss).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"],
  });
  dismiss();
}

async function installClChatNoticeDismissal(page) {
  if (installedPages.has(page)) return;
  installedPages.add(page);
  // Init scripts also run in chat iframes created after the storefront loads.
  await page.addInitScript(closeChatNotices);
  for (const frame of page.frames()) {
    await frame.evaluate(closeChatNotices).catch(() => {});
  }
}

module.exports = { installClChatNoticeDismissal };
