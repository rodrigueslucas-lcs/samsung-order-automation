const { refreshAuth } = require("../utils/authRefreshRunner.cjs");
const environment = String(process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CL auth environment: ${environment}.`);
const accountSlot = String(process.env.CL_AUTH_SLOT || "primary").toLowerCase();
if (!["primary", "second"].includes(accountSlot)) throw new Error(`Unsupported CL auth slot: ${accountSlot}.`);
const baseEnv = {
  ...process.env, CL_QST_ENVIRONMENT: environment, CL_AUTH_SLOT: accountSlot,
  CL_AUTH_MANUAL: accountSlot === "second" ? "1" : process.env.CL_AUTH_MANUAL,
};
refreshAuth({ market: "cl", environment, slot: accountSlot, env: baseEnv,
  publishScript: "scripts/auth-publish-jenkins-cl.cjs",
}).catch(error => {
  console.error("[auth:refresh:cl] " + (error.code === "AUTH_HUMAN_REQUIRED" ? "WAITING HUMAN · " : "FAILED · ") + String(error.message).split("\n", 1)[0]);
  process.exitCode = error.code === "AUTH_HUMAN_REQUIRED" ? 2 : error.code === "AUTH_BUSY" ? 3 : 1;
});
