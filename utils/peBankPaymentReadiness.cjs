async function waitForPeBankDetails(page, { responseTimeout = 30000, bodyTimeout = 15000 } = {}) {
  const response = await page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && url.protocol === 'https:' &&
      ['s1-smb-api-cdn.ecom-stg.samsung.com', 's2-smb-api-cdn.ecom-stg.samsung.com'].includes(url.hostname) &&
      url.pathname === '/tokocommercewebservices/v2/pe/users/current/carts/current/paymentmodes/pe-Bancapor/details';
  }, { timeout: responseTimeout });
  if (!response.ok()) throw new Error(`PE Internet Banking details returned HTTP ${response.status()}; no payment was submitted.`);
  let timer;
  try {
    const interrupted = await Promise.race([
      response.finished(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PE Internet Banking details body did not finish; no payment was submitted.')), bodyTimeout); }),
    ]);
    if (interrupted) throw new Error('PE Internet Banking details response was interrupted; no payment was submitted.');
  } finally { clearTimeout(timer); }
}

module.exports = { waitForPeBankDetails };
