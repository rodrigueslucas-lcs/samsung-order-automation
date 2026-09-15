const fs = require("node:fs");
const path = require("node:path");
const file = path.resolve("playwright/.auth/mx-test-card.json");
function getMxTestCard(env = process.env) {
  const local = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const read = (name, key) => String(env[name] || local[key] || "").trim();
  const card = { number: read("MX_TEST_CARD_NUMBER", "number"), holderName: read("MX_TEST_CARD_HOLDER", "holderName"), expiry: read("MX_TEST_CARD_EXPIRY", "expiry"), cvv: read("MX_TEST_CARD_CVV", "cvv"), document: read("MX_TEST_CARD_DOCUMENT", "document") };
  if (Object.values(card).some((value) => !value)) throw new Error("MX test card is required via runtime env or ignored local auth file.");
  return card;
}
module.exports = { getMxTestCard };
