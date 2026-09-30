const { spawnSync } = require("node:child_process");
const environment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpcorCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CO auth environment: ${environment}.`);
const baseEnv = { ...process.env, CO_QST_ENVIRONMENT: environment };
function run(label, script) {
  console.log(`\n[auth:refresh:co] ${label}`);
  const result = spawnSync(process.execPath, [script], { env: baseEnv, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}
run(`Refreshing Samsung Account session for ${environment}`, "scripts/auth-login-co.cjs");
run(`Verifying Samsung Account session for ${environment}`, "scripts/auth-verify-co.cjs");
run(`Packaging verified CO ${environment} session for CI handoff`, "scripts/auth-package-co.cjs");

if (process.env.JENKINS_AUTH_PUBLISH === "1") {
  run(`Publishing CO ${environment} session bundle to Jenkins`, "scripts/auth-publish-jenkins-co.cjs");
}
console.log(`\n[auth:refresh:co] READY · CO ${environment} authenticated session refreshed, verified and packaged.`);
console.log("[auth:refresh:co] CAPTCHA/MFA remains a human security gate when Samsung Account requests it.");
