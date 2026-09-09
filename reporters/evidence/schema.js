const EVIDENCE_ANNOTATION = "smb-evidence";
const SCHEMA_VERSION = 1;

const BUSINESS_FIELDS = [
  "zephyrId", "market", "store", "suite", "feature", "environment",
  "release", "cycle", "orderCode", "paymentMethod", "initialStatus",
  "cronJob", "cronResult", "finalStatus",
];

module.exports = { EVIDENCE_ANNOTATION, SCHEMA_VERSION, BUSINESS_FIELDS };
