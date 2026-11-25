import { test, expect } from '@playwright/test';
import BackOfficeSearchPage from '../../pages/BackOfficeSearchPage';
import credentials from '../../utils/backofficeAdminCredentials';
import coConfig from '../../config/markets/co';
import clConfig from '../../config/markets/cl';
import safety from './dstPilotSafety';
import evidenceContext from '../../reporting/evidence/evidenceContext';

// Both official cases require order AND product searches in basic AND advanced
// mode. Listing an arbitrary first order is insufficient. All records are read-only.
export async function validateDstBackOfficeSearch(page, testInfo, { market, id }) {
  if (!['CO', 'CL'].includes(market)) throw new Error('DST_BO_MARKET_INVALID');
  const config = market === 'CO' ? coConfig.getCoQstConfig() : clConfig.getClQstConfig();
  const environment = config.environment;
  if (!['S1', 'S2'].includes(environment)) throw new Error('DST_BO_STAGING_REQUIRED');
  process.env.BACKOFFICE_ENV = environment.toLowerCase();
  const identity = credentials.getBackOfficeAdminCredentials({ ...process.env, BACKOFFICE_ENV: environment.toLowerCase() });
  if (!identity.password) throw new Error(`DST_BO_CREDENTIALS_REQUIRED: ${market} ${environment}; no login or renewal started.`);
  await safety.installPilotSafety(page, testInfo, id, environment);
  const backOffice = new BackOfficeSearchPage(page);
  await test.step(`${market} ${environment} · Authenticate authorized BackOffice administrator`, async () => {
    await backOffice.login({ ...identity, authority: 'admin' });
    await backOffice.expectPerspective('admin');
  });
  let orderCode;
  await test.step('Select an existing order from this market without creating one', async () => {
    await backOffice.openAdminOrders();
    const search = await backOffice.ensureAdminBasicSearch();
    await search.fill(market);
    await backOffice.waitForZkUpdate(() => search.locator('xpath=../..').locator('button[title="Search"]').click(), { timeout: 90000 });
    const rows = await backOffice.readVisibleAdminOrders();
    const pattern = new RegExp(`^${market}\\d{6}-\\d{8}(?:_\\d+)?$`);
    orderCode = rows.find(row => pattern.test(row.orderCode || ''))?.orderCode;
    if (!orderCode) throw new Error(`DST_BO_MARKET_ORDER_REQUIRED: no existing ${market} order was returned.`);
  });
  await test.step('Find the same existing market order using Basic Search', async () => {
    await expect(await backOffice.searchAdminOrder(orderCode)).toBeVisible();
  });
  await test.step('Find the same existing market order using Advanced Search', async () => {
    await backOffice.openAdminOrders();
    await expect(await backOffice.searchAdminOrderAdvanced(orderCode)).toBeVisible();
  });
  await test.step('Find the configured existing product using Basic and Advanced Search', async () => {
    await backOffice.validateProductBasicAndAdvancedSearch(config.sku);
  });
  evidenceContext.recordBusinessEvidence(testInfo, {
    suite: 'DST', market, store: 'BASE_STORE', environment, zephyrId: id,
    orderCode, sku: config.sku, orderBasicSearch: true, orderAdvancedSearch: true,
    productBasicSearch: true, productAdvancedSearch: true, businessWritesPerformed: false,
    preconditionClarification: 'Operator confirmed customer checkout/payment text is generic export boilerplate; original source retained.',
  });
}
