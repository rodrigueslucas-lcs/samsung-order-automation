import { test } from '@playwright/test';
import { addMxBcProductToCart } from '../../../../../flows/mx/bcAddToCart';
import pilot from '../../../../../utils/dstPilot.cjs';
import evidenceContext from '../../../../../reporting/evidence/evidenceContext';
import safety from '../../../../../flows/smb/dstPilotSafety';

test.use({ screenshot: 'off' });
test('SAM-24969 @dst @mx @base-store @pilot - Add product from BC page', async ({}, testInfo) => {
  test.setTimeout(420000);
  pilot.selectPilot({ market: 'MX', ids: 'SAM-24969', environment: process.env.MX_QST_ENVIRONMENT || 'S2' });
  evidenceContext.recordBusinessEvidence(testInfo, pilot.evidence('SAM-24969', 'S2'));
  testInfo.annotations.push({ type: 'official-definition-gap', description: 'Scenario-only source; formal official steps are unavailable.' });
  await test.step('Add the configured BC product and prove persisted SKU quantity', () => addMxBcProductToCart(testInfo, {
    preparePage: page => safety.installPilotSafety(page, testInfo, 'SAM-24969', 'S2'),
  }));
});
