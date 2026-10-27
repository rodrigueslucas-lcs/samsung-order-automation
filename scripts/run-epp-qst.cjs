const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { getEppConfig } = require("../config/markets/epp");
const { acquireEppLease } = require("../utils/eppSession.cjs");

function buildRun(market, args = [], sourceEnv = process.env, {readData = require('../utils/eppRuntimeData.cjs').getEppRuntimeData} = {}) {
  let config = getEppConfig(market, sourceEnv);
  // Optional proven product mass lives with the other ignored EPP fixtures.
  // Explicit operator overrides still win; listing never depends on local data.
  const product = args.includes('--list') ? null : readData(config)?.product;
  if (product && !sourceEnv[`${config.market}_EPP_QST_PDP_URL`] && !sourceEnv[`${config.market}_EPP_QST_SKU`]) {
    if (typeof product.pdpUrl !== 'string' || typeof product.sku !== 'string' || !product.sku.trim()) throw new Error('Ignored EPP product fixture is incomplete; contents suppressed.');
    sourceEnv = {...sourceEnv, [`${config.market}_EPP_QST_PDP_URL`]:product.pdpUrl, [`${config.market}_EPP_QST_SKU`]:product.sku};
    config = getEppConfig(market, sourceEnv);
  }
  const code = config.market;
  const directory = path.resolve(__dirname, "..", "tests", "markets", code.toLowerCase(), "qst", "epp");
  const files = fs.readdirSync(directory).filter(name => name.endsWith(".spec.js"));
  const ids = files.flatMap(name => [...fs.readFileSync(path.join(directory, name), "utf8").matchAll(/test\("(SAM-\d+)/g)].map(match => match[1]));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate official EPP ownership.");
  const targets = String(sourceEnv[`${code}_QST_TARGET_IDS`] || sourceEnv.P1_TARGET_IDS || "").split(/[\s,;]+/).filter(Boolean);
  if (targets.some(id => !ids.includes(id))) throw new Error("Target is outside the selected market EPP scope.");
  if (args.some(arg => arg !== "--list")) throw new Error("Unsupported EPP runner argument.");
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
  const output = path.resolve(__dirname, "..", "test-results", "epp", code.toLowerCase(), config.environment.toLowerCase(), runId);
  const env = { ...sourceEnv, TEST_MARKET: code, TEST_STORE: "EPP", TEST_SUITE: "QST", ENVIRONMENT: config.environment,
    EPP_OUTPUT_DIR: path.join(output, "playwright"), PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(output, "html"),
    PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(output, "results.json"), ALLURE_RESULTS_DIR: path.join(output, "allure"), SMB_EVIDENCE_DIR: path.join(output, "evidence") };
  for (const other of ["MX", "PE", "CO", "CL"]) if (other !== code) delete env[`${other}_QST_TARGET_IDS`];
  const selector = `tests/markets/${code.toLowerCase()}/qst/epp/`;
  return { env, output, ids, command: [require.resolve("@playwright/test/cli"), "test", selector, "--config=playwright.epp.config.js", "--workers=1", ...(targets.length ? ["--grep", `(?:${targets.join("|")})\\b`] : []), ...args] };
}

function executeRun(run, { acquire = acquireEppLease, spawn = spawnSync } = {}) {
  // Discovery is read-only; business execution owns the isolated EPP identity
  // until the worker exits, including every failure/launch-error path.
  const lease = run.command.includes("--list") ? null : acquire(getEppConfig(run.env.TEST_MARKET, run.env), run.env);
  try {
    const result = spawn(process.execPath, run.command, { cwd: path.resolve(__dirname, ".."), env: { ...run.env, ...lease?.env }, stdio: "inherit", windowsHide: true });
    return result.status ?? 1;
  } finally { lease?.release(); }
}

if (require.main === module) {
  try {
    const run = buildRun(process.argv[2], process.argv.slice(3));
    console.log(`[epp-qst] ${run.env.TEST_MARKET} ${run.env.ENVIRONMENT} · EPP · ${run.ids.length} official TCs · isolated context · retries 0`);
    process.exitCode = executeRun(run);
  } catch { console.error("[epp-qst] Invalid EPP configuration, target or launch. No runtime secrets are printed."); process.exitCode = 1; }
}
module.exports = { buildRun, executeRun };
