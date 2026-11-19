// GET-only proof of a new order from this execution; never submits payment.
function createCausalOrderReadback({ market, site }, { read, sku, quantity = 1, expectedTotal = null }) {
  let baselineAt;
  const valid = code => new RegExp(`^${market}\\d{6}-\\d{8}(?:_\\d+)?$`).test(code);
  const history = async () => {
    const data = await read('/users/current/orders?fields=FULL&pageSize=20&currentPage=0&sort=byDate');
    const orders = data.orders || data.searchPageData?.results || data.currentOrders;
    if (!Array.isArray(orders)) throw new Error('Order history shape not proven; no submit retry.');
    return orders;
  };
  return {
    beforeSubmit: async () => {
      const codes = new Set((await history()).map(order => order.code));
      baselineAt = Date.now();
      return codes;
    },
    afterSubmit: async baseline => {
      const candidates = (await history()).filter(order => valid(order.code) && !baseline.has(order.code) &&
        (typeof order.site === 'string' ? order.site : order.site?.uid || order.siteUid) === site);
      if (candidates.length !== 1) return null;
      const order = await read('/users/current/orders/' + encodeURIComponent(candidates[0].code) + '?fields=FULL');
      if ([order.status, order.paymentStatus].some(status => /CANCEL|REJECT|DECLIN|FAIL/i.test(typeof status === 'string' ? status : status?.code || ''))) return null;
      const created = Number(order.placed || order.created) || Date.parse(order.placed || order.created);
      if (!Number.isFinite(baselineAt) || !Number.isFinite(created) || created < baselineAt - 60000 || created > Date.now() + 60000) return null;
      if (order.code !== candidates[0].code || !Array.isArray(order.entries) || order.entries.length !== 1 ||
          order.entries[0].product?.code !== sku || order.entries[0].quantity !== quantity || !(order.totalPrice?.value > 0) ||
          (expectedTotal !== null && order.totalPrice.value !== expectedTotal)) return null;
      return { orderCode: order.code };
    },
  };
}
module.exports = { createCausalOrderReadback };
