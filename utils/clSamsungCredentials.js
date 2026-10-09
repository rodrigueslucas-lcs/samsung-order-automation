const fs = require("node:fs");
const path = require("node:path");

function readClSamsungCredentials(slot = "primary") {
  const candidates = slot === "second"
    ? ["cl-second-storefront-user.json", "co-second-storefront-user.json", "mx-second-storefront-user.json"]
    : ["samsung-storefront-user.json", "co-storefront-user.json", "mx-storefront-user.json"];
  let local = {};
  for (const name of candidates) {
    const file = path.resolve("playwright/.auth", name);
    if (!fs.existsSync(file)) continue;
    local = JSON.parse(fs.readFileSync(file, "utf8"));
    break;
  }
  return slot === "second" ? {
    email: process.env.CL_SECOND_SAMSUNG_EMAIL?.trim() || local.email,
    password: process.env.CL_SECOND_SAMSUNG_PASSWORD || local.password,
  } : {
    email: process.env.SAMSUNG_ACCOUNT_EMAIL?.trim() || process.env.CL_SAMSUNG_EMAIL?.trim() || local.email,
    password: process.env.SAMSUNG_ACCOUNT_PASSWORD || process.env.CL_SAMSUNG_PASSWORD || local.password,
  };
}

module.exports = { readClSamsungCredentials };
