const { spawnSync } = require("node:child_process");
const path = require("node:path");

const validTypes = new Set(["normal", "modified", "sanity"]);
const validStores = new Set(["base-store", "epp"]);
const type = process.argv[2] || "normal";
const store = process.argv[3];

if (!validTypes.has(type)) {
  throw new Error(`Unsupported QST type: ${type}`);
}
if (store && !validStores.has(store)) {
  throw new Error(`Unsupported QST store: ${store}`);
}

const testPath = store ? `tests/s2/pe/qst/${store}` : "tests/s2/pe/qst";
const grep = store ? "@qst" : `@qst-${type}`;
const playwrightCli = path.join(
  path.dirname(require.resolve("@playwright/test")),
  "cli.js"
);
const result = spawnSync(
  process.execPath,
  [playwrightCli, "test", testPath, "--grep", grep, "--grep-invert", "@destructive", "--workers=1", "--retries=0"],
  {
    env: { ...process.env, QST_TYPE: type },
    stdio: "inherit",
    shell: false,
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
