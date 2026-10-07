const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { writeJsonAtomically } = require("../utils/atomicJson");

const environment = String(process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CL auth environment: ${environment}.`);
const suffix = environment.toLowerCase();
const authDir = path.resolve("playwright/.auth");
const outDir = path.resolve("playwright/.session-packages");
const output = path.join(outDir, `cl-${suffix}-session-bundle.json`);

function readRequired(name) {
  const file = path.join(authDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}. Run auth:refresh:cl first.`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function readOptional(name) {
  const file = path.join(authDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

const secondState = readOptional(`cl-${suffix}-second-user.json`);
const secondSession = readOptional(`cl-${suffix}-second-session-storage.json`);
const bundle = {
  schemaVersion: 1,
  market: "CL",
  environment,
  generatedAt: new Date().toISOString(),
  primary: {
    storageState: readRequired(`cl-${suffix}-user.json`),
    sessionStorage: readRequired(`cl-${suffix}-session-storage.json`),
  },
  second: secondState && secondSession ? { storageState: secondState, sessionStorage: secondSession } : null,
};
const clone = { ...bundle };
bundle.integrity = { sha256: crypto.createHash("sha256").update(JSON.stringify(clone)).digest("hex") };
fs.mkdirSync(outDir, { recursive: true });
writeJsonAtomically(output, bundle);
try { fs.chmodSync(output, 0o600); } catch {}
console.log(`[auth:package:cl] READY · ${output}`);
console.log(`[auth:package:cl] sha256=${bundle.integrity.sha256.slice(0, 12)}…`);
