const { spawnSync } = require("node:child_process");
const environment = String(process.env.PE_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported PE auth environment: ${environment}.`);
const baseEnv = { ...process.env, PE_QST_ENVIRONMENT: environment };
function run(label, script) {
  console.log(`\n[auth:refresh:pe] ${label}`);
  const result = spawnSync(process.execPath, [script], { env: baseEnv, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}
run(`Refreshing Samsung Account session for ${environment}`, "scripts/auth-login-pe.cjs");
run(`Verifying Samsung Account session for ${environment}`, "scripts/auth-verify-pe.cjs");
run(`Packaging verified PE ${environment} session for CI handoff`, "scripts/auth-package-pe.cjs");
console.log(`\n[auth:refresh:pe] READY · PE ${environment} authenticated session refreshed, verified and packaged.`);
console.log("[auth:refresh:pe] CAPTCHA/MFA remains a human security gate when Samsung Account requests it.");
