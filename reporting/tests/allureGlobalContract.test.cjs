const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const structureScript = path.resolve('scripts/structure-allure-business-view.cjs');
const contractScript = path.resolve('scripts/enforce-allure-global-contract.cjs');
const generatedPolishScript = path.resolve('scripts/polish-generated-allure-report.cjs');

function writeResult(dir, name, result) {
  fs.writeFileSync(path.join(dir, `${name}-result.json`), JSON.stringify(result, null, 2));
}

function resultFor({ market, environment, state, index }) {
  const id = `SAM-${30000 + index}`;
  const defect = state === 'KNOWN_DEFECT' ? `RT-${900000 + index}` : '';
  const runtime = state === 'KNOWN_DEFECT' ? 'FAIL' : state;
  const status = state === 'PASS' ? 'passed' : state === 'BLOCKED' ? 'skipped' : 'failed';
  return {
    uuid: `${market}-${environment}-${state}`,
    name: `${id} · Contract scenario ${index}`,
    fullName: `markets/${market.toLowerCase()}/qst/base-store/official-p1.spec.js ${id}`,
    status,
    stage: 'finished',
    statusDetails: {
      message: state === 'BLOCKED'
        ? 'BLOCKED · required authentication prerequisite unavailable.'
        : state === 'FAIL' || state === 'KNOWN_DEFECT'
          ? 'FAIL · Expected business state was not reached.'
          : 'PASS · Criteria satisfied.',
    },
    parameters: [
      { name: 'Market', value: market },
      { name: 'Environment', value: environment === 'S2' ? 'S2 / STG2' : 'S1 / STG' },
      { name: 'Store', value: 'Base Store' },
      { name: 'User Type', value: 'Guest' },
      { name: 'Runtime Status', value: runtime },
      ...(defect ? [
        { name: 'Known Defect', value: defect },
        { name: 'Known Defect Title', value: 'Mapped contract defect' },
      ] : []),
    ],
    labels: [
      { name: 'parentSuite', value: market === 'PE' ? 'PE · Authenticated first' : 'legacy hierarchy' },
      { name: 'suite', value: 'legacy suite' },
      { name: 'subSuite', value: 'legacy subgroup' },
    ],
    description: [
      '**Objective:** Validate the official business scenario.',
      '**Expected result:** The expected business result should be satisfied.',
      '**Resultado observado:** Runtime observation for the scenario.',
    ].join('\n'),
    steps: [],
    attachments: [
      { name: 'stdout', source: 'stdout.txt', type: 'text/plain' },
      { name: 'Screenshot · Estado final', source: 'final.png', type: 'image/png' },
    ],
    links: [],
  };
}

