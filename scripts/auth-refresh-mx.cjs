const { spawnSync } = require("node:child_process");

const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported MX auth environment: ${environment}.`);

const baseEnv = { ...process.env, MX_QST_ENVIRONMENT: environment };

function run(label, script, extraEnv = {}) {
  console.log(`\n[auth:refresh:mx] ${label}`);
  const result = spawnSync(process.execPath, [script], {
    env: { ...baseEnv, ...extraEnv },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

run(`Refreshing primary Samsung Account session for ${environment}`, "scripts/auth-login-mx.cjs");
run(`Verifying primary Samsung Account session for ${environment}`, "scripts/auth-verify-mx.cjs");

if (process.env.MX_AUTH_REFRESH_SECOND === "1") {
  run(`Refreshing second Samsung Account session for ${environment}`, "scripts/auth-login-mx.cjs", { MX_AUTH_SLOT: "second" });
  run(`Verifying second Samsung Account session for ${environment}`, "scripts/auth-verify-mx.cjs", { MX_AUTH_SLOT: "second" });
}

run(`Packaging verified MX ${environment} session for CI handoff`, "scripts/auth-package-mx.cjs");\n\nif (process.env.JENKINS_AUTH_PUBLISH === "1") {\n  run(`Publishing MX ${environment} session bundle to Jenkins`, "scripts/auth-publish-jenkins.cjs");\n}\n\nconsole.log(`\n[auth:refresh:mx] READY · MX ${environment} authenticated session refreshed, verified and packaged.`);
console.log("[auth:refresh:mx] CAPTCHA/MFA remains a human security gate when Samsung Account requests it.");
