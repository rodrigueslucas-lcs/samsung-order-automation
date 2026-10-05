const { spawnSync } = require("node:child_process");
const environment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CO auth environment: ${environment}.`);
const baseEnv = { ...process.env, CO_QST_ENVIRONMENT: environment };

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(label, script, { attempts = 1, retryDelayMs = 2500 } = {}) {
  let lastStatus = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const suffix = attempts > 1 ? ` (attempt ${attempt}/${attempts})` : "";
    console.log(`\n[auth:refresh:co] ${label}${suffix}`);
    const result = spawnSync(process.execPath, [script], { env: baseEnv, stdio: "inherit" });
    lastStatus = result.status;
    if (result.status === 0) return;

    if (attempt < attempts) {
      console.warn(`[auth:refresh:co] ${label} failed with exit code ${result.status ?? "unknown"}; retrying in ${retryDelayMs}ms.`);
      sleep(retryDelayMs);
    }
  }

  throw new Error(`${label} failed after ${attempts} attempt(s) with exit code ${lastStatus ?? "unknown"}.`);
}

run(`Refreshing Samsung Account session for ${environment}`, "scripts/auth-login-co.cjs", { attempts: 3 });
run(`Verifying Samsung Account session for ${environment}`, "scripts/auth-verify-co.cjs");
run(`Packaging verified CO ${environment} session for CI handoff`, "scripts/auth-package-co.cjs");

if (process.env.JENKINS_AUTH_PUBLISH === "1") {
  run(`Publishing CO ${environment} session bundle to Jenkins`, "scripts/auth-publish-jenkins-co.cjs");
}
console.log(`\n[auth:refresh:co] READY · CO ${environment} authenticated session refreshed, verified and packaged.`);
console.log("[auth:refresh:co] CAPTCHA/MFA remains a human security gate when Samsung Account requests it.");