test('global Allure contract is identical for MX/PE/CO/CL in S1/S2 and all business statuses', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-global-contract-'));
  try {
    const markets = ['MX', 'PE', 'CO', 'CL'];
    const environments = ['S1', 'S2'];
    const states = ['PASS', 'FAIL', 'BLOCKED', 'KNOWN_DEFECT'];
    let index = 1;

    for (const market of markets) {
      for (const environment of environments) {
        for (const state of states) {
          writeResult(dir, `${market}-${environment}-${state}`, resultFor({ market, environment, state, index }));
          index += 1;
        }
      }
    }

    const structured = spawnSync(process.execPath, [structureScript, dir], {
      encoding: 'utf8',
      env: { ...process.env, BUILD_NUMBER: '999' },
    });
    assert.equal(structured.status, 0, structured.stderr || structured.stdout);

    const enforced = spawnSync(process.execPath, [contractScript, dir], { encoding: 'utf8' });
    assert.equal(enforced.status, 0, enforced.stderr || enforced.stdout);

    for (const market of markets) {
      for (const environment of environments) {
        for (const state of states) {
          const result = JSON.parse(fs.readFileSync(path.join(dir, `${market}-${environment}-${state}-result.json`), 'utf8'));
          const labels = Object.fromEntries((result.labels || []).filter((item) => ['parentSuite', 'suite', 'subSuite'].includes(item.name)).map((item) => [item.name, item.value]));

          assert.equal(labels.parentSuite, `${market} · ${environment === 'S2' ? 'S2 / STG2' : 'S1 / STG'}`);
          assert.equal(labels.suite, 'Base Store · P1/QST');
          assert.equal(labels.subSuite, `${market} QST · Base Store Official P1`);

          assert.match(result.descriptionHtml, /font-weight:800/i);
          assert.match(result.descriptionHtml, /O que foi validado/i);
          assert.match(result.descriptionHtml, /Resultado esperado/i);
          assert.match(result.descriptionHtml, /Resultado observado/i);
          assert.match(result.descriptionHtml, /Contexto da execução/i);
          assert.match(result.descriptionHtml, new RegExp(`Contract scenario`, 'i'));
          assert.doesNotMatch(result.descriptionHtml, /Validate the official SAM-\d+ business scenario/i);
          assert.doesNotMatch(result.descriptionHtml, /expected business acceptance criteria should be satisfied/i);

          assert.match(result.description, /^## [🟢🔴🟡🟣⚪]/u);
          assert.match(result.description, /### \*\*O que foi validado\*\*/i);
          assert.match(result.description, /### \*\*Contexto da execução\*\*/i);
          assert.equal((result.attachments || []).some((item) => /^(stdout|stderr)$/i.test(item.name || '')), false);
          assert.equal((result.attachments || []).some((item) => /Screenshot · Estado final/i.test(item.name || '')), true);

          if (state === 'PASS') {
            assert.equal(result.status, 'passed');
            assert.match(result.description, /🟢 \*\*PASS\*\*/u);
          } else if (state === 'FAIL') {
            assert.equal(result.status, 'failed');
            assert.match(result.description, /🔴 \*\*FAIL\*\*/u);
          } else if (state === 'BLOCKED') {
            assert.equal(result.status, 'broken');
            assert.match(result.description, /🟡 \*\*BLOCKED\*\*/u);
          } else {
            assert.equal(result.status, 'unknown');
            assert.match(result.description, /🟣 \*\*KNOWN DEFECT\*\*/u);
            assert.match(result.descriptionHtml, /Known Defect/i);
          }
        }
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('generated Allure test-case JSON is forced to rich HTML and console noise is removed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-generated-contract-'));
  const resultsDir = path.join(root, 'allure-results');
  const reportDir = path.join(root, 'allure-report');
  const testCasesDir = path.join(reportDir, 'data', 'test-cases');
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.mkdirSync(testCasesDir, { recursive: true });

  try {
    const source = resultFor({ market: 'MX', environment: 'S2', state: 'PASS', index: 77 });
    writeResult(resultsDir, 'source', source);
    const structured = spawnSync(process.execPath, [structureScript, resultsDir], { encoding: 'utf8' });
    assert.equal(structured.status, 0, structured.stderr || structured.stdout);
    const enforced = spawnSync(process.execPath, [contractScript, resultsDir], { encoding: 'utf8' });
    assert.equal(enforced.status, 0, enforced.stderr || enforced.stdout);

    fs.writeFileSync(path.join(testCasesDir, 'generated.json'), JSON.stringify({
      name: 'SAM-30077 · Contract scenario 77',
      fullName: 'markets/mx/qst/base-store/official-p1.spec.js SAM-30077',
      description: 'OLD PLAIN DESCRIPTION',
      attachments: [{ name: 'stdout', source: 'x.txt' }, { name: 'Screenshot · Estado final', source: 'final.png' }],
      steps: [],
    }));

    const polished = spawnSync(process.execPath, [generatedPolishScript, resultsDir, reportDir], { encoding: 'utf8' });
    assert.equal(polished.status, 0, polished.stderr || polished.stdout);

    const generated = JSON.parse(fs.readFileSync(path.join(testCasesDir, 'generated.json'), 'utf8'));
    assert.equal(Object.hasOwn(generated, 'description'), false);
    assert.match(generated.descriptionHtml, /Contract scenario 77/i);
    assert.match(generated.descriptionHtml, /O que foi validado/i);
    assert.equal(generated.attachments.some((item) => /^(stdout|stderr)$/i.test(item.name || '')), false);
    assert.equal(generated.attachments.some((item) => /Screenshot · Estado final/i.test(item.name || '')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
