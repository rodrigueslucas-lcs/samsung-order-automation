const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported MX auth environment: ${environment}.`);

const suffix = environment.toLowerCase();
const authDir = path.resolve("playwright/.auth");
const primaryFiles = [
  path.join(authDir, `mx-${suffix}-user.json`),
  path.join(authDir, `mx-${suffix}-session-storage.json`),
];
const marker = path.join(authDir, `mx-${suffix}-verified.json`);

function status(label, ok, detail = "") {
  console.log(`${ok ? "READY" : "ACTION_REQUIRED"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

const missing = primaryFiles.filter((file) => !fs.existsSync(file));
if (missing.length) {
  status("Samsung Account", false, `missing ${missing.map((file) => path.basename(file)).join(", ")}`);
  process.exit(20);
}
if (!fs.existsSync(marker)) {
  status("Samsung Account", false, "verified marker missing; run auth:refresh:mx");
  process.exit(20);
}

const verify = spawnSync(process.execPath, ["scripts/auth-verify-mx.cjs"], {
  env: { ...process.env, MX_QST_ENVIRONMENT: environment },
  stdio: "inherit",
});
if (verify.status !== 0) {
  status("Samsung Account", false, "live verification failed; run auth:refresh:mx");
  process.exit(20);
}

status("Samsung Account", true, `MX ${environment} ${slot} live session verified`);
console.log("AUTH_READY");
