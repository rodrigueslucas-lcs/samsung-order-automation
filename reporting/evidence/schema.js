const EVIDENCE_ANNOTATION = "smb-evidence";
const SCHEMA_VERSION = 1;

const BUSINESS_FIELDS = [
  "zephyrId", "officialTitle", "market", "store", "suite", "feature", "environment",
  "validationStatus", "context", "runtimePath", "automation", "release", "cycle",
  "orderCode", "paymentMethod", "initialStatus", "cronJob", "cronResult", "finalStatus",
];

module.exports = { EVIDENCE_ANNOTATION, SCHEMA_VERSION, BUSINESS_FIELDS };
