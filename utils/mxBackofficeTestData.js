const MX_BACKOFFICE_TEST_DATA = Object.freeze({
  S1: Object.freeze({
    orderCode: "MX260908-63926930",
    productCode: "SM-F741BLBKLTM",
  }),
  S2: Object.freeze({
    orderCode: "MX260921-76848732",
    productCode: "SM-F741BLBKLTM",
  }),
});

function getMxBackofficeTestData(environment = process.env) {
  const target = String(environment.MX_QST_ENVIRONMENT || "S1").toUpperCase();
  const defaults = MX_BACKOFFICE_TEST_DATA[target];
  if (!defaults) throw new Error(`Unsupported MX BackOffice test-data environment: ${target}.`);

  const orderCode = String(environment[`MX_QST_${target}_ORDER_CODE`] || defaults.orderCode).trim();
  const productCode = String(environment[`MX_QST_${target}_PRODUCT_CODE`] || defaults.productCode).trim();
  if (!/^MX\d{6}-\d{8}$/i.test(orderCode)) {
    throw new Error(`MX ${target} BackOffice order code is missing or invalid.`);
  }
  if (!productCode) throw new Error(`MX ${target} BackOffice product code is missing.`);

  return { environment: target, orderCode, productCode };
}

module.exports = { MX_BACKOFFICE_TEST_DATA, getMxBackofficeTestData };
