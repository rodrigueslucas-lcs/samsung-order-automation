const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve('scripts/polish-allure-final.cjs');

function writeResult(dir, name, result, withScreenshot = false) {
  if (withScreenshot) fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from('fake-png'));
  fs.writeFileSync(path.join(dir, `${name}-result.json`), JSON.stringify(result, null, 2));
}

function baseResult(id, status, runtimeStatus, extra = {}) {
  const shot = extra.screenshotName || null;
  return {
    uuid: `${id}-${status}-${extra.market || 'PE'}-${extra.environment || 'S2'}`,
    name: `${id} · Scenario ${id}`,
    fullName: `${id} official scenario`,
    status,
    stage: 'finished',
    parameters: [
      { name: 'Market', value: extra.market || 'PE' },
      { name: 'Environment', value: extra.environment || 'S2 / STG2' },
      { name: 'Store', value: 'Base Store' },
      { name: 'Runtime Status', value: runtimeStatus },
      ...(extra.parameters || []),
    ],
    description: [
      `**Objective:** Validate ${id} business behavior.`,
      `**Expected result:** Expected ${id} result.`,
    ].join('\n'),
    statusDetails: { message: extra.message || '' },
    attachments: [],
    steps: shot ? [{
      name: 'screenshot',
      status: 'passed',
      attachments: [{ name: 'screenshot', source: `${shot}.png`, type: 'image/png' }],
      steps: [],
    }] : (extra.steps || []),
    labels: [],
    links: [],
  };
}

function runPolish(dir) {
  const evidence = spawnSync(process.execPath, [script, dir, 'evidence'], { encoding: 'utf8' });
  assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout);
  const final = spawnSync(process.execPath, [script, dir, 'final'], { encoding: 'utf8' });
  assert.equal(final.status, 0, final.stderr || final.stdout);
}

function read(dir, name) {
  return JSON.parse(fs.readFileSync(path.join(dir, `${name}-result.json`), 'utf8'));
}

