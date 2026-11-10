const fs = require("node:fs");
const path = require("node:path");
function getMxTestCard(env = process.env) {
  const file = path.resolve(env.MX_TEST_CARD_FILE || "playwright/.auth/mx-test-card.json");
  const local = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const read = (name, key) => String(env[name] || local[key] || "").trim();
  const card = { number: read("MX_TEST_CARD_NUMBER", "number"), holderName: read("MX_TEST_CARD_HOLDER", "holderName"), expiry: read("MX_TEST_CARD_EXPIRY", "expiry"), cvv: read("MX_TEST_CARD_CVV", "cvv"), document: read("MX_TEST_CARD_DOCUMENT", "document") };
  if (Object.values(card).some((value) => !value)) throw new Error("MX test card is required via runtime env or ignored local auth file.");
  return card;
}
module.exports = { getMxTestCard };
