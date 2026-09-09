const fs = require("node:fs");
const path = require("node:path");
const { applyResultToLedger, buildRecordedResult } = require("../utils/preqa2ResultRecorder");

function parseArgs(argv) {
  const [market, id, status, ...rest] = argv;
  if (!market || !id || !status) {
    throw new Error(
      "Usage: node scripts/record-preqa2-result.cjs <market> <SAM-id> <PASS|FAIL|BLOCKED|NOT_APPLICABLE> " +
      "[--path /market/path] [--context guest|registered|either|unknown] [--evidence text] " +
      "[--blocker text] [--automation text] [--replace true|false]"
    );
  }
  const options = { market, id, status, allowOverwrite: false };
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near ${flag || "<end>"}.`);
    const key = flag.slice(2);
    if (key === "replace") {
      if (!/^(true|false)$/i.test(value)) throw new Error("--replace must be true or false.");
      options.allowOverwrite = /^true$/i.test(value);
      continue;
    }
    const names = {
      path: "runtimeUrl",
      context: "context",
      evidence: "evidence",
      blocker: "blocker",
      automation: "automation",
    };
    if (!names[key]) throw new Error(`Unsupported option: ${flag}`);
    options[names[key]] = value;
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve("test-mapping/preqa2-validation.json");
  const source = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const result = buildRecordedResult(options);
  const next = applyResultToLedger(source, options.market, options.id, result, {
    allowOverwrite: options.allowOverwrite,
  });
  const tempPath = `${ledgerPath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(tempPath, ledgerPath);
  console.log(
    `${String(options.market).toUpperCase()} ${options.id}: ${result.status} recorded ` +
      `(${result.runtimePath || "no runtime path"})${options.allowOverwrite ? " with explicit replacement" : ""}.`
  );
}

if (require.main === module) main();
module.exports = { parseArgs };
