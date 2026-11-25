import { test } from '@playwright/test';
import peConfig from '../../../../../config/markets/pe';
import { verifyExistingPeIdentity } from '../../../../../flows/pe/existingIdentity';
import { reachPeRegisteredPayment } from '../../../../../flows/pe/storefrontCheckout';
import assertions from '../../../../../flows/smb/dstCartAssertions';
import safety from '../../../../../flows/smb/dstPilotSafety';
import evidenceContext from '../../../../../reporting/evidence/evidenceContext';

test('SAM-25065 @dst @pe @base-store @pilot @registered - Rewards on cart checkout and payment', async ({ page }, testInfo) => {
  test.setTimeout(420000);
  const config = peConfig.getPeQstConfig();
  await safety.installPilotSafety(page, testInfo, 'SAM-25065', config.environment);
  // Verification is live and read-only. No login, CAPTCHA or refresh is started by this pilot.
  await verifyExistingPeIdentity(page, config);
  const observed = [];
  await reachPeRegisteredPayment(page, config, { observeStage: async (stage, target) => {
    const proof = await test.step(`Validate Rewards text and hovered tooltip on ${stage}`, () => assertions.validateRewardsText(target, stage));
    evidenceContext.recordBusinessEvidence(testInfo, { suite: 'DST', market: 'PE', zephyrId: 'SAM-25065', ...proof });
    observed.push(stage);
  } });
  if (observed.join(',') !== 'cart,checkout,payment') throw new Error('DST_REWARDS_STAGE_MISSING');
});
