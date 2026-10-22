const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve('scripts/polish-allure-final.cjs');

function writeResult(dir, name, result, withScreenshot = false) {
  if (withScreenshot) fs.writeFileSync(path.join(dir, 'shot.png'), Buffer.from('fake-png'));
  fs.writeFileSync(path.join(dir, `${name}-result.json`), JSON.stringify(result, null, 2));
}

function baseResult(id, status, runtimeStatus, extra = {}) {
  return {
    uuid: `${id}-${status}`,
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
    steps: extra.steps || [],
    labels: [],
    links: [],
  };
}

test('final polish enforces status colors, readable description and promoted screenshot globally', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-final-polish-'));
  try {
    writeResult(dir, 'pass', baseResult('SAM-10001', 'passed', 'PASS'));
    writeResult(dir, 'fail', baseResult('SAM-10002', 'failed', 'FAIL', {
      message: 'Request failed with HTTP 500.',
      steps: [{
        name: 'screenshot',
        status: 'passed',
        attachments: [{ name: 'screenshot', source: 'shot.png', type: 'image/png' }],
        steps: [],
      }],
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

    const evidence = spawnSync(process.execPath, [script, dir, 'evidence'], { encoding: 'utf8' });
    assert.equal(evidence.status, 0, evidence.stderr || evidence.stdout);

    const failAfterEvidence = JSON.parse(fs.readFileSync(path.join(dir, 'fail-result.json'), 'utf8'));
    assert.equal(failAfterEvidence.attachments.length, 1);
    assert.equal(failAfterEvidence.attachments[0].name, 'Screenshot · Estado final');

    const final = spawnSync(process.execPath, [script, dir, 'final'], { encoding: 'utf8' });
    assert.equal(final.status, 0, final.stderr || final.stdout);

    const pass = JSON.parse(fs.readFileSync(path.join(dir, 'pass-result.json'), 'utf8'));
    const fail = JSON.parse(fs.readFileSync(path.join(dir, 'fail-result.json'), 'utf8'));
    const blocked = JSON.parse(fs.readFileSync(path.join(dir, 'blocked-result.json'), 'utf8'));
    const defect = JSON.parse(fs.readFileSync(path.join(dir, 'defect-result.json'), 'utf8'));

    assert.equal(pass.status, 'passed');
    assert.equal(fail.status, 'failed');
    assert.equal(blocked.status, 'broken');
    assert.equal(defect.status, 'unknown');

    assert.match(pass.description, /\*\*PASS · SAM-10001\*\*/);
    assert.match(fail.description, /\*\*Resultado observado\*\*/);
    assert.match(fail.description, /HTTP 500/i);
    assert.match(blocked.description, /\*\*Pré-requisito \/ desbloqueio\*\*/);
    assert.match(defect.description, /\*\*Known Defect\*\*/);
    assert.match(defect.description, /RT-999999/);

    assert.match(pass.descriptionHtml, /#ECFDF3/i);
    assert.match(fail.descriptionHtml, /#FEF3F2/i);
    assert.match(blocked.descriptionHtml, /#FFFAEB/i);
    assert.match(defect.descriptionHtml, /#F4F0FF/i);

    assert.equal(fail.attachments[0].name, 'Screenshot · Estado final');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
