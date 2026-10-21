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
  assert.equal(Object.values(inventories).reduce((sum, ids) => sum + ids.length, 0), 117);

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

test("Allure normalization hardens blocked known defects and removes broken detail sources", () => {
  const dedupe = read("scripts/dedupe-allure-evidence.cjs");
  assert.match(dedupe, /sourceExists/);
  assert.match(dedupe, /if \(!sourceExists\(attachment\)\) continue/);
  assert.match(dedupe, /TECHNICAL_STEP/);
  assert.match(dedupe, /Runtime Status/);
  assert.match(dedupe, /Known Defect/);
  assert.match(dedupe, /result\.status = "skipped"/);
  assert.match(dedupe, /Blocked by Known Defect/);
  assert.match(dedupe, /blocked\/non-gating/);
});

test("final Allure normalization maps known defects and uses one presentation hierarchy globally", () => {
  const dedupe = read("scripts/dedupe-allure-evidence.cjs");
  const polish = read("scripts/polish-allure-presentation.cjs");
  assert.match(dedupe, /governance\/known-defects\.json/);
  assert.match(dedupe, /function mappedDefect\(result\)/);
  assert.match(dedupe, /parameterValue\(result, "Market"\)/);
  assert.match(dedupe, /parameterValue\(result, "Environment"\)/);
  assert.match(dedupe, /parameterValue\(result, "Store"\)/);
  assert.match(dedupe, /Known Defect Title/);
  assert.match(dedupe, /### Validation Summary/);
  assert.match(dedupe, /### Expected Result/);
  assert.match(dedupe, /### Actual Result/);
  assert.match(dedupe, /### Technical Error/);
  assert.match(dedupe, /### Blocker \/ Prerequisite/);
  assert.match(dedupe, /### Execution Context/);
  assert.match(dedupe, /### Links & Evidence/);
  assert.match(dedupe, /function polishFailureStatusDetails/);
  assert.match(dedupe, /Business-readable summary is shown here/);
  assert.match(dedupe, /PASS — all automated assertions executed for this scenario were satisfied/);
  assert.match(dedupe, /BLOCKED \/ KNOWN DEFECT/);
  assert.match(dedupe, /FAIL \/ KNOWN DEFECT/);
  assert.match(polish, /descriptionHtml/);
  assert.match(polish, /Validation Summary/);
  assert.match(polish, /Known Defect/);
  assert.match(polish, /LOW_LEVEL_STEP/);
});

test("structured Allure hierarchy is applied to MX PE CO CL in both S1 and S2", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-allure-presentation-"));
  try {
    const markets = ["MX", "PE", "CO", "CL"];
    const environments = ["S1 / STG", "S2 / STG2"];
    let index = 0;
    for (const market of markets) {
      for (const environment of environments) {
        const samId = `SAM-9${String(index++).padStart(4, "0")}`;
        const result = {
          uuid: `${market}-${environment}`.replace(/\W/g, "-"),
          name: `${samId} · Synthetic official validation`,
          fullName: `${market} ${environment} ${samId}`,
          status: "failed",
          stage: "finished",
          description: `### [${samId}](https://jira.secext.samsung.net/browse/${samId}) · Synthetic official validation\n\n**Objective:** Validate ${market} ${environment} business behavior.\n**Expected result:** The expected storefront state is rendered.`,
          statusDetails: {
            message: "Error: expect(locator).toBeVisible() failed\nLocator: getByText('EXPECTED-SKU', { exact: true }).first()\nError: element(s) not found",
            trace: "",
          },
          parameters: [
            { name: "Market", value: market },
            { name: "Environment", value: environment },
            { name: "Store", value: "Base Store" },
            { name: "Feature", value: "Cart & Promotions" },
            { name: "User Type", value: "Guest" },
            { name: "SKU", value: "EXPECTED-SKU" },
            { name: "Runtime Status", value: "FAIL" },
          ],
          labels: [],
          links: [],
          attachments: [],
          steps: [
            { name: "Prepare controlled cart", status: "passed", steps: [
              { name: "Wait for selector", status: "passed", steps: [], attachments: [] },
              { name: "Click", status: "passed", steps: [], attachments: [] },
            ], attachments: [] },
          ],
        };
        fs.writeFileSync(path.join(dir, `${result.uuid}-result.json`), JSON.stringify(result, null, 2));
      }
    }

    execFileSync(process.execPath, [path.join(root, "scripts/dedupe-allure-evidence.cjs"), dir], { cwd: root });
    execFileSync(process.execPath, [path.join(root, "scripts/polish-allure-presentation.cjs"), dir], { cwd: root });

    const results = fs.readdirSync(dir)
      .filter((name) => name.endsWith("-result.json"))
      .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")));
    assert.equal(results.length, 8);
    for (const result of results) {
      const description = result.description;
      assert.match(description, /### Validation Summary/);
      assert.match(description, /### Expected Result/);
      assert.match(description, /### Actual Result/);
      assert.match(description, /### Technical Error/);
      assert.match(description, /### Execution Context/);
      assert.match(description, /### Links & Evidence/);
      assert.match(description, /Expected value or storefront content "EXPECTED-SKU" was not visible/);
      assert.match(description, /\*\*Market:\*\*/);
      assert.match(description, /\*\*Environment:\*\*/);
      assert.match(result.descriptionHtml, /Validation Summary/);
      assert.match(result.descriptionHtml, /Expected Result/);
      assert.match(result.descriptionHtml, /Actual Result/);
      assert.match(result.descriptionHtml, /Execution Context/);
      assert.doesNotMatch(JSON.stringify(result.steps), /Wait for selector|Click/);
      assert.match(result.statusDetails.message, /Expected value or storefront content "EXPECTED-SKU" was not visible/);
      assert.doesNotMatch(result.statusDetails.message, /expect\(locator\)\.toBeVisible\(\) failed/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("mapped known defects are visually explicit and non-gating in Allure without losing raw runtime status", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-allure-known-defect-"));
  try {
    const result = {
      uuid: "known-defect",
      name: "SAM-24896 · Cart value when Reg user logs out",
      fullName: "CO S2 SAM-24896",
      status: "failed",
      stage: "finished",
      description: "## SAM-24896\n\n### Validation Summary\n**Status:** FAIL / KNOWN DEFECT RT-752445\n**Validation goal:** Validate cart persistence.\n\n### Expected Result\nCart remains available.\n\n### Actual Result\nFAIL / KNOWN DEFECT RT-752445 — cart was empty.\n\n### Technical Error\n```text\nexpect(locator).toBeVisible() failed\n```\n\n### Execution Context\n- **Market:** CO",
      statusDetails: { message: "cart was empty", trace: "" },
      parameters: [
        { name: "Market", value: "CO" },
        { name: "Environment", value: "S2 / STG2" },
        { name: "Store", value: "Base Store" },
        { name: "Runtime Status", value: "FAIL" },
        { name: "Known Defect", value: "RT-752445" },
        { name: "Known Defect Title", value: "CO S2 Cart Items Are Lost After Registered User Logout" },
      ],
      labels: [], links: [], attachments: [], steps: [],
    };
    const file = path.join(dir, "known-defect-result.json");
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    execFileSync(process.execPath, [path.join(root, "scripts/polish-allure-presentation.cjs"), dir], { cwd: root });
    const polished = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(polished.status, "skipped");
    assert.equal(polished.parameters.find((item) => item.name === "Runtime Status").value, "FAIL");
    assert.match(polished.statusDetails.message, /KNOWN DEFECT RT-752445/);
    assert.match(polished.statusDetails.message, /Raw runtime status: FAIL/);
    assert.match(polished.descriptionHtml, /KNOWN DEFECT · RT-752445/);
    assert.match(polished.descriptionHtml, /CO S2 Cart Items Are Lost After Registered User Logout/);
    assert.match(polished.steps[0].name, /Known Defect · RT-752445/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
