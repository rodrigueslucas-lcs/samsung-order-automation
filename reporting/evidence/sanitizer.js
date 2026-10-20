const SENSITIVE_KEY = /^(?:password|passwd|token|authorization|cookie|secret|api_?key|card_?number|cvv|cvc|security_?code|email|phone|first_?name|last_?name|holder_?name|line1|line2|street|address|postal_?code|zip_?code|document|document_?number|identification|identification_?number|vat_?number|company_?id|imei)$/i;
const SENSITIVE_VALUE = /(password|passwd|token|authorization|cookie|secret|api_?key|card_?number|cvv|cvc|security_?code|email|phone|first_?name|last_?name|holder_?name|street|address|postal_?code|zip_?code|document|identification|vat_?number|company_?id|imei)(\s*[=:]\s*)(["']?)[^\s,;\]}]+/gi;

function sanitizeString(value) {
  return value.replace(
    SENSITIVE_VALUE,
    (_match, key, separator) => `${key}${separator}[REDACTED]`
  );
}

function sanitize(value, seen = new WeakSet()) {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    clean[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitize(item, seen);
  }
  seen.delete(value);
  return clean;
}

module.exports = { sanitize, sanitizeString, SENSITIVE_KEY };
