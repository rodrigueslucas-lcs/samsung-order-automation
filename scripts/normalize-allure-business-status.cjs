const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');

if (!fs.existsSync(resultsDir)) {
  console.log('[allure-status] Results directory does not exist; nothing to normalize.');
  process.exit(0);
}

function parameterValue(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || '';
}

function upsertParameter(result, name, value) {
  result.parameters ||= [];
  result.parameters = result.parameters.filter((item) => item?.name !== name);
  if (value !== undefined && value !== null && value !== '') {
    result.parameters.push({ name, value: String(value) });
  }
}

function addTag(result, value) {
  result.labels ||= [];
  if (!result.labels.some((label) => label?.name === 'tag' && label?.value === value)) {
    result.labels.push({ name: 'tag', value });
  }
}

function clean(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

let processed = 0;
let blocked = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  processed += 1;

  const runtimeStatus = String(parameterValue(result, 'Runtime Status')).toUpperCase();
  if (!/BLOCKED|SKIPPED/.test(runtimeStatus)) continue;

  const technicalStatus = String(result.status || 'unknown').toUpperCase();
  const originalMessage = clean(result.statusDetails?.message || result.statusDetails?.trace || '');
  const knownDefect = parameterValue(result, 'Known Defect');

  upsertParameter(result, 'Technical Result', technicalStatus);
  addTag(result, 'blocked');

  // Allure has no native BLOCKED status. Represent business blockers as skipped,
  // while preserving the underlying Playwright result and diagnostic evidence.
  result.status = 'skipped';
  result.stage = 'finished';

  const reason = originalMessage
    ? originalMessage.split('\n')[0].slice(0, 700)
    : 'A required prerequisite was unavailable before the final business validation.';
  result.statusDetails = {
    message: knownDefect
      ? `Known Defect ${knownDefect} · BLOCKED prerequisite. Technical result: ${technicalStatus}. ${reason}`
      : `BLOCKED · prerequisite prevented the business validation. Technical result: ${technicalStatus}. ${reason}`,
    trace: '',
  };

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  blocked += 1;
}

console.log(`[allure-status] Processed ${processed} result(s); normalized ${blocked} business blocker(s) to Allure skipped while preserving Technical Result.`);
