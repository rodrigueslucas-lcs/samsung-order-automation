const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported MX auth environment: ${environment}.`);
const slot = String(process.env.MX_AUTH_SLOT || "primary").trim().toLowerCase();
if (!["primary", "second"].includes(slot)) throw new Error(`Unsupported MX auth slot: ${slot}.`);

const suffix = environment.toLowerCase();
const infix = slot === "second" ? "-second" : "";
const authDir = path.resolve("playwright/.auth");
const stateFiles = [
  path.join(authDir, `mx-${suffix}${infix}-user.json`),
  path.join(authDir, `mx-${suffix}${infix}-session-storage.json`),
];
const marker = path.join(authDir, `mx-${suffix}${infix}-verified.json`);
const ci = ["1", "true"].includes(String(process.env.CI || "").toLowerCase());

function status(label, ok, detail = "") {
  console.log(`${ok ? "READY" : "ACTION_REQUIRED"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

const missing = stateFiles.filter((file) => !fs.existsSync(file));
if (missing.length) {
  status("Samsung Account", false, `missing ${missing.map((file) => path.basename(file)).join(", ")}`);
  process.exit(20);
}
if (!fs.existsSync(marker) && !ci) {
  status("Samsung Account", false, "verified marker missing; run auth:refresh:mx");
  process.exit(20);
}
if (!fs.existsSync(marker) && ci) {
  console.log(`CHECK · Samsung Account · imported MX ${environment} ${slot} bundle has no local marker; performing mandatory live verification`);
}

const verify = spawnSync(process.execPath, ["scripts/auth-verify-mx.cjs"], {
  env: { ...process.env, MX_QST_ENVIRONMENT: environment, MX_AUTH_SLOT: slot },
  stdio: "inherit",
});
if (verify.status !== 0) {
  status("Samsung Account", false, `MX ${environment} ${slot} live verification failed; refresh authentication`);
  process.exit(20);
}

status("Samsung Account", true, `MX ${environment} ${slot} live session verified`);
console.log("AUTH_READY");
