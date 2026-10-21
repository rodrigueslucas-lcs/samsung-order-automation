const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');

function run(script, dir) {
  execFileSync(process.execPath, [path.join(root, script), dir], { cwd: root, stdio: 'pipe' });
}

function fixture(overrides = {}) {
  return {
    uuid: 'fixture',
    name: 'SAM-24807 · Login from Checkout page',
    fullName: 'CL S2 SAM-24807',
    status: 'failed',
    stage: 'finished',
    description: '**Objective:** Validate legitimate Samsung Account login initiated from CL Checkout.\n**Expected result:** Checkout returns authenticated.',
    statusDetails: { message: 'Error: Legitimate credentials are required for checkout login.', trace: 'raw trace' },
    parameters: [
      { name: 'Market', value: 'CL' },
      { name: 'Environment', value: 'S2 / STG2' },
      { name: 'Project', value: 'chromium' },
      { name: 'Runtime Status', value: 'BLOCKED' },
      { name: 'SKU', value: 'SM-S918BZKILTL' },
      { name: 'Store', value: 'Base Store' },
      { name: 'User Type', value: 'Registered' },
    ],
    labels: [],
    links: [],
    attachments: [],
    steps: [
      { name: 'Open Checkout and start login', status: 'passed', stage: 'finished', steps: [], attachments: [], parameters: [], statusDetails: {} },
    ],
    ...overrides,
  };
}

test('structured business view hides repeated suite-row parameters and creates titled sections', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-business-view-'));
  try {
    const file = path.join(dir, 'blocked-result.json');
    fs.writeFileSync(file, JSON.stringify(fixture(), null, 2));

    run('scripts/normalize-allure-business-status.cjs', dir);
    run('scripts/polish-allure-presentation.cjs', dir);
    run('scripts/structure-allure-business-view.cjs', dir);

    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(result.status, 'skipped');
    for (const parameter of result.parameters.filter((item) => ['Market', 'Environment', 'Project', 'Runtime Status', 'SKU', 'Store', 'User Type'].includes(item.name))) {
      assert.equal(parameter.mode, 'hidden');
      assert.equal(parameter.excluded, true);
    }

    assert.equal(result.description.split('\n').length, 2);
    assert.match(result.description, /^BLOCKED · SAM-24807/m);

    const names = result.steps.map((step) => step.name);
    assert.deepEqual(names.slice(0, 5), [
      '01 · O que foi validado',
      '02 · Resultado esperado',
      '03 · Resultado observado',
      '04 · Pré-requisito / desbloqueio',
      '05 · Contexto da execução',
    ]);
    assert.match(names.at(-1), /Execução do negócio/);
    assert.match(JSON.stringify(result.steps), /Market · CL/);
    assert.match(JSON.stringify(result.steps), /Environment · S2 \/ STG2/);
    assert.match(JSON.stringify(result.steps), /Open Checkout and start login/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('known defect keeps raw runtime but every presentation section is non-gating', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-known-defect-view-'));
  try {
    const file = path.join(dir, 'known-result.json');
    fs.writeFileSync(file, JSON.stringify(fixture({
      name: 'SAM-24896 · Cart value when Reg user logs out',
      fullName: 'CO S2 SAM-24896',
      parameters: [
        { name: 'Market', value: 'CO' },
        { name: 'Environment', value: 'S2 / STG2' },
        { name: 'Store', value: 'Base Store' },
        { name: 'Runtime Status', value: 'FAIL' },
        { name: 'SKU', value: 'RF32CG5910B1CO' },
      ],
      description: '**Objective:** Validate cart persistence after logout.\n**Expected result:** Cart remains available.',
    }), null, 2));

    run('scripts/dedupe-allure-evidence.cjs', dir);
    run('scripts/polish-allure-presentation.cjs', dir);
    run('scripts/structure-allure-business-view.cjs', dir);

    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(result.status, 'skipped');
    assert.equal(result.parameters.find((item) => item.name === 'Runtime Status').value, 'FAIL');
    assert.equal(result.parameters.find((item) => item.name === 'Known Defect').value, 'RT-752445');
    assert.match(result.description, /^KNOWN DEFECT · RT-752445/m);
    assert.ok(result.steps.some((step) => /Known Defect · RT-752445/.test(step.name)));
    assert.ok(result.steps.filter((step) => /Resultado observado|Known Defect|Execução do negócio/.test(step.name)).every((step) => step.status === 'skipped'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
