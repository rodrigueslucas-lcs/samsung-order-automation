const PE_BACKOFFICE_TEST_DATA = Object.freeze({
  S2: Object.freeze({
    orderCode: "PE260926-77211976",
    productCode: "SM-F741BLBKPEO",
  }),
});

function getPeBackofficeTestData(environment = process.env) {
  const target = String(environment.PE_QST_ENVIRONMENT || environment.BACKOFFICE_ENV || "S2").toUpperCase();
  const defaults = PE_BACKOFFICE_TEST_DATA[target] || {};

  const orderCode = String(
    environment[`PE_QST_${target}_ORDER_CODE`] ||
    environment.PE_QST_ORDER_CODE ||
    defaults.orderCode ||
    ""
  ).trim();
  const productCode = String(
    environment[`PE_QST_${target}_PRODUCT_CODE`] ||
    environment.PE_QST_PRODUCT_CODE ||
    defaults.productCode ||
    ""
  ).trim();

  if (!orderCode) throw new Error(`PE ${target} BackOffice order code is required.`);
  if (!/^PE\d{6}-\d{8}(?:_\d+)?$/i.test(orderCode)) {
    throw new Error(`Invalid PE BackOffice order code for ${target}.`);
  }
  if (!productCode) throw new Error(`PE ${target} BackOffice product code is required.`);

  return { environment: target, orderCode, productCode };
}

function getPeBackofficeOrderCode(environment = process.env) {
  return getPeBackofficeTestData(environment).orderCode;
}

module.exports = { PE_BACKOFFICE_TEST_DATA, getPeBackofficeTestData, getPeBackofficeOrderCode };
