const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { writeJsonAtomically } = require("../utils/atomicJson");

const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported MX auth environment: ${environment}.`);
const suffix = environment.toLowerCase();
const authDir = path.resolve("playwright/.auth");
const outDir = path.resolve("playwright/.session-packages");
const output = path.join(outDir, `mx-${suffix}-session-bundle.json`);

function readRequired(name) {
  const file = path.join(authDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}. Run auth:refresh:mx first.`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function readOptional(name) {
  const file = path.join(authDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}
function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const primary = {
  storageState: readRequired(`mx-${suffix}-user.json`),
  sessionStorage: readRequired(`mx-${suffix}-session-storage.json`),
};
const verified = readRequired(`mx-${suffix}-verified.json`);
const secondState = readOptional(`mx-${suffix}-second-user.json`);
const secondSession = readOptional(`mx-${suffix}-second-session-storage.json`);
const secondVerified = readOptional(`mx-${suffix}-second-verified.json`);

const bundle = {
  schemaVersion: 1,
  market: "MX",
  environment,
  generatedAt: new Date().toISOString(),
  primary,
  second: secondState && secondSession ? { storageState: secondState, sessionStorage: secondSession } : null,
  verification: {
    primary: { verifiedAt: verified.verifiedAt || null },
    second: secondVerified ? { verifiedAt: secondVerified.verifiedAt || null } : null,
  },
};
bundle.integrity = { sha256: digest({ ...bundle, integrity: undefined }) };

fs.mkdirSync(outDir, { recursive: true });
writeJsonAtomically(output, bundle);
try { fs.chmodSync(output, 0o600); } catch {}
console.log(`[auth:package:mx] READY · ${output}`);
console.log(`[auth:package:mx] primary=yes · second=${bundle.second ? "yes" : "no"} · sha256=${bundle.integrity.sha256.slice(0, 12)}…`);
console.log("[auth:package:mx] Sensitive session material. Never commit, archive as public artifact, or print its contents.");
