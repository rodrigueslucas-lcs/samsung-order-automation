const MAINTENANCE_TITLE = /^\s*(?:Error:\s*)?(?:Page Under Maintenance|System Maintenance|SAP Commerce Cloud\s*-\s*Maintenance)\s*$/i;
const MAINTENANCE_BODY = /(?:page|site|website|system)\s+(?:is\s+)?(?:under\s+)?maintenance|undergoing\s+(?:scheduled\s+)?maintenance/i;
const ACCESS_CONFIRMATION = /You can access pages now/i;
function maintenanceError(label) {
  return Object.assign(new Error(`${label} storefront is serving a maintenance document. Authentication cannot be evaluated; no login should be submitted until staging is available.`), { code: 'AUTH_STOREFRONT_UNAVAILABLE', reason: 'STOREFRONT_MAINTENANCE' });
}
async function assertAuthDocumentHealth(page, { label = 'Staging' } = {}) {
  if (!MAINTENANCE_TITLE.test(await page.title())) return;
  const body = await page.locator('body').innerText({ timeout: 3000 });
  // Samsung's successful getcookie.html retains an error-looking title.
  // The visible access grant wins; a title alone never proves an outage.
  if (!ACCESS_CONFIRMATION.test(body) && MAINTENANCE_BODY.test(body)) throw maintenanceError(label);
}
async function waitForAuthControl(page, control, { label = 'Staging', timeout } = {}) {
  // Maintenance documents can return HTTP 200. Observe their exact title in
  // parallel with the expected control, instead of spending a full UI timeout.
  await Promise.race([
    control.waitFor({ state: 'visible', timeout }),
    page.waitForFunction(({ title, body, access }) => {
      const text = document.body?.innerText || '';
      return new RegExp(title, 'i').test(document.title) && !new RegExp(access, 'i').test(text) && new RegExp(body, 'i').test(text);
    }, { title: MAINTENANCE_TITLE.source, body: MAINTENANCE_BODY.source, access: ACCESS_CONFIRMATION.source }, { timeout }).then(() => { throw maintenanceError(label); }),
  ]);
}
async function assertAuthStorefrontHealth(request, { market, environment }) {
  const code = String(market || '').toLowerCase();
  const target = String(environment || '').toUpperCase();
  if (!['mx', 'pe', 'co', 'cl'].includes(code) || !['S1', 'S2'].includes(target)) {
    throw new Error('Auth storefront health requires a known market and S1/S2 staging environment.');
  }
  const endpoint = `https://${target.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/${code}/currentConfig`;
  let response;
  try {
    response = await request.get(endpoint, { timeout: 15000, maxRedirects: 0 });
  } catch {
    const error = new Error(`${code.toUpperCase()} ${target} storefront currentConfig could not be reached. Login was not started; verify staging connectivity before refreshing again.`);
    error.code = 'AUTH_STOREFRONT_UNREACHABLE';
    throw error;
  }
  try {
    if (response.status() !== 503) return;
    const text = await response.text();
    const maintenance = /<title>\s*SAP Commerce Cloud\s*-\s*Maintenance\s*<\/title>/i.test(text);
    const error = new Error(`${code.toUpperCase()} ${target} storefront currentConfig returned HTTP 503${maintenance ? ' (SAP Commerce Cloud maintenance)' : ''}. My Profile cannot initialize. No credentials were submitted; retry after staging availability is restored.`);
    error.code = 'AUTH_STOREFRONT_UNAVAILABLE';
    throw error;
  } finally {
    await response.dispose();
  }
}

module.exports = { assertAuthStorefrontHealth, assertAuthDocumentHealth, waitForAuthControl };
