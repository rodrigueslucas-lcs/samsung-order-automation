async function coPaymentPanelReady(page) {
  const url = new URL(page.url());
  if (!['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(url.hostname) || url.pathname !== '/co/checkout/one') return false;
  const payment = page.getByRole('region', { name: /^3\.\s*Pago$/i });
  return await payment.isVisible().catch(() => false) && await payment.getByRole('button', { name: /^(?:Tarjeta de Cr[eé]dito\s*\/\s*D[eé]bito|Pagar con (?:Bre-B|Bancolombia|PSE)|Nequi\/Daviplata\/RappiPay|Pay by Line Of Credit)\b/i }).first().isVisible().catch(() => false);
}
async function advanceCoDeliveryToPayment(page, delivery, continueButton, { click, timeout = 30000, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const target = new URL(page.url());
  if (!['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(target.hostname) || target.pathname !== '/co/checkout/one') throw new Error('CO delivery transition requires the staging checkout before any action.');
  const option = delivery.getByRole('listitem').filter({ hasText: /Eco Renueva/i }).first();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const readyDeadline = now() + timeout;
    while (true) {
      if (await coPaymentPanelReady(page)) return;
      if (await option.isVisible().catch(() => false)) break;
      if (now() >= readyDeadline) throw new Error('CO checkout rendered neither the payment panel nor its delivery option before the transition deadline.');
      await pause(200);
    }
    try { await click(page, option); }
    catch (error) { if (await coPaymentPanelReady(page)) return; throw error; }
    if (await coPaymentPanelReady(page)) return;
    try { await click(page, continueButton); }
    catch (error) { if (await coPaymentPanelReady(page)) return; throw error; }
    const deadline = now() + timeout;
    do { if (await coPaymentPanelReady(page)) return; await pause(200); } while (now() < deadline);
  }
  throw new Error('CO delivery did not expose a usable payment panel after three controlled selections. No payment was submitted.');
}
module.exports = { coPaymentPanelReady, advanceCoDeliveryToPayment };
