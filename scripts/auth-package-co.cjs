const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { writeJsonAtomically } = require("../utils/atomicJson");

const environment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CO auth environment: ${environment}.`);
const suffix = environment.toLowerCase();
const authDir = path.resolve("playwright/.auth");
const outDir = path.resolve("playwright/.session-packages");
const output = path.join(outDir, `co-${suffix}-session-bundle.json`);

function readRequired(name) {
  const file = path.join(authDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}. Run auth:refresh:co first.`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const bundle = {
  schemaVersion: 1,
  market: "CO",
  environment,
  generatedAt: new Date().toISOString(),
  primary: {
    storageState: readRequired(`co-${suffix}-user.json`),
    sessionStorage: readRequired(`co-${suffix}-session-storage.json`),
  },
};
const clone = { ...bundle };
bundle.integrity = { sha256: crypto.createHash("sha256").update(JSON.stringify(clone)).digest("hex") };
fs.mkdirSync(outDir, { recursive: true });
writeJsonAtomically(output, bundle);
try { fs.chmodSync(output, 0o600); } catch {}
console.log(`[auth:package:co] READY · ${output}`);
console.log(`[auth:package:co] sha256=${bundle.integrity.sha256.slice(0, 12)}…`);
