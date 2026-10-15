const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getCoTestCard } = require('../../utils/coTestCard');

const fields = { NUMBER: 'number', HOLDER: 'holderName', EXPIRY: 'expiry', CVV: 'cvv', DOCUMENT: 'document' };
const synthetic = Object.fromEntries(Object.values(fields).map(key => [key, `sandbox-${key}`]));
const variables = prefix => Object.fromEntries(Object.entries(fields).map(([name, key]) => [`${prefix}_TEST_CARD_${name}`, synthetic[key]]));

test('CO S1 reads only its regional runtime fixture and supports CO-specific overrides', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'co-card-'));
  try {
    const file = path.join(dir, 'sandbox.json');
    fs.writeFileSync(file, JSON.stringify(synthetic));
    const env = { CO_QST_ENVIRONMENT: 'S1', CO_TEST_CARD_FILE: file };
    assert.deepEqual(getCoTestCard(env), synthetic);
    assert.equal(getCoTestCard({ ...env, CO_TEST_CARD_HOLDER: 'approved-sandbox' }).holderName, 'approved-sandbox');
    assert.throws(() => getCoTestCard({ ...env, CO_TEST_CARD_FILE: path.join(dir, 'absent.json'), ...variables('MX') }), /MX data is not a fallback/);
    assert.deepEqual(getCoTestCard({ ...env, CO_TEST_CARD_FILE: path.join(dir, 'absent.json'), ...variables('CO') }), synthetic);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CO S2 preserves the established MX runtime card selection', () => {
  assert.deepEqual(getCoTestCard({ CO_QST_ENVIRONMENT: 'S2', ...variables('MX') }), synthetic);
});

test('Jenkins provisions a separate CO S1 card and retains the S2 card', () => {
  const source = fs.readFileSync('Jenkinsfile', 'utf8');
  const co = source.slice(source.indexOf("} else if (params.MARKET == 'CO') {"), source.indexOf("} else if (params.MARKET == 'PE') {", source.indexOf("} else if (params.MARKET == 'CO') {")));
  assert.match(co, /CO_TEST_CARD_CREDENTIAL = params.ENVIRONMENT == 'S1' \? 'samsung-co-s1-test-card' : 'samsung-mx-test-card'/);
  assert.match(co, /CO_TEST_CARD_RUNTIME_FILE = params.ENVIRONMENT == 'S1' \? 'co-s1-test-card.json' : 'mx-test-card.json'/);
  assert.ok(co.includes("file(credentialsId: env.CO_TEST_CARD_CREDENTIAL, variable: 'CO_TEST_CARD_SECRET')"));
  assert.ok(co.includes('cp "$CO_TEST_CARD_SECRET" "playwright/.auth/${CO_TEST_CARD_RUNTIME_FILE}"'));
  assert.ok(co.includes('copy /Y "%CO_TEST_CARD_SECRET%" "playwright\\\\.auth\\\\%CO_TEST_CARD_RUNTIME_FILE%"'));
});
