const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const mxCoverage = require("../../governance/mx-qst-coverage.json");
const coPlan = require("../../governance/co-qst-plan.json");
const clPlan = require("../../governance/cl-qst-plan.json");
const pePlan = require("../../governance/pe-qst-reuse-plan.json");

function officialBaseStoreIds(cases) {
  return Object.entries(cases)
    .filter(([, entry]) => {
      const store = String(entry.store || "").toUpperCase();
      return ["BS", "BASE_STORE", "BASE-STORE"].includes(store) && entry.scopeStatus !== "historical-only";
    })
    .map(([id]) => id)
    .sort();
}

function regionalDetailIds(source) {
  const block = source.match(/const DETAILS = \{([\s\S]*?)\n\};\n\nenrichOfficialQst/);
  assert.ok(block, "regional DETAILS declaration must exist");
  return [...block[1].matchAll(/"(SAM-\d+)"\s*:\s*D\(/g)].map((match) => match[1]).sort();
}

function peDetailIds(source) {
  return [...source.matchAll(/"(SAM-\d+)"\s*:\s*D\(/g)].map((match) => match[1]).sort();
}

test("Allure hides Playwright API noise globally and keeps explicit business steps", () => {
  const config = read("playwright.config.js");
  assert.match(config, /\['allure-playwright',[\s\S]*?detail:\s*false/);
  assert.doesNotMatch(config, /detail:\s*true/);
  assert.match(config, /Our explicit test\.step\(\.\.\.\) nodes/);
});

test("every active official Base Store TC keeps an explicit business journey after low-level detail is hidden", () => {
  const inventories = {
    MX: officialBaseStoreIds(mxCoverage.cases),
    CO: officialBaseStoreIds(coPlan.cases),
    CL: officialBaseStoreIds(clPlan.cases),
    PE: officialBaseStoreIds(pePlan.cases),
  };

  const detailInventories = {
    MX: regionalDetailIds(read("scripts/enrich-allure-mx-qst.cjs")),
    CO: regionalDetailIds(read("scripts/enrich-allure-co-qst.cjs")),
    CL: regionalDetailIds(read("scripts/enrich-allure-cl-qst.cjs")),
    PE: peDetailIds(read("scripts/enrich-allure-pe-qst.cjs")),
  };

  assert.equal(inventories.MX.length, 29);
  assert.equal(inventories.CO.length, 29);
  assert.equal(inventories.CL.length, 31);
  assert.equal(inventories.PE.length, 28);

  for (const market of ["MX", "CO", "CL", "PE"]) {
    assert.deepEqual(
      detailInventories[market],
      inventories[market],
      `${market} must keep a per-TC business journey for every active Base Store official TC`
    );
  }
});

test("per-TC Allure definitions retain objective expected result and multiple business steps", () => {
  for (const file of [
    "scripts/enrich-allure-mx-qst.cjs",
    "scripts/enrich-allure-co-qst.cjs",
    "scripts/enrich-allure-cl-qst.cjs",
    "scripts/enrich-allure-pe-qst.cjs",
  ]) {
    const source = read(file);
    const definitions = [...source.matchAll(/"SAM-\d+"\s*:\s*D\(([^\n]+)\)/g)];
    assert.ok(definitions.length > 0, `${file} must expose explicit per-TC D(...) definitions`);
    for (const definition of definitions) {
      const line = definition[0];
      assert.match(line, /D\(".+",\s*".+",\s*\[/, `${file} definition must include objective, expected result and steps`);
      const stepsBlock = line.match(/\[([^\]]+)\]/)?.[1] || "";
      const stepCount = [...stepsBlock.matchAll(/"[^\"]+"/g)].length;
      assert.ok(stepCount >= 3, `${file} business journey must contain at least three meaningful steps: ${line.slice(0, 120)}`);
    }
  }
});
