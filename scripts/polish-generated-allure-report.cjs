const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
const reportDir = path.resolve(process.argv[3] || process.env.ALLURE_REPORT_DIR || 'allure-report');
const testCasesDir = path.join(reportDir, 'data', 'test-cases');

function clean(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

function samId(value) {
  return clean(value).match(/SAM-\d+/i)?.[0]?.toUpperCase() || '';
}

function removeConsoleNoise(attachments) {
  if (!Array.isArray(attachments)) return 0;
  const before = attachments.length;
  const kept = attachments.filter((item) => !/^(stdout|stderr)$/i.test(clean(item?.name)));
  attachments.splice(0, attachments.length, ...kept);
  return before - kept.length;
}

function cleanSteps(steps) {
  let removed = 0;
  for (const step of steps || []) {
    removed += removeConsoleNoise(step.attachments);
    removed += cleanSteps(step.steps || []);
  }
  return removed;
}

if (!fs.existsSync(resultsDir) || !fs.existsSync(testCasesDir)) {
  console.log('[allure-generated-polish] Results/report data missing; nothing to polish.');
  process.exit(0);
}

const sourceById = new Map();
for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const result = JSON.parse(fs.readFileSync(path.join(resultsDir, name), 'utf8'));
  const id = samId(`${result.name || ''} ${result.fullName || ''}`);
  if (!id) continue;
  sourceById.set(id, result);
}

let polished = 0;
let consoleNoiseRemoved = 0;
let duplicateLinksRemoved = 0;
let missingHtml = 0;

for (const name of fs.readdirSync(testCasesDir).filter((file) => file.endsWith('.json'))) {
  const file = path.join(testCasesDir, name);
  const testCase = JSON.parse(fs.readFileSync(file, 'utf8'));
  const id = samId(`${testCase.name || ''} ${testCase.fullName || ''} ${(testCase.links || []).map((link) => link?.name || '').join(' ')}`);
  if (!id) continue;

  const source = sourceById.get(id);
  if (!source) continue;

  const richHtml = clean(source.descriptionHtml);
  if (richHtml) {
    testCase.descriptionHtml = source.descriptionHtml;
    delete testCase.description;
    // The rich Description already exposes Official TC / Known Defect /
    // Jenkins / artifacts as clickable links. Hide Allure's native duplicate
    // Links block in the published test-case view.
    duplicateLinksRemoved += Array.isArray(testCase.links) ? testCase.links.length : 0;
    testCase.links = [];
  } else {
    missingHtml += 1;
    testCase.description = source.description || testCase.description || '';
  }

  consoleNoiseRemoved += removeConsoleNoise(testCase.attachments);
  consoleNoiseRemoved += cleanSteps(testCase.steps || []);

  fs.writeFileSync(file, JSON.stringify(testCase));
  polished += 1;
}

console.log(`[allure-generated-polish] READY · ${polished} TC(s) polished in generated report · console-noise-removed=${consoleNoiseRemoved} · duplicate-links-removed=${duplicateLinksRemoved} · missing-rich-html=${missingHtml}.`);
if (missingHtml > 0) process.exitCode = 2;
