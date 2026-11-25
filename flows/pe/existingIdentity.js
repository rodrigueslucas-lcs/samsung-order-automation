import { test } from '@playwright/test';
import peAuth from '../../utils/peAuthState';

// Reuse the existing identity only. Deliberately avoid the recovery/export
// wrapper: this pilot must not start login or modify persisted auth state.
export async function verifyExistingPeIdentity(page, config) {
  const auth = peAuth.getPeAuthState();
  await auth.installPersistedBrowserState(page.context(), page);
  await test.step('Verify the existing PE registered identity without renewal or state export', async () => {
    await page.goto(config.setupUrl.href, { waitUntil: 'domcontentloaded' });
    await page.getByText(/You can access pages now/i).waitFor({ state: 'visible', timeout: 30000 });
    await page.goto(config.baseUrl.href, { waitUntil: 'domcontentloaded' });
    await auth.validateCurrentPageAuthenticated(page);
  });
}
