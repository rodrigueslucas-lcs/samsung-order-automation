const PROVEN_S2_SHIPPING_REQUESTED_ORDER = "PE260926-77211976";

function getPeBackofficeOrderCode(environment = process.env) {
  const target = String(environment.PE_QST_ENVIRONMENT || "S2").toUpperCase();
  const orderCode = String(
    environment.PE_QST_ORDER_CODE ||
    (target === "S2" ? PROVEN_S2_SHIPPING_REQUESTED_ORDER : "")
  ).trim();
  if (orderCode && !/^PE\d{6}-\d{8}(?:_\d+)?$/i.test(orderCode)) {
    throw new Error(`Invalid PE BackOffice order code for ${target}.`);
  }
  return orderCode;
}

module.exports = { getPeBackofficeOrderCode };
