// Call only for an owned dedicated profile after its refresh has ended.
// A login challenge, activation form or unrelated tab must survive failure.
async function closeIdleAuthBrowser(browser, { market, environment, rootUrl, identityEntryUrl, humanRequired = false }) {
  if (!['mx','pe','co','cl'].includes(market) || !['S1','S2'].includes(environment)) throw Error('Invalid idle auth identity.');
  const origin = environment === 'S2' ? 'https://stg2.shop.samsung.com' : 'https://stg.shop.samsung.com';
  const root = new URL(rootUrl || `/${market}/`, origin);
  if (root.origin !== origin || !root.pathname.startsWith(`/${market}/`)) throw Error('Idle auth cleanup must stay in its staging market.');
  const idlePaths = new Set(['/getcookie.html',root.pathname]);
  if (identityEntryUrl) {
    const entry = new URL(identityEntryUrl);
    if (entry.origin !== origin || ![`/${market}`,`/${market}/`].includes(entry.pathname) || entry.search || entry.hash || entry.username || entry.password) throw Error('Idle auth identity entry must be its configured staging market home.');
    idlePaths.add(entry.pathname);
  }
  if (humanRequired || !browser?.isConnected()) return false;
  const pages = browser.contexts().flatMap(context => context.pages());
  if (!pages.length) return false;
  for (const page of pages) {
    if (page.isClosed()) continue;
    const value = page.url();
    if (value.startsWith('devtools://')) continue;
    if (value === 'about:blank' || value === 'chrome-error://chromewebdata/') continue;
    let url; try { url = new URL(value); } catch { return false; }
    if (url.origin !== origin || !idlePaths.has(url.pathname)) return false;
    // An activation/email/code form on the storefront is also a human gate.
    const gate = page.locator('input[type="email"],input[type="password"],input[autocomplete="one-time-code"],input[inputmode="numeric"]').filter({ visible: true });
    if (await gate.count()) return false;
  }
  const cdp = await browser.newBrowserCDPSession();
  try { await cdp.send('Browser.close'); }
  catch (error) { if (browser.isConnected()) throw error; }
  return true;
}
module.exports = { closeIdleAuthBrowser };
