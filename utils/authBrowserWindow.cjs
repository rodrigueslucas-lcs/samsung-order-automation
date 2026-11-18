// Chrome exposes worker and tab descriptors alongside the frontend page.
// Those descriptors are not independently closeable UI windows.
const isDevToolsFrontend = target => target.url.startsWith('devtools://') && ['page','other'].includes(target.type);

async function closeAuthDevTools(cdp, targets, {pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  const current = targets || (await cdp.send('Target.getTargets', { filter: [{ exclude: false }] })).targetInfos;
  let closed = 0;
  for (const target of current.filter(isDevToolsFrontend)) {
    try { await cdp.send('Target.closeTarget', { targetId: target.targetId });closed++; }
    catch (error) {
      if (!/No target with given id|Target closed|Target with given id not found/i.test(String(error.message))) throw error;
    }
  }
  for(let check=0;check<20;check++){
    const remaining = (await cdp.send('Target.getTargets', { filter: [{ exclude: false }] })).targetInfos;
    if(!remaining.some(isDevToolsFrontend))return closed;
    if(check<19)await pause(100);
  }
  throw Object.assign(new Error('Dedicated auth DevTools frontend did not close.'), {code:'AUTH_DEVTOOLS_CLOSE_FAILED'});
}

async function prepareAuthBrowserWindow(page, { closeDevTools = true } = {}) {
  const browser = page.context().browser();
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ exclude: false }] });
    if (closeDevTools) {
      await closeAuthDevTools(cdp, targetInfos);
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

module.exports = { prepareAuthBrowserWindow, hasNativeAuthWindow, closeAuthDevTools };
