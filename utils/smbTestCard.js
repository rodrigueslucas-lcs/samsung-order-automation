const fs = require("node:fs");
const path = require("node:path");

const defaultFile = path.resolve("playwright/.auth/mx-test-card.json");

function getSmbTestCard(env = process.env) {
  const configuredFile = env.SMB_TEST_CARD_FILE ? path.resolve(env.SMB_TEST_CARD_FILE) : defaultFile;
  const local = fs.existsSync(configuredFile) ? JSON.parse(fs.readFileSync(configuredFile, "utf8")) : {};
  const read = (genericName, mxName, key) => String(env[genericName] || env[mxName] || local[key] || "").trim();
  const card = {
    number: read("SMB_TEST_CARD_NUMBER", "MX_TEST_CARD_NUMBER", "number"),
    holderName: read("SMB_TEST_CARD_HOLDER", "MX_TEST_CARD_HOLDER", "holderName"),
    expiry: read("SMB_TEST_CARD_EXPIRY", "MX_TEST_CARD_EXPIRY", "expiry"),
    cvv: read("SMB_TEST_CARD_CVV", "MX_TEST_CARD_CVV", "cvv"),
    document: read("SMB_TEST_CARD_DOCUMENT", "MX_TEST_CARD_DOCUMENT", "document"),
  };
  if (Object.values(card).some((value) => !value)) {
    throw new Error("SMB test card is required via runtime env or ignored local auth file.");
  }
  return card;
}

module.exports = { getSmbTestCard };
