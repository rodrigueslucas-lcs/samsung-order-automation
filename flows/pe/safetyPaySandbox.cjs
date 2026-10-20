const { expect } = require('@playwright/test');
const { requirePaymentSubmitOptIn } = require('../../utils/destructiveGuards');

function readSafetyPayAttempt(text) {
  const paymentCode = text.match(/Código de pago\s*(\d+)/i)?.[1];
  const amount = text.match(/TOTAL\s*S\/\s*([\d,]+\.\d{2})/i)?.[1]?.replace(/,/g, '');
  if (!paymentCode || !amount || Number(amount) <= 0 || /tiempo ha expirado/i.test(text)) {
    throw new Error('SafetyPay sandbox requires the active payment code and exact PEN amount. Do not create another order.');
  }
  return { paymentCode, amount };
}

function assertSandboxOrder({ gatewayUrl, storefrontOrigin, orderCode }) {
  if (new URL(gatewayUrl).origin !== 'https://sandbox-gateway.safetypay.com' ||
      !['https://stg.shop.samsung.com', 'https://stg2.shop.samsung.com'].includes(storefrontOrigin) ||
      !/^PE\d{6}-\d{8}(?:_\d+)?$/i.test(orderCode || '')) {
    throw new Error('SafetyPay completion requires the genuine sandbox, a staging return and the current PE order.');
  }
}

async function completePeSafetyPaySandbox(page, { orderCode, storefrontOrigin }) {
  requirePaymentSubmitOptIn();
  assertSandboxOrder({ gatewayUrl: page.url(), storefrontOrigin, orderCode });
  const accept = page.getByRole('button', { name: 'Aceptar', exact: true });
  if (await accept.isVisible()) await accept.click();
  // Native test-bank selection; never follow a real bank or synthesize a provider URL.
  const testBank = page.locator('a[id="0000"]');
  await expect(testBank).toBeVisible();
  await testBank.click();
  await expect(page.locator('body')).toContainText(/Código de pago\s*\d+/i);
  const attempt = readSafetyPayAttempt(await page.locator('body').innerText());
  const bankPromise = page.context().waitForEvent('page', { timeout: 30000 });
  await page.getByRole('link', { name: 'Ir a banca por internet', exact: true }).click();
  const bank = await bankPromise;
  await bank.waitForURL(url => url.origin === 'https://sandbox-demobank.safetypay.com', { timeout: 30000 });
  // Public demo-bank identity, never a Samsung/customer/bank credential.
  await bank.locator('input[id$="_UserName"]').fill('test');
  await bank.locator('input[type="password"]').fill('test');
  await bank.getByRole('button', { name: 'Log In', exact: true }).click();
  const currency = bank.locator('select[id$="_dropCurrencies"]');
  await currency.selectOption('PEN');
  await expect(currency).toHaveValue('PEN');
  const account = bank.locator('select[id$="_dropAccount"]');
  const checking = await account.locator('option').evaluateAll(options =>
    options.find(option => /^CHECKING\b/.test(option.textContent.trim()))?.value);
  if (!checking) throw new Error('SafetyPay demo checking account is unavailable; existing order remains pending.');
  await account.selectOption(checking);
  await bank.locator('input[id$="_txtTransactionID"]').fill(attempt.paymentCode);
  await bank.locator('input[id$="_txtAmount"]').fill(attempt.amount);
  await bank.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(bank.locator('body')).toContainText('Are you sure to make this payment?');
  await expect(bank.locator('body')).toContainText('Samsung PER');
  await expect(bank.locator('body')).toContainText(attempt.paymentCode);
  await expect(bank.locator('body')).toContainText(new RegExp(`PEN\\s+${attempt.amount.replace('.', '\\.')}`));
  // One confirmation for this same attempt. Never retry an ambiguous payment.
  await bank.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(bank.locator('body')).toContainText('The operation was successful.', { timeout: 60000 });
  await page.waitForURL(url => url.origin === storefrontOrigin && url.pathname.startsWith('/pe/orderConfirmation'), { timeout: 90000 });
  await bank.close();
}

module.exports = { readSafetyPayAttempt, assertSandboxOrder, completePeSafetyPaySandbox };
