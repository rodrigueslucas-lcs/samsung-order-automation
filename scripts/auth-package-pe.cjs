const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { writeJsonAtomically } = require("../utils/atomicJson");

const environment = String(process.env.PE_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported PE auth environment: ${environment}.`);
const suffix = environment.toLowerCase();
const authDir = path.resolve("playwright/.auth");
const outDir = path.resolve("playwright/.session-packages");
const output = path.join(outDir, `pe-${suffix}-session-bundle.json`);

function readRequired(name) {
  const file = path.join(authDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}. Run auth:refresh:pe first.`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const bundle = {
  schemaVersion: 1,
  market: "PE",
  environment,
  generatedAt: new Date().toISOString(),
  primary: {
    storageState: readRequired(`pe-${suffix}-user.json`),
    sessionStorage: readRequired(`pe-${suffix}-session-storage.json`),
  },
};
const clone = { ...bundle };
bundle.integrity = { sha256: crypto.createHash("sha256").update(JSON.stringify(clone)).digest("hex") };
fs.mkdirSync(outDir, { recursive: true });
writeJsonAtomically(output, bundle);
try { fs.chmodSync(output, 0o600); } catch {}
console.log(`[auth:package:pe] READY · ${output}`);
console.log(`[auth:package:pe] sha256=${bundle.integrity.sha256.slice(0, 12)}…`);
