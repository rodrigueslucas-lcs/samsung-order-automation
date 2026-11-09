const { refreshAuth } = require("../utils/authRefreshRunner.cjs");
const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported MX auth environment: ${environment}.`);
const accountSlot = String(process.env.MX_AUTH_SLOT || "primary").toLowerCase();
if (!["primary", "second"].includes(accountSlot)) throw new Error(`Unsupported MX auth slot: ${accountSlot}.`);
const baseEnv = {
  ...process.env, MX_QST_ENVIRONMENT: environment, MX_AUTH_SLOT: accountSlot,
  MX_AUTH_MANUAL: accountSlot === "second" ? "1" : process.env.MX_AUTH_MANUAL,
};
refreshAuth({ market: "mx", environment, slot: accountSlot, env: baseEnv,
  publishScript: "scripts/auth-publish-jenkins.cjs",
}).catch(error => {
  console.error("[auth:refresh:mx] " + (["AUTH_HUMAN_REQUIRED", "AUTH_SECURITY_BLOCKED"].includes(error.code) ? "WAITING HUMAN · " : error.code === "AUTH_BUSY" ? "BUSY · " : "FAILED · ") + String(error.message).split("\n", 1)[0]);
  process.exitCode = ["AUTH_HUMAN_REQUIRED", "AUTH_SECURITY_BLOCKED"].includes(error.code) ? 2 : error.code === "AUTH_BUSY" ? 3 : 1;
});
