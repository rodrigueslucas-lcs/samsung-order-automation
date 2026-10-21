const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
if (!fs.existsSync(resultsDir)) {
  console.log('[allure-presentation] Results directory does not exist; nothing to polish.');
  process.exit(0);
}

const LOW_LEVEL_STEP = /^(?:before hooks?|after hooks?|locator|expect\b|wait\b|wait for\b|waitfor\b|page\.|browser\.|context\.|fixture|query count|evaluate|attach|api\b|click\b|fill\b|type\b|blur\b|press\b|scroll\b|scroll into view|screenshot\b|check\b|uncheck\b|hover\b|focus\b|reload\b|go back\b|go forward\b|select option\b|set input files\b|goto\b|dispatch event\b)/i;

function parameter(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || '';
}

function runtimeStatus(result) {
  const explicit = String(parameter(result, 'Runtime Status') || '').toUpperCase();
  if (/PASS/.test(explicit)) return 'PASS';
  if (/BLOCKED|SKIPPED/.test(explicit)) return 'BLOCKED';
  if (/FAIL|TIMEDOUT|INTERRUPTED|UNEXPECTED/.test(explicit)) return 'FAIL';
  const status = String(result.status || '').toLowerCase();
  if (status === 'passed') return 'PASS';
  if (status === 'skipped') return 'BLOCKED';
  if (['failed', 'broken', 'unknown'].includes(status)) return 'FAIL';
  return 'NOT_RUN';
}

function cleanSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step) => {
      const name = String(step?.name || '').trim();
      return name && !LOW_LEVEL_STEP.test(name);
    })
    .map((step) => ({ ...step, steps: cleanSteps(step.steps) }));
}

function hardenKnownDefect(result) {
  const defect = String(parameter(result, 'Known Defect') || '');
  if (!defect) return false;
  const raw = runtimeStatus(result);
  if (!['FAIL', 'BLOCKED'].includes(raw)) return false;
  const title = String(parameter(result, 'Known Defect Title') || '');
  result.status = 'skipped';
  result.stage = 'finished';
  result.statusDetails = {
    message: `Known Defect ${defect}${title ? ` · ${title}` : ''}. Raw runtime status: ${raw}. This exact-scope mapped result is non-gating; business evidence remains preserved.`,
    trace: '',
  };
  result.steps ||= [];
  if (!result.steps.some((step) => String(step?.name || '').includes(defect))) {
    const start = Number(result.start || Date.now());
    const stop = Number(result.stop || start);
    result.steps.unshift({
      name: `Known Defect · ${defect}${title ? ` · ${title}` : ''}`,
      status: 'skipped',
      stage: 'finished',
      start,
      stop,
      steps: [],
      attachments: [],
      parameters: [],
      statusDetails: {},
    });
  }
  return true;
}

let files = 0;
let cleanedSteps = 0;
let knownDefects = 0;
let missingBusinessHtml = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = JSON.stringify(result.steps || []).length;
  result.steps = cleanSteps(result.steps);
  if (JSON.stringify(result.steps || []).length < before) cleanedSteps += 1;

  // The global normalizer owns descriptionHtml. Never flatten/overwrite it here.
  if (!String(result.descriptionHtml || '').trim() && /SAM-\d+/.test(`${result.name || ''} ${result.fullName || ''}`)) {
    missingBusinessHtml += 1;
  }

  if (hardenKnownDefect(result)) knownDefects += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  files += 1;
}

if (missingBusinessHtml) {
  console.warn(`[allure-presentation] WARNING · ${missingBusinessHtml} official result(s) reached final polish without descriptionHtml.`);
}
console.log(`[allure-presentation] READY · ${files} result(s); low-level steps cleaned in ${cleanedSteps}; known defects hardened ${knownDefects}; business HTML preserved.`);
