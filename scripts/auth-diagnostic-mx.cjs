const { spawnSync } = require("node:child_process");

const environment = String(process.env.MX_QST_ENVIRONMENT || "S2").toUpperCase();
const slot = String(process.env.MX_AUTH_SLOT || "primary").toLowerCase();
if (!["S1", "S2"].includes(environment)) throw new Error("Unsupported MX environment.");
if (!["primary", "second"].includes(slot)) throw new Error("Unsupported MX auth slot.");

function run(script, extra = {}) {
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, MX_QST_ENVIRONMENT: environment, MX_AUTH_SLOT: slot, ...extra },
    stdio: "inherit",
  });
  return result.status ?? 1;
}

console.log("\n============================================================");
console.log(` MX ${environment} · AUTH PORTABILITY DIAGNOSTIC · ${slot.toUpperCase()}`);
console.log("============================================================");
console.log("[auth:diagnostic:mx] Step 1/2 · inspect authenticated persistent profile and export safe metadata");
let status = run("scripts/auth-login-mx.cjs", { MX_AUTH_DIAGNOSTIC: "1", MX_AUTH_MANUAL: "1" });
if (status !== 0) {
  console.error("[auth:diagnostic:mx] Persistent profile is not currently authenticated or could not be inspected.");
  process.exit(status);
}
console.log("\n[auth:diagnostic:mx] Step 2/2 · verify the exported state in a fresh Chrome context");
status = run("scripts/auth-verify-mx.cjs", { MX_QST_HEADLESS: "0", CI: "" });
if (status === 0) {
  console.log("\n[auth:diagnostic:mx] PORTABLE · exported state authenticated successfully.");
  process.exit(0);
}
console.error("\n[auth:diagnostic:mx] NOT_PORTABLE · persistent profile authenticated, but exported state failed in a fresh context.");
console.error("[auth:diagnostic:mx] Send this output for comparison; no cookie/token/password values were printed.");
process.exit(20);