test('final polish enforces HTML-only status presentation and promoted screenshot globally', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-final-polish-'));
  try {
    writeResult(dir, 'pass', baseResult('SAM-10001', 'passed', 'PASS'));
    writeResult(dir, 'fail', baseResult('SAM-10002', 'failed', 'FAIL', {
      message: 'Request failed with HTTP 500.',
      screenshotName: 'fail',
    }), true);
    writeResult(dir, 'blocked', baseResult('SAM-10003', 'skipped', 'BLOCKED', {
      message: 'Required authentication session unavailable.',
    }));
    writeResult(dir, 'defect', baseResult('SAM-10004', 'failed', 'FAIL', {
      parameters: [
        { name: 'Known Defect', value: 'RT-999999' },
        { name: 'Known Defect Title', value: 'Mapped checkout defect' },
      ],
      message: 'Known mapped runtime failure.',
    }));

    runPolish(dir);

    const pass = read(dir, 'pass');
    const fail = read(dir, 'fail');
    const blocked = read(dir, 'blocked');
    const defect = read(dir, 'defect');

    assert.equal(pass.status, 'passed');
    assert.equal(fail.status, 'failed');
    assert.equal(blocked.status, 'broken');
    assert.equal(defect.status, 'unknown');

    for (const result of [pass, fail, blocked, defect]) {
      assert.equal(Object.hasOwn(result, 'description'), false);
      assert.ok(result.descriptionHtml);
      assert.match(result.descriptionHtml, /O que foi validado/i);
      assert.match(result.descriptionHtml, /Resultado esperado/i);
      assert.match(result.descriptionHtml, /Resultado observado/i);
      assert.match(result.descriptionHtml, /Contexto da execução/i);
      assert.match(result.descriptionHtml, /Links e evidências/i);
      assert.equal(result.parameters.find((item) => item.name === 'Market')?.mode, 'hidden');
      assert.equal(result.parameters.find((item) => item.name === 'Environment')?.mode, 'hidden');
      assert.equal(result.parameters.find((item) => item.name === 'Runtime Status')?.mode, 'hidden');
    }

    assert.match(pass.descriptionHtml, /#ECFDF3/i);
    assert.match(fail.descriptionHtml, /#FEF3F2/i);
    assert.match(fail.descriptionHtml, /HTTP 500/i);
    assert.match(blocked.descriptionHtml, /#FFFAEB/i);
    assert.match(blocked.descriptionHtml, /Pré-requisito \/ desbloqueio/i);
    assert.match(defect.descriptionHtml, /#F4F0FF/i);
    assert.match(defect.descriptionHtml, /Known Defect/i);
    assert.match(defect.descriptionHtml, /RT-999999/);
    assert.equal(defect.parameters.find((item) => item.name === 'Known Defect')?.mode, 'hidden');

    assert.equal(fail.attachments[0].name, 'Screenshot · Estado final');
    assert.match(fail.descriptionHtml, /Screenshot/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('final visual contract is identical for MX PE CO CL in S1 and S2', () => {
  const markets = ['MX', 'PE', 'CO', 'CL'];
  const environments = [
    ['S1', 'S1 / STG'],
    ['S2', 'S2 / STG2'],
  ];
  const variants = [
    { key: 'pass', technical: 'passed', runtime: 'PASS', expectedStatus: 'passed', color: '#ECFDF3' },
    { key: 'fail', technical: 'failed', runtime: 'FAIL', expectedStatus: 'failed', color: '#FEF3F2', message: 'Request failed with HTTP 500.' },
    { key: 'blocked', technical: 'skipped', runtime: 'BLOCKED', expectedStatus: 'broken', color: '#FFFAEB', message: 'Required test data unavailable.' },
    {
      key: 'defect', technical: 'failed', runtime: 'FAIL', expectedStatus: 'unknown', color: '#F4F0FF',
      parameters: [
        { name: 'Known Defect', value: 'RT-888888' },
        { name: 'Known Defect Title', value: 'Mapped regional defect' },
      ],
      message: 'Known mapped failure.',
    },
  ];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-final-matrix-'));
  try {
    let sequence = 20000;
    const names = [];
    for (const market of markets) {
      for (const [envCode, envLabel] of environments) {
        for (const variant of variants) {
          sequence += 1;
          const id = `SAM-${sequence}`;
          const name = `${market}-${envCode}-${variant.key}`;
          names.push({ name, market, envCode, variant });
          writeResult(dir, name, baseResult(id, variant.technical, variant.runtime, {
            market,
            environment: envLabel,
            message: variant.message || '',
            parameters: variant.parameters || [],
            screenshotName: variant.key === 'fail' ? name : null,
          }), variant.key === 'fail');
        }
      }
    }

    runPolish(dir);

    for (const { name, market, envCode, variant } of names) {
      const result = read(dir, name);
      assert.equal(result.status, variant.expectedStatus, `${market} ${envCode} ${variant.key} status`);
      assert.equal(Object.hasOwn(result, 'description'), false, `${market} ${envCode} ${variant.key} plain description removed`);
      assert.match(result.descriptionHtml, new RegExp(variant.color, 'i'), `${market} ${envCode} ${variant.key} color`);
      assert.match(result.descriptionHtml, /O que foi validado/i);
      assert.match(result.descriptionHtml, /Resultado esperado/i);
      assert.match(result.descriptionHtml, /Resultado observado/i);
      assert.match(result.descriptionHtml, new RegExp(market, 'i'));
      assert.match(result.descriptionHtml, new RegExp(envCode, 'i'));
      if (variant.key === 'defect') {
        assert.match(result.descriptionHtml, /Known Defect/i);
        assert.match(result.descriptionHtml, /RT-888888/);
      }
      if (variant.key === 'blocked') assert.match(result.descriptionHtml, /Pré-requisito \/ desbloqueio/i);
      if (variant.key === 'fail') {
        assert.match(result.descriptionHtml, /HTTP 500/i);
        assert.equal(result.attachments.some((item) => item.name === 'Screenshot · Estado final'), true);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
