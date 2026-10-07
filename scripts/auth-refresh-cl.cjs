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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(label, script, { attempts = 1, retryDelayMs = 2500 } = {}) {
  let lastStatus = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const suffix = attempts > 1 ? ` (attempt ${attempt}/${attempts})` : "";
    console.log(`\n[auth:refresh:cl] ${label}${suffix}`);
    const result = spawnSync(process.execPath, [script], { env: baseEnv, stdio: "inherit" });
    lastStatus = result.status;
    if (result.status === 0) return;
    if (attempt < attempts) {
      console.warn(`[auth:refresh:cl] ${label} failed with exit code ${result.status ?? "unknown"}; retrying in ${retryDelayMs}ms.`);
      sleep(retryDelayMs);
    }
  }
  throw new Error(`${label} failed after ${attempts} attempt(s) with exit code ${lastStatus ?? "unknown"}.`);
}

const slotLabel = accountSlot === "second" ? " second account" : "";
run(`Refreshing Samsung Account${slotLabel} session for ${environment}`, "scripts/auth-login-cl.cjs", { attempts: 3 });
run(`Verifying Samsung Account${slotLabel} session for ${environment}`, "scripts/auth-verify-cl.cjs");
run(`Packaging verified CL ${environment} session for CI handoff`, "scripts/auth-package-cl.cjs");
console.log(`\n[auth:refresh:cl] READY · CL ${environment}${slotLabel} authenticated session refreshed, verified and packaged.`);
console.log("[auth:refresh:cl] CAPTCHA/MFA remains a human security gate when Samsung Account requests it.");
