const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');

if (!fs.existsSync(resultsDir)) {
  console.log('[allure-global-contract] Results directory does not exist; nothing to enforce.');
  process.exit(0);
}

function clean(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

function parameter(result, name) {
  return clean((result.parameters || []).find((item) => item?.name === name)?.value || '');
}

function upsertLabel(result, name, value) {
  result.labels ||= [];
  result.labels = result.labels.filter((label) => label?.name !== name);
  result.labels.push({ name, value });
}

function addTag(result, value) {
  result.labels ||= [];
  if (!result.labels.some((label) => label?.name === 'tag' && label?.value === value)) {
    result.labels.push({ name: 'tag', value });
  }
}

function marketOf(result) {
  const explicit = parameter(result, 'Market').toUpperCase();
  if (['MX', 'PE', 'CO', 'CL'].includes(explicit)) return explicit;
  const envMarket = clean(process.env.TEST_MARKET || process.env.MARKET).toUpperCase();
  if (['MX', 'PE', 'CO', 'CL'].includes(envMarket)) return envMarket;
  return `${result.fullName || ''} ${result.name || ''}`.match(/(?:^|[\\/\s])(MX|PE|CO|CL)(?:[\\/\s]|$)/i)?.[1]?.toUpperCase() || 'SMB';
}

function environmentOf(result) {
  const raw = parameter(result, 'Environment') || clean(
    process.env.MX_QST_ENVIRONMENT ||
    process.env.PE_QST_ENVIRONMENT ||
    process.env.CO_QST_ENVIRONMENT ||
    process.env.CL_QST_ENVIRONMENT ||
    process.env.ENVIRONMENT
  );
  if (/S2|STG2/i.test(raw)) return 'S2 / STG2';
  if (/S1|(?:^|\W)STG(?:$|\W)/i.test(raw)) return 'S1 / STG';
  return raw || 'Environment';
}

function storeOf(result) {
  const explicit = parameter(result, 'Store');
  if (/EPP/i.test(explicit)) return 'EPP';
  if (/business/i.test(explicit)) return 'Business Store';
  if (/base|BS/i.test(explicit)) return 'Base Store';
  const searchable = `${result.fullName || ''} ${(result.labels || []).map((item) => item?.value).join(' ')}`;
  if (/\bepp\b/i.test(searchable)) return 'EPP';
  if (/business[-_ ]?store/i.test(searchable)) return 'Business Store';
  return 'Base Store';
}

function knownDefect(result) {
  return parameter(result, 'Known Defect').match(/(?:RT|SAM)-\d+/i)?.[0]?.toUpperCase() || '';
}

function runtimeStatus(result) {
  const explicit = parameter(result, 'Runtime Status').toUpperCase();
  if (/BLOCKED|SKIPPED/.test(explicit)) return 'BLOCKED';
  if (/PASS/.test(explicit)) return 'PASS';
  if (/FAIL|TIMEDOUT|INTERRUPTED|UNEXPECTED/.test(explicit)) return 'FAIL';

  const technical = parameter(result, 'Technical Result').toUpperCase();
  if (/BLOCKED|SKIPPED/.test(technical)) return 'BLOCKED';
  if (/PASS/.test(technical)) return 'PASS';
  if (/FAIL|TIMEDOUT|INTERRUPTED|UNEXPECTED/.test(technical)) return 'FAIL';

  const status = clean(result.status).toLowerCase();
  if (status === 'passed') return 'PASS';
  if (status === 'skipped' || status === 'broken') return 'BLOCKED';
  if (status === 'failed') return 'FAIL';
  return 'NOT RUN';
}

function statusMessage(result, status, defect) {
  const title = clean((result.parameters || []).find((item) => item?.name === 'Known Defect Title')?.value || '');
  if (defect) return `KNOWN DEFECT · ${defect}${title ? ` · ${title}` : ''}`;
  if (status === 'PASS') return 'PASS · Critérios automatizados do cenário atendidos.';
  if (status === 'BLOCKED') return clean(result.statusDetails?.message || '').replace(/^BLOCKED\s*[·:-]?\s*/i, '') || 'BLOCKED · Pré-requisito necessário indisponível.';
  if (status === 'FAIL') return clean(result.statusDetails?.message || '').replace(/^FAIL\s*[·:-]?\s*/i, '') || 'FAIL · O comportamento observado não atendeu ao resultado esperado.';
  return clean(result.statusDetails?.message || '');
}

let processed = 0;
let htmlOnly = 0;
let suiteNormalized = 0;
const counts = { passed: 0, failed: 0, blocked: 0, defect: 0, other: 0 };

for (const fileName of fs.readdirSync(resultsDir).filter((name) => name.endsWith('-result.json'))) {
  const file = path.join(resultsDir, fileName);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!/SAM-\d+/.test(`${result.name || ''} ${result.fullName || ''}`)) continue;

  const market = marketOf(result);
  const environment = environmentOf(result);
  const store = storeOf(result);
  const defect = knownDefect(result);
  const status = runtimeStatus(result);

  upsertLabel(result, 'parentSuite', `${market} · ${environment}`);
  upsertLabel(result, 'suite', `${store} · P1/QST`);
  upsertLabel(result, 'subSuite', `${market} QST · ${store} Official P1`);
  suiteNormalized += 1;

  if (defect) {
    result.status = 'unknown';
    addTag(result, 'known-defect');
    counts.defect += 1;
  } else if (status === 'PASS') {
    result.status = 'passed';
    counts.passed += 1;
  } else if (status === 'BLOCKED') {
    result.status = 'broken';
    addTag(result, 'blocked');
    counts.blocked += 1;
  } else if (status === 'FAIL') {
    result.status = 'failed';
    counts.failed += 1;
  } else {
    counts.other += 1;
  }

  result.stage = 'finished';
  result.statusDetails ||= {};
  result.statusDetails.message = statusMessage(result, status, defect);
  if (defect || status === 'PASS') result.statusDetails.trace = '';

  if (clean(result.descriptionHtml)) {
    delete result.description;
    htmlOnly += 1;
  }

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  processed += 1;
}

console.log(
  `[allure-global-contract] READY · ${processed} official TC(s) · suites=${suiteNormalized} · html-only=${htmlOnly} · ` +
  `PASS=${counts.passed} FAIL=${counts.failed} BLOCKED=${counts.blocked} KNOWN_DEFECT=${counts.defect} OTHER=${counts.other}.`
);
