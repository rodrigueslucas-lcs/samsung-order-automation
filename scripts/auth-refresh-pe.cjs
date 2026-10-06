const { spawnSync } = require("node:child_process");
const environment = String(process.env.PE_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported PE auth environment: ${environment}.`);
const baseEnv = { ...process.env, PE_QST_ENVIRONMENT: environment };
function run(label, script, attempts = 1) {
  let lastStatus;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`\n[auth:refresh:pe] ${label}${attempts > 1 ? ` (attempt ${attempt}/${attempts})` : ""}`);
    const result = spawnSync(process.execPath, [script], { env: baseEnv, stdio: "inherit" });
    lastStatus = result.status;
    if (result.status === 0) return;
    if (result.status === 75 && attempt < attempts) {
      console.warn(`[auth:refresh:pe] Login attempt lost its browser/page; retrying in 2500ms.`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
    } else break;
  }
  throw new Error(`${label} failed after ${attempts} attempt(s) with exit code ${lastStatus ?? "unknown"}.`);
}
run(`Refreshing Samsung Account session for ${environment}`, "scripts/auth-login-pe.cjs", 3);
run(`Verifying Samsung Account session for ${environment}`, "scripts/auth-verify-pe.cjs");
run(`Packaging verified PE ${environment} session for CI handoff`, "scripts/auth-package-pe.cjs");

if (process.env.JENKINS_AUTH_PUBLISH === "1") {
  run(`Publishing PE ${environment} session bundle to Jenkins`, "scripts/auth-publish-jenkins-pe.cjs");
}
console.log(`\n[auth:refresh:pe] READY · PE ${environment} authenticated session refreshed, verified and packaged.`);
console.log("[auth:refresh:pe] CAPTCHA/MFA remains a human security gate when Samsung Account requests it.");
