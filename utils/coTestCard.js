const fs = require("node:fs");
const path = require("node:path");
const { getCoQstConfig } = require("../config/markets/co");
const { getMxTestCard } = require("./mxTestCard");

function getCoTestCard(env = process.env) {
  if (getCoQstConfig(env).environment === "S2") return getMxTestCard(env);
  const file = path.resolve(env.CO_TEST_CARD_FILE || "playwright/.auth/co-s1-test-card.json");
  const local = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const read = (name, key) => String(env[name] || local[key] || "").trim();
  const card = {
    number: read("CO_TEST_CARD_NUMBER", "number"),
    holderName: read("CO_TEST_CARD_HOLDER", "holderName"),
    expiry: read("CO_TEST_CARD_EXPIRY", "expiry"),
    cvv: read("CO_TEST_CARD_CVV", "cvv"),
    document: read("CO_TEST_CARD_DOCUMENT", "document"),
  };
  if (Object.values(card).some(value => !value)) {
    throw new Error("CO S1 sandbox card is required via CO_TEST_CARD_* or the ignored CO-specific runtime file; MX data is not a fallback.");
  }
  return card;
}

module.exports = { getCoTestCard };
