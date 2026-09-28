const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { writeJsonAtomically } = require("../utils/atomicJson");

const source = process.env.MX_SESSION_BUNDLE
  ? path.resolve(process.env.MX_SESSION_BUNDLE)
  : path.resolve(process.argv[2] || "");
if (!process.env.MX_SESSION_BUNDLE && !process.argv[2]) throw new Error("Set MX_SESSION_BUNDLE or pass the session bundle path.");
if (!fs.existsSync(source)) throw new Error("MX session bundle file was not found.");

const bundle = JSON.parse(fs.readFileSync(source, "utf8"));
if (bundle.schemaVersion !== 1 || bundle.market !== "MX" || !["S1", "S2"].includes(bundle.environment)) {
  throw new Error("Unsupported or invalid MX session bundle.");
}
const expected = bundle.integrity?.sha256;
const clone = { ...bundle };
delete clone.integrity;
const actual = crypto.createHash("sha256").update(JSON.stringify(clone)).digest("hex");
if (!expected || expected !== actual) throw new Error("MX session bundle integrity check failed.");

const requested = String(process.env.MX_QST_ENVIRONMENT || bundle.environment).toUpperCase();
if (requested !== bundle.environment) throw new Error(`Session bundle is for ${bundle.environment}, not ${requested}.`);

const suffix = requested.toLowerCase();
const authDir = path.resolve("playwright/.auth");
fs.mkdirSync(authDir, { recursive: true });
function write(name, value) {
  const destination = path.join(authDir, name);
  writeJsonAtomically(destination, value);
  try { fs.chmodSync(destination, 0o600); } catch {}
}
write(`mx-${suffix}-user.json`, bundle.primary.storageState);
write(`mx-${suffix}-session-storage.json`, bundle.primary.sessionStorage);
if (bundle.second) {
  write(`mx-${suffix}-second-user.json`, bundle.second.storageState);
  write(`mx-${suffix}-second-session-storage.json`, bundle.second.sessionStorage);
}
console.log(`[auth:install:mx] READY · installed MX ${requested} primary${bundle.second ? " + second" : ""} session state.`);
