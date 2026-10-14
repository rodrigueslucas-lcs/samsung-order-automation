async function prepareAuthBrowserWindow(page, { closeDevTools = true } = {}) {
  const browser = page.context().browser();
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ exclude: false }] });
    if (closeDevTools) {
      for (const target of targetInfos) {
        if (target.url.startsWith('devtools://')) {
          await cdp.send('Target.closeTarget', { targetId: target.targetId });
        }
      }
    }
    const windows = new Map();
    for (const target of targetInfos) {
      if (target.type !== 'page' || target.url.startsWith('devtools://')) continue;
      try {
        const { windowId, bounds } = await cdp.send('Browser.getWindowForTarget', { targetId: target.targetId });
        windows.set(windowId, bounds);
      } catch (error) {
        // Restored/background targets may have no native window. Inspect the
        // remaining targets of this dedicated browser rather than aborting login.
        if (!/Browser window not found|No target with given id|Target closed/i.test(String(error.message))) throw error;
      }
    }
    if (!windows.size) throw new Error('The auth browser has no visible native window; reopen the dedicated Chrome profile.');
    for (const [windowId, bounds] of windows) {
      if (['minimized', 'fullscreen'].includes(bounds.windowState)) {
        await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
      }
      if (bounds.windowState !== 'maximized') {
        await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
      }
      const current = await cdp.send('Browser.getWindowBounds', { windowId });
      if (current.bounds.windowState !== 'maximized') throw new Error('The auth Chrome window did not remain maximized.');
    }
    await page.bringToFront();
  } finally {
    await cdp.detach();
  }
}

async function hasNativeAuthWindow(browser) {
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ exclude: false }] });
    for (const target of targetInfos) {
      if (target.type !== 'page' || target.url.startsWith('devtools://')) continue;
      try {
        await cdp.send('Browser.getWindowForTarget', { targetId: target.targetId });
        return true;
      } catch (error) {
        if (!/Browser window not found|No target with given id|Target closed/i.test(String(error.message))) throw error;
      }
    }
    return false;
  } finally { await cdp.detach(); }
}

module.exports = { prepareAuthBrowserWindow, hasNativeAuthWindow };
