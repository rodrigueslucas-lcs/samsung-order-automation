const { refreshAuth } = require("../utils/authRefreshRunner.cjs");
const environment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CO auth environment: ${environment}.`);
if (process.env.CO_AUTH_SLOT && process.env.MX_AUTH_SLOT && process.env.CO_AUTH_SLOT.toLowerCase() !== process.env.MX_AUTH_SLOT.toLowerCase()) {
  throw new Error("Conflicting auth slots: use CO_AUTH_SLOT explicitly and unset MX_AUTH_SLOT.");
}
const accountSlot = String(process.env.CO_AUTH_SLOT || process.env.MX_AUTH_SLOT || "primary").toLowerCase();
if (!process.env.CO_AUTH_SLOT && process.env.MX_AUTH_SLOT) console.log("[auth:refresh:co] MX_AUTH_SLOT alias resolved to CO_AUTH_SLOT=" + accountSlot + "; prefer CO_AUTH_SLOT.");
if (!["primary", "second"].includes(accountSlot)) throw new Error(`Unsupported CO auth slot: ${accountSlot}.`);
const baseEnv = {
  ...process.env, CO_QST_ENVIRONMENT: environment, CO_AUTH_SLOT: accountSlot,
  CO_AUTH_MANUAL: accountSlot === "second" ? "1" : process.env.CO_AUTH_MANUAL,
};
refreshAuth({ market: "co", environment, slot: accountSlot, env: baseEnv,
  publishScript: "scripts/auth-publish-jenkins-co.cjs",
}).catch(error => {
  console.error("[auth:refresh:co] " + (error.code === "AUTH_HUMAN_REQUIRED" ? "WAITING HUMAN · " : "FAILED · ") + String(error.message).split("\n", 1)[0]);
  process.exitCode = error.code === "AUTH_HUMAN_REQUIRED" ? 2 : 1;
});
