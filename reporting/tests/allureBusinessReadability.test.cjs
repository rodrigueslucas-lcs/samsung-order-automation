const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

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

function runPresentationPipeline(dir, { normalizeBusinessStatus = false } = {}) {
  execFileSync(process.execPath, [path.join(root, "scripts/dedupe-allure-evidence.cjs"), dir], { cwd: root });
  if (normalizeBusinessStatus) {
    execFileSync(process.execPath, [path.join(root, "scripts/normalize-allure-business-status.cjs"), dir], { cwd: root });
  }
  execFileSync(process.execPath, [path.join(root, "scripts/polish-allure-presentation.cjs"), dir], { cwd: root });
}

test("Allure hides Playwright API noise globally and keeps explicit business steps", () => {
  const config = read("playwright.config.js");
  assert.match(config, /\['allure-playwright',[\s\S]*?detail:\s*false/);
  assert.doesNotMatch(config, /detail:\s*true/);
  assert.match(config, /Our explicit test\.step\(\.\.\.\) nodes/);
});

test("every active official Base Store TC keeps an explicit business journey", () => {
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
  assert.equal(Object.values(inventories).reduce((sum, ids) => sum + ids.length, 0), 117);
  for (const market of ["MX", "CO", "CL", "PE"]) {
    assert.deepEqual(detailInventories[market], inventories[market], `${market} must keep business detail for every active official TC`);
  }
});

test("per-TC definitions retain objective expected result and multiple business steps", () => {
  for (const file of [
    "scripts/enrich-allure-mx-qst.cjs",
    "scripts/enrich-allure-co-qst.cjs",
    "scripts/enrich-allure-cl-qst.cjs",
    "scripts/enrich-allure-pe-qst.cjs",
  ]) {
    const source = read(file);
    const definitions = [...source.matchAll(/"SAM-\d+"\s*:\s*D\(([^\n]+)\)/g)];
    assert.ok(definitions.length > 0, `${file} must expose explicit per-TC definitions`);
    for (const definition of definitions) {
      const line = definition[0];
      assert.match(line, /D\(".+",\s*".+",\s*\[/, `${file} definition must include objective, expected result and steps`);
      const stepsBlock = line.match(/\[([^\]]+)\]/)?.[1] || "";
      assert.ok([...stepsBlock.matchAll(/"[^\"]+"/g)].length >= 3, `${file} journey needs at least three business steps`);
    }
  }
});

test("global Allure presentation owns both rich HTML and readable plain fallback", () => {
  const dedupe = read("scripts/dedupe-allure-evidence.cjs");
  const polish = read("scripts/polish-allure-presentation.cjs");
  assert.match(dedupe, /governance\/known-defects\.json/);
  assert.match(polish, /result\.descriptionHtml\s*=/);
  assert.match(polish, /O que foi validado/);
  assert.match(polish, /Resultado esperado/);
  assert.match(polish, /Resultado observado/);
  assert.match(polish, /Contexto da execução/);
  assert.match(polish, /Known Defect/);
  assert.match(polish, /PRÉ-REQUISITO \/ DESBLOQUEIO/);
  assert.match(polish, /━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━/);
  assert.match(polish, /Some Allure side panels render the plain description/);
  assert.match(polish, /screenshot\\b/);
  assert.match(polish, /scroll into view/);
});

test("polished Allure layout applies to MX PE CO CL in S1 and S2 and hides low-level steps", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-allure-cards-"));
  try {
    const markets = ["MX", "PE", "CO", "CL"];
    const environments = ["S1 / STG", "S2 / STG2"];
    let index = 0;
    for (const market of markets) {
      for (const environment of environments) {
        const sam = `SAM-9${String(index++).padStart(4, "0")}`;
        const result = {
          uuid: `${market}-${environment}`.replace(/\W/g, "-"),
          name: `${sam} · Synthetic official validation`,
          fullName: `${market} ${environment} ${sam}`,
          status: "failed",
          stage: "finished",
          description: `**Objective:** Validate ${market} ${environment} business behavior.\n**Expected result:** The expected storefront state is rendered.`,
          statusDetails: { message: "Error: expect(locator).toBeVisible() failed\nLocator: getByText('EXPECTED-SKU', { exact: true }).first()\nError: element(s) not found", trace: "" },
          parameters: [
            { name: "Market", value: market },
            { name: "Environment", value: environment },
            { name: "Store", value: "Base Store" },
            { name: "User Type", value: "Guest" },
            { name: "SKU", value: "EXPECTED-SKU" },
            { name: "Runtime Status", value: "FAIL" },
          ],
          labels: [], links: [], attachments: [],
          steps: [{ name: "Prepare controlled cart", status: "passed", attachments: [], steps: [
            { name: "Wait for selector", status: "passed", steps: [], attachments: [] },
            { name: "Click", status: "passed", steps: [], attachments: [] },
            { name: "Screenshot", status: "passed", steps: [], attachments: [] },
            { name: "Scroll into view", status: "passed", steps: [], attachments: [] },
            { name: "Check", status: "passed", steps: [], attachments: [] },
          ] }],
        };
        fs.writeFileSync(path.join(dir, `${result.uuid}-result.json`), JSON.stringify(result, null, 2));
      }
    }

    runPresentationPipeline(dir);
    const results = fs.readdirSync(dir).filter((name) => name.endsWith("-result.json")).map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")));
    assert.equal(results.length, 8);
    for (const result of results) {
      assert.match(result.descriptionHtml, /O que foi validado/);
      assert.match(result.descriptionHtml, /Resultado esperado/);
      assert.match(result.descriptionHtml, /Resultado observado/);
      assert.match(result.descriptionHtml, /Contexto da execução/);
      assert.match(result.descriptionHtml, /EXPECTED-SKU/);
      assert.match(result.description, /FAIL\s+·\s+SAM-/);
      assert.match(result.description, /VALIDAÇÃO/);
      assert.match(result.description, /RESULTADO ESPERADO/);
      assert.match(result.description, /RESULTADO OBSERVADO/);
      assert.match(result.description, /CONTEXTO/);
      assert.doesNotMatch(JSON.stringify(result.steps), /Wait for selector|Click|Screenshot|Scroll into view|Check/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("business BLOCKED is rendered as non-red Allure skipped while technical failure remains visible", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-allure-blocked-"));
  try {
    const result = {
      uuid: "blocked-auth",
      name: "SAM-24807 · Login from Checkout page",
      fullName: "CL S2 SAM-24807",
      status: "failed",
      stage: "finished",
      description: "**Objective:** Validate legitimate Samsung Account login initiated from CL Checkout.\n**Expected result:** Checkout reaches the real Samsung Account flow and returns to authenticated CL checkout.",
      statusDetails: { message: "Error: Legitimate CL Samsung Account credentials are required for checkout login.", trace: "technical raw trace" },
      parameters: [
        { name: "Market", value: "CL" },
        { name: "Environment", value: "S2 / STG2" },
        { name: "Store", value: "Base Store" },
        { name: "Runtime Status", value: "BLOCKED" },
        { name: "User Type", value: "Registered" },
      ], labels: [], links: [], attachments: [], steps: [],
    };
    const file = path.join(dir, "blocked-result.json");
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    runPresentationPipeline(dir, { normalizeBusinessStatus: true });
    const polished = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(polished.status, "skipped");
    assert.equal(polished.parameters.find((item) => item.name === "Runtime Status").value, "BLOCKED");
    assert.equal(polished.parameters.find((item) => item.name === "Technical Result").value, "FAILED");
    assert.match(polished.descriptionHtml, /BLOCKED/);
    assert.match(polished.descriptionHtml, /Pré-requisito \/ desbloqueio/);
    assert.match(polished.description, /PRÉ-REQUISITO \/ DESBLOQUEIO/);
    assert.match(polished.statusDetails.message, /BLOCKED/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("mapped known defect is explicit, non-gating and easy to scan", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-allure-known-defect-"));
  try {
    const result = {
      uuid: "known-defect",
      name: "SAM-24896 · Cart value when Reg user logs out",
      fullName: "CO S2 SAM-24896",
      status: "failed",
      stage: "finished",
      description: "**Objective:** Validate cart persistence after registered-user logout.\n**Expected result:** The expected cart state remains available after logout.",
      statusDetails: { message: "Error: expect(locator).toBeVisible() failed\nLocator: getByText('RF32CG5910B1CO', { exact: true }).first()", trace: "" },
      parameters: [
        { name: "Market", value: "CO" },
        { name: "Environment", value: "S2 / STG2" },
        { name: "Store", value: "Base Store" },
        { name: "Runtime Status", value: "FAIL" },
        { name: "SKU", value: "RF32CG5910B1CO" },
      ], labels: [], links: [], attachments: [], steps: [],
    };
    const file = path.join(dir, "known-defect-result.json");
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    runPresentationPipeline(dir);
    const polished = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(polished.status, "skipped");
    assert.equal(polished.parameters.find((item) => item.name === "Runtime Status").value, "FAIL");
    assert.equal(polished.parameters.find((item) => item.name === "Known Defect").value, "RT-752445");
    assert.match(polished.statusDetails.message, /KNOWN DEFECT · RT-752445/);
    assert.match(polished.descriptionHtml, /KNOWN DEFECT/);
    assert.match(polished.descriptionHtml, /RT-752445/);
    assert.match(polished.descriptionHtml, /O que foi validado/);
    assert.match(polished.descriptionHtml, /Resultado esperado/);
    assert.match(polished.descriptionHtml, /Resultado observado/);
    assert.match(polished.description, /KNOWN DEFECT/);
    assert.match(polished.description, /RESULTADO OBSERVADO/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Allure home metadata persists isolated Trend history by market and environment", () => {
  const metadata = read("scripts/prepare-allure-ci-metadata.cjs");
  const regionalFinalizer = read("scripts/finalize-jenkins-suite.cjs");
  const mxFinalizer = read("scripts/finalize-allure-mx-qst.cjs");
  assert.match(metadata, /executor\.json/);
  assert.match(metadata, /environment\.properties/);
  assert.match(metadata, /categories\.json/);
  assert.match(metadata, /\.allure-history-cache/);
  assert.match(metadata, /slug\(market\)/);
  assert.match(metadata, /slug\(environment\)/);
  assert.match(metadata, /function restoreHistory/);
  assert.match(metadata, /function saveHistory/);
  assert.match(regionalFinalizer, /prepareAllureCiMetadata\('save'\)/);
  assert.match(mxFinalizer, /"save"/);
});
