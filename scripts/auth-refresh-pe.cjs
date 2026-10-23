const { refreshAuth } = require("../utils/authRefreshRunner.cjs");
const environment = String(process.env.PE_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported PE auth environment: ${environment}.`);
const accountSlot = "primary";
if (!["primary", "second"].includes(accountSlot)) throw new Error(`Unsupported PE auth slot: ${accountSlot}.`);
const baseEnv = {
  ...process.env, PE_QST_ENVIRONMENT: environment, PE_AUTH_SLOT: accountSlot,
  PE_AUTH_MANUAL: accountSlot === "second" ? "1" : process.env.PE_AUTH_MANUAL,
};
refreshAuth({ market: "pe", environment, slot: accountSlot, env: baseEnv,
  publishScript: "scripts/auth-publish-jenkins-pe.cjs",
}).catch(error => {
  console.error("[auth:refresh:pe] " + (error.code === "AUTH_HUMAN_REQUIRED" ? "WAITING HUMAN · " : "FAILED · ") + String(error.message).split("\n", 1)[0]);
  process.exitCode = error.code === "AUTH_HUMAN_REQUIRED" ? 2 : error.code === "AUTH_BUSY" ? 3 : 1;
});
