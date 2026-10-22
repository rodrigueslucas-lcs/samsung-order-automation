const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');

function run(script, dir, env = {}) {
  execFileSync(process.execPath, [path.join(root, script), dir], {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, ...env },
  });
}

function fixture(overrides = {}) {
  return {
    uuid: 'fixture',
    name: 'SAM-24807 · Login from Checkout page',
    fullName: 'CL S2 SAM-24807',
    status: 'failed',
    stage: 'finished',
    description: '**Objective:** Validate legitimate Samsung Account login initiated from CL Checkout.\n**Expected result:** Checkout returns authenticated.\n**Observed:** Required authenticated session was unavailable.\n**Prerequisite:** Restore authenticated Samsung Account session.',
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

function envForBuild() {
  return {
    BUILD_URL: 'http://127.0.0.1:8080/job/SAMSUNG-SMB-AUTOMATION/999/',
    BUILD_NUMBER: '999',
    JENKINS_ARTIFACT_DIR: 'test-results/jenkins/co-qst',
  };
}

test('structured business view hides repeated suite-row parameters and creates titled sections', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-business-view-'));
  try {
    const file = path.join(dir, 'blocked-result.json');
    fs.writeFileSync(file, JSON.stringify(fixture(), null, 2));

    run('scripts/normalize-allure-business-status.cjs', dir);
    run('scripts/polish-allure-presentation.cjs', dir);
    run('scripts/structure-allure-business-view.cjs', dir, envForBuild());

    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(result.status, 'skipped');
    for (const parameter of result.parameters.filter((item) => ['Market', 'Environment', 'Project', 'Runtime Status', 'SKU', 'Store', 'User Type'].includes(item.name))) {
      assert.equal(parameter.mode, 'hidden');
      assert.equal(parameter.excluded, true);
    }

    assert.match(result.description, /^! BLOCKED · SAM-24807/m);
    assert.match(result.descriptionHtml, /BLOCKED/);
    assert.match(result.descriptionHtml, /O que foi validado/);
    assert.match(result.descriptionHtml, /Resultado esperado/);
    assert.match(result.descriptionHtml, /Resultado observado/);
    assert.match(result.descriptionHtml, /Pré-requisito \/ desbloqueio/);
    assert.match(result.descriptionHtml, /Contexto da execução/);
    assert.match(result.descriptionHtml, /Links e evidências/);

    const names = result.steps.map((step) => step.name);
    assert.deepEqual(names.slice(0, 5), [
      '01 · O que foi validado',
      '02 · Resultado esperado',
      '03 · Resultado observado',
      '04 · Pré-requisito / desbloqueio',
      '05 · Contexto da execução',
    ]);
    assert.match(names.at(-1), /Execução do negócio/);
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
      description: '**Objective:** Validate cart persistence after logout.\n**Expected result:** Cart remains available.\n**Observed:** Product was not found after logout.',
    }), null, 2));

    run('scripts/dedupe-allure-evidence.cjs', dir);
    run('scripts/polish-allure-presentation.cjs', dir);
    run('scripts/structure-allure-business-view.cjs', dir, envForBuild());

    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(result.status, 'skipped');
    assert.equal(result.parameters.find((item) => item.name === 'Runtime Status').value, 'FAIL');
    assert.equal(result.parameters.find((item) => item.name === 'Known Defect').value, 'RT-752445');
    assert.match(result.description, /^◆ KNOWN DEFECT · SAM-24896/m);
    assert.match(result.description, /Defeito conhecido: RT-752445/);
    assert.match(result.descriptionHtml, /KNOWN DEFECT/);
    assert.match(result.descriptionHtml, /RT-752445/);
    assert.match(result.descriptionHtml, /Resultado observado/);
    assert.ok(result.steps.some((step) => /Known Defect · RT-752445/.test(step.name)));
    assert.ok(result.steps.filter((step) => /Resultado observado|Known Defect|Execução do negócio/.test(step.name)).every((step) => step.status === 'skipped'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('business view rebuilds readable Jira links and stable Jenkins evidence fallback', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-stable-links-'));
  try {
    const file = path.join(dir, 'known-result.json');
    fs.writeFileSync(file, JSON.stringify(fixture({
      name: 'SAM-24896 · Cart value when Reg user logs out',
      fullName: 'CO S2 SAM-24896',
      links: [
        { name: 'SAM-24896', url: 'broken-relative-link', type: 'issue' },
        { name: 'RT-752445', url: 'http://invalid.local/static-files/token', type: 'issue' },
      ],
      parameters: [
        { name: 'Market', value: 'CO' },
        { name: 'Environment', value: 'S2 / STG2' },
        { name: 'Store', value: 'Base Store' },
        { name: 'Runtime Status', value: 'FAIL' },
        { name: 'Known Defect', value: 'RT-752445' },
        { name: 'Known Defect Title', value: 'CO S2 Cart Items Are Lost After Registered User Logout' },
      ],
    }), null, 2));

    run('scripts/structure-allure-business-view.cjs', dir, envForBuild());

    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(result.links.map((link) => link.name), [
      'Official TC · SAM-24896',
      'Known Defect · RT-752445',
      'Jenkins Build · #999',
      'Jenkins Artifacts · Evidence',
    ]);
    assert.equal(result.links[0].url, 'https://jira.secext.samsung.net/browse/SAM-24896');
    assert.equal(result.links[1].url, 'https://jira.secext.samsung.net/browse/RT-752445');
    assert.equal(result.links[2].url, 'http://127.0.0.1:8080/job/SAMSUNG-SMB-AUTOMATION/999/');
    assert.equal(result.links[3].url, 'http://127.0.0.1:8080/job/SAMSUNG-SMB-AUTOMATION/999/artifact/test-results/jenkins/co-qst/');
    assert.ok(result.links.every((link) => !/static-files/.test(link.url)));
    assert.match(result.descriptionHtml, /Official TC · SAM-24896/);
    assert.match(result.descriptionHtml, /Jenkins Artifacts · Evidence/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('final HTML template is status-aware for PASS FAIL BLOCKED and KNOWN DEFECT across regional runtime data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-status-template-'));
  try {
    const cases = [
      ['pass', fixture({
        uuid: 'pass', name: 'SAM-30001 · Regional PASS', fullName: 'MX S1 SAM-30001', status: 'passed',
        statusDetails: {},
        description: '**Objective:** Validate a passing business flow.\n**Expected result:** The flow succeeds.\n**Observed:** All assertions passed.',
        parameters: [
          { name: 'Market', value: 'MX' }, { name: 'Environment', value: 'S1 / STG' },
          { name: 'Runtime Status', value: 'PASS' }, { name: 'Store', value: 'Base Store' },
        ],
      }), 'PASS'],
      ['fail', fixture({
        uuid: 'fail', name: 'SAM-30002 · Regional FAIL', fullName: 'PE S2 SAM-30002', status: 'failed',
        description: '**Objective:** Validate a failing business flow.\n**Expected result:** Expected value remains visible.\n**Observed:** Expected value was missing.',
        parameters: [
          { name: 'Market', value: 'PE' }, { name: 'Environment', value: 'S2 / STG2' },
          { name: 'Runtime Status', value: 'FAIL' }, { name: 'Store', value: 'Base Store' },
        ],
      }), 'FAIL'],
      ['blocked', fixture({ uuid: 'blocked', name: 'SAM-30003 · Regional BLOCKED', fullName: 'CL S1 SAM-30003' }), 'BLOCKED'],
    ];

    for (const [filename, data] of cases) fs.writeFileSync(path.join(dir, `${filename}-result.json`), JSON.stringify(data, null, 2));
    run('scripts/normalize-allure-business-status.cjs', dir);
    run('scripts/polish-allure-presentation.cjs', dir);
    run('scripts/structure-allure-business-view.cjs', dir, envForBuild());

    for (const [filename, , expectedStatus] of cases) {
      const result = JSON.parse(fs.readFileSync(path.join(dir, `${filename}-result.json`), 'utf8'));
      assert.match(result.descriptionHtml, new RegExp(`>${expectedStatus}<`));
      assert.match(result.descriptionHtml, /O que foi validado/);
      assert.match(result.descriptionHtml, /Resultado esperado/);
      assert.match(result.descriptionHtml, /Resultado observado/);
      assert.match(result.descriptionHtml, /Contexto da execução/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
