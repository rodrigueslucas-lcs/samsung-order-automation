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

async function waitForSamsungReturn(page, storefrontOrigin) {
  const returned = await page.waitForURL(
    url => url.origin === storefrontOrigin && url.pathname.startsWith('/pe/orderConfirmation'),
    { timeout: 30000 }
  ).then(() => true).catch(() => false);
  if (returned) return;

  // The bank confirmation has already happened. A refresh here only resumes the
  // existing provider attempt; it must never repeat the payment confirmation.
  console.log('[pe-safetypay] Samsung return did not arrive in 30s; refreshing the existing gateway attempt once.');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  const recovered = await page.waitForURL(
    url => url.origin === storefrontOrigin && url.pathname.startsWith('/pe/orderConfirmation'),
    { timeout: 30000 }
  ).then(() => true).catch(() => false);
  if (!recovered) {
    throw new Error('PAYMENT_OUTCOME_UNCONFIRMED: SafetyPay bank operation succeeded, but Samsung order confirmation did not resume after one safe gateway refresh. Do not confirm or submit payment again; resume the existing attempt manually.');
  }
}

async function completePeSafetyPaySandbox(page, { orderCode, storefrontOrigin }) {
  requirePaymentSubmitOptIn();
  assertSandboxOrder({ gatewayUrl: page.url(), storefrontOrigin, orderCode });
  const accept = page.getByRole('button', { name: 'Aceptar', exact: true });
  if (await accept.isVisible()) await accept.click();
  const testBank = page.locator('a[id="0000"]');
  await expect(testBank).toBeVisible();
  await testBank.click();
  await expect(page.locator('body')).toContainText(/Código de pago\s*\d+/i);
  const attempt = readSafetyPayAttempt(await page.locator('body').innerText());
  const bankPromise = page.context().waitForEvent('page', { timeout: 30000 });
  await page.getByRole('link', { name: 'Ir a banca por internet', exact: true }).click();
  const bank = await bankPromise;
  await bank.waitForURL(url => url.origin === 'https://sandbox-demobank.safetypay.com', { timeout: 30000 });
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
  await waitForSamsungReturn(page, storefrontOrigin);
  await bank.close();
}

module.exports = { readSafetyPayAttempt, assertSandboxOrder, completePeSafetyPaySandbox, waitForSamsungReturn };
