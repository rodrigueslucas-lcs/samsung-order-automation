const { spawnSync } = require("node:child_process");

const environment = String(process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CL auth environment: ${environment}.`);
const accountSlot = String(process.env.CL_AUTH_SLOT || "primary").toLowerCase();
if (!["primary", "second"].includes(accountSlot)) throw new Error(`Unsupported CL auth slot: ${accountSlot}.`);
const baseEnv = {
  ...process.env,
  CL_QST_ENVIRONMENT: environment,
  CL_AUTH_SLOT: accountSlot,
  CL_AUTH_MANUAL: accountSlot === "second" ? "1" : process.env.CL_AUTH_MANUAL,
};

function run(label, script) {
  console.log(`\n[auth:refresh:cl] ${label}`);
  const result = spawnSync(process.execPath, [script], { env: baseEnv, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}

const slotLabel = accountSlot === "second" ? " second account" : "";
run(`Refreshing Samsung Account${slotLabel} session for ${environment}`, "scripts/auth-login-cl.cjs");
run(`Verifying Samsung Account${slotLabel} session for ${environment}`, "scripts/auth-verify-cl.cjs");
if (accountSlot === "primary") run(`Packaging verified CL ${environment} session for CI handoff`, "scripts/auth-package-cl.cjs");
console.log(`\n[auth:refresh:cl] READY · CL ${environment}${slotLabel} authenticated session refreshed and verified.`);
console.log("[auth:refresh:cl] CAPTCHA/MFA remains a human security gate when Samsung Account requests it.");
