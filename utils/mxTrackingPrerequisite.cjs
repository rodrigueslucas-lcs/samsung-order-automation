function normalizeMxOrderCode(value) {
  return String(value || "").match(/\bMX\d{6}-\d{8}(?:_\d+)?\b/i)?.[0] || null;
}

function getMxTrackingPrerequisite(value, environment) {
  const target = String(environment || "").trim().toUpperCase();
  if (!["S1", "S2"].includes(target) ||
      String(value?.market || "").trim().toUpperCase() !== "MX" ||
      String(value?.environment || "").trim().toUpperCase() !== target) return null;

  const orderNumber = normalizeMxOrderCode(value.orderNumber);
  const email = String(value.email || "").trim().toLowerCase();
  const inbox = String(value.inbox || "").trim();
  const confirmed = value.confirmed === true || /confirmed|confirmation/i.test(String(value.status || value.outcome || ""));
  return confirmed && orderNumber && inbox && email === `${inbox}@mailinator.com`.toLowerCase()
    ? { orderNumber, email, inbox }
    : null;
}

module.exports = { normalizeMxOrderCode, getMxTrackingPrerequisite };
