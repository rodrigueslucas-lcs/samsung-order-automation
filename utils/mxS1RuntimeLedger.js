const fs = require("node:fs");
const path = require("node:path");

const LEDGER_PATH = path.resolve("test-mapping/mx-s1-qst-runtime.json");
const STATUSES = new Set(["PASS", "FAIL", "BLOCKED"]);

function loadMxS1RuntimeLedger() {
  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
  if (ledger.environment !== "S1/STG" || ledger.market !== "MX") throw new Error("Invalid MX S1 runtime ledger identity.");
  for (const [id, result] of Object.entries(ledger.results || {})) {
    if (!/^SAM-\d+$/.test(id) || !STATUSES.has(result.status)) throw new Error(`Invalid MX S1 runtime result: ${id}.`);
  }
  return ledger;
}

function writeMxS1RuntimeResults(updates) {
  const ledger = loadMxS1RuntimeLedger();
  for (const update of updates) {
    if (!/^SAM-\d+$/.test(update.id) || !STATUSES.has(update.status)) throw new Error(`Invalid MX S1 runtime update: ${update.id}.`);
    ledger.results[update.id] = {
      status: update.status,
      evidence: String(update.evidence || "").trim() || null,
      blocker: String(update.blocker || "").trim() || null,
      validatedAt: update.validatedAt || new Date().toISOString(),
    };
  }
  const temporary = `${LEDGER_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, LEDGER_PATH);
  return ledger;
}

module.exports = { LEDGER_PATH, loadMxS1RuntimeLedger, writeMxS1RuntimeResults };
