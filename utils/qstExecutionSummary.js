const VALID_TYPES = new Set(["normal", "modified", "sanity"]);

export function buildQstExecutionSummary({ type, storeType, orderNumber } = {}) {
  const normalizedType = String(type || process.env.QST_TYPE || "normal").toLowerCase();
  if (!VALID_TYPES.has(normalizedType)) {
    throw new Error(`Unsupported QST type: ${normalizedType}`);
  }

  return {
    environment: process.env.QST_ENVIRONMENT || "ST2",
    version: process.env.QST_VERSION || "not supplied",
    type: normalizedType,
    date: new Date().toISOString(),
    countryCode: process.env.QST_COUNTRY_CODE || "PE",
    storeType,
    orderNumber: orderNumber || process.env.QST_ORDER_NUMBER || "not applicable",
    defectFound: process.env.QST_DEFECT_FOUND || "not supplied",
    testerName: process.env.QST_TESTER_NAME || "not supplied",
  };
}

export function annotateQstExecution(testInfo, options) {
  const summary = buildQstExecutionSummary(options);
  testInfo.annotations.push({
    type: "qst-execution-summary",
    description: JSON.stringify(summary),
  });
  return summary;
}
