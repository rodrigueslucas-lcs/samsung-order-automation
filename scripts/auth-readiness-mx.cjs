const { spawnSync } = require("node:child_process");

const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) {
  throw new Error(`Unsupported MX auth environment: ${environment}.`);
}

const baseEnv = { ...process.env, MX_QST_ENVIRONMENT: environment };

function run(label, command, args, extraEnv = {}) {
  console.log(`\n[auth:readiness:mx] CHECK · ${label}`);
  const result = spawnSync(command, args, {
    env: { ...baseEnv, ...extraEnv },
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`\n[auth:readiness:mx] ACTION_REQUIRED · ${label} failed (exit ${result.status ?? "unknown"}).`);
    process.exit(result.status || 20);
  }

  console.log(`[auth:readiness:mx] READY · ${label}`);
}

console.log(`
============================================================
 MX ${environment} · AUTHENTICATION & ENVIRONMENT READINESS
============================================================`);

run("Samsung Account primary", process.execPath, ["scripts/auth-doctor-mx.cjs"], { CI: "1", MX_AUTH_SLOT: "primary" });
run("Samsung Account second", process.execPath, ["scripts/auth-doctor-mx.cjs"], { CI: "1", MX_AUTH_SLOT: "second" });
run("Verified session package", process.execPath, ["scripts/auth-package-mx.cjs"]);
run("Jenkins session bundle", process.execPath, ["scripts/auth-publish-jenkins.cjs"]);

if (environment === "S2") {
  run("WMC / PreQA2 CDP", process.execPath, ["scripts/preqa2-cdp-preflight.cjs"]);
} else {
  console.log("[auth:readiness:mx] SKIP · WMC / PreQA2 CDP · readiness preflight is currently defined for S2.");
}

console.log(`
============================================================
 MX ${environment} READINESS
 Samsung Primary ........ READY
 Samsung Second ......... READY
 Jenkins Bundle ......... READY
 WMC / PreQA2 ........... ${environment === "S2" ? "READY" : "N/A"}
 -----------------------------------------------------------
 QST READY
============================================================`);
