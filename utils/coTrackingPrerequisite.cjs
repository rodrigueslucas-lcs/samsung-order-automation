function getCoTrackingPrerequisite(value, environment, sku) {
  const target = String(environment || '').toUpperCase();
  if (!['S1', 'S2'].includes(target) || value?.market !== 'CO' ||
      value.environment !== target || value.confirmed !== true || value.sku !== sku) return null;
  const order = String(value.orderNumber || '').trim().toUpperCase();
  const email = String(value.email || '').trim().toLowerCase();
  const inbox = String(value.inbox || '').trim();
  if (!/^CO\d{6}-\d{8}(?:_\d+)?$/.test(order) || !/^[A-Za-z0-9_-]+$/.test(inbox) ||
      email !== `${inbox}@mailinator.com`.toLowerCase()) return null;
  return { orderNumber: order.split('_')[0], email, inbox };
}
module.exports = { getCoTrackingPrerequisite };
