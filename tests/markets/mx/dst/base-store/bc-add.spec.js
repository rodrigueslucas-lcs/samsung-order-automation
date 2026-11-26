import { test } from '@playwright/test';
import { addMxBcProductToCart } from '../../../../../flows/mx/bcAddToCart';
import pilot from '../../../../../utils/dstPilot.cjs';
import evidenceContext from '../../../../../reporting/evidence/evidenceContext';
import safety from '../../../../../flows/smb/dstPilotSafety';
import attributes from '../../../../../flows/mx/dstBcAssertions';
import cdpTrace from '../../../../../utils/dstCdpTrace.cjs';

// Mandatory real-context trace replaces the automatic test-only CDP archive.
test.use({ screenshot: 'off', trace: 'off' });
test('SAM-24969 @dst @mx @base-store @pilot - Add product from BC page', async ({}, testInfo) => {
  test.setTimeout(420000);
  pilot.selectPilot({ market: 'MX', ids: 'SAM-24969', environment: process.env.MX_QST_ENVIRONMENT || 'S2' });
  evidenceContext.recordBusinessEvidence(testInfo, pilot.evidence('SAM-24969', 'S2'));
  testInfo.annotations.push({ type: 'official-definition-source', description: 'Detailed offline export MX_QST_37!A34:I34; price and colour requirements preserved.' });
  await test.step('Add the configured BC product and prove persisted SKU quantity', () => addMxBcProductToCart(testInfo, {
    startTrace: cdpTrace.startDstCdpTrace,
    preparePage: page => safety.installPilotSafety(page, testInfo, 'SAM-24969', 'S2'),
    validatePdpAttributes: (page, sku) => test.step('Prove native selected BC/PDP price and colour', () => attributes.validateDstBcAttributes(page, sku)),
  }));
});
