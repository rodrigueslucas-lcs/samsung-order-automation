const fs = require("node:fs");
const path = require("node:path");
const { diffPreqa2Ledgers, mergePreqa2Ledgers } = require("../utils/preqa2LedgerMerge");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function main(argv = process.argv.slice(2)) {
  const [basePath, incomingPath, outputPath, strategy = "error"] = argv;
  if (!basePath || !incomingPath || !outputPath) {
    throw new Error(
      "Usage: node scripts/merge-preqa2-ledgers.cjs <base.json> <incoming.json> <output.json> " +
      "[error|prefer-newer|prefer-base|prefer-incoming]"
    );
  }
  if (!["error", "prefer-newer", "prefer-base", "prefer-incoming"].includes(strategy)) {
    throw new Error(`Unsupported merge strategy: ${strategy}`);
  }

  const base = readJson(basePath);
  const incoming = readJson(incomingPath);
  const diff = diffPreqa2Ledgers(base, incoming);
  console.log("PreQA2 ledger diff:");
  for (const market of ["MX", "CL", "CO", "PE"]) {
    const current = diff[market];
    console.log(
      `- ${market}: added=${current.added.length} removed=${current.removed.length} ` +
      `changed=${current.changed.length} unchanged=${current.unchanged.length}`
    );
    if (current.changed.length) console.log(`  conflicts/reviews: ${current.changed.join(", ")}`);
  }

  const merged = mergePreqa2Ledgers(base, incoming, { strategy });
  const target = path.resolve(outputPath);
  if (fs.existsSync(target)) throw new Error(`Output already exists: ${target}`);
  fs.writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`, { flag: "wx" });
  console.log(`Merged ledger written to ${target}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[preqa2-ledger-merge] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main, readJson };
