const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("all package discovery/list commands use console-only reporting", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts;
  const directListScripts = Object.entries(scripts).filter(([, command]) => /playwright test .*--list/.test(command));
  assert.ok(directListScripts.length > 0);
  for (const [name, command] of directListScripts) {
    assert.match(command, /--reporter=list\b/, `${name} must not load artifact reporters`);
  }
});

test("MX list runner explicitly overrides global artifact reporters", () => {
  const source = fs.readFileSync(path.join(root, "scripts/run-mx-qst-safe.cjs"), "utf8");
  const listBranch = source.match(/if \(listOnly\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(listBranch, /"--list", "--reporter=list"/);
  assert.doesNotMatch(listBranch, /PLAYWRIGHT_JSON_OUTPUT_FILE|SMB_EVIDENCE_DIR|generateExecutive/);
});
