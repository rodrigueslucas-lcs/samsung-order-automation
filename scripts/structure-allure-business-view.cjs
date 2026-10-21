const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
if (!fs.existsSync(resultsDir)) {
  console.log('[allure-business-view] Results directory does not exist; nothing to structure.');
  process.exit(0);
}

function clean(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

function parameter(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || '';
}

function samId(result) {
  return `${result.name || ''} ${result.fullName || ''}`.match(/SAM-\d+/)?.[0] || '';
}

function runtimeStatus(result) {
  const explicit = clean(parameter(result, 'Runtime Status')).toUpperCase();
  if (/BLOCKED|SKIPPED/.test(explicit)) return 'BLOCKED';
  if (/PASS/.test(explicit)) return 'PASS';
  if (/FAIL|TIMEDOUT|INTERRUPTED|UNEXPECTED/.test(explicit)) return 'FAIL';
  const status = clean(result.status).toLowerCase();
  if (status === 'passed') return 'PASS';
  if (status === 'skipped') return 'BLOCKED';
  if (['failed', 'broken', 'unknown'].includes(status)) return 'FAIL';
  return 'NOT RUN';
}

function readField(description, labels) {
  const source = String(description || '');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`^${escaped}:\\s*(.+)$`, 'im'),
      new RegExp(`\\*\\*${escaped}:?\\*\\*\\s*(.+)$`, 'im'),
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return clean(match[1]);
    }
  }
  return '';
}

function child(name, status = 'passed') {
  return {
    name: clean(name),
    status,
    stage: 'finished',
    steps: [],
    attachments: [],
    parameters: [],
    statusDetails: {},
  };
}

function section(name, children, status = 'passed') {
  return {
    name,
    status,
    stage: 'finished',
    steps: children.filter((item) => item && clean(item.name)),
    attachments: [],
    parameters: [],
    statusDetails: {},
  };
}

function hideNoisyParameters(result) {
  // All of these values stay in result JSON and are repeated in the structured
  // business sections below. Hidden mode prevents Allure from appending the whole
  // technical parameter list to every row in Suites/Categories.
  const hide = new Set([
    'Environment', 'Market', 'Project', 'Runtime Status', 'Technical Result',
    'SKU', 'Store', 'User Type', 'Feature', 'Payment', 'Order ID', 'Coverage',
    'Known Defect', 'Known Defect Title',
  ]);
  result.parameters = (result.parameters || []).map((item) =>
    hide.has(String(item?.name || '')) ? { ...item, mode: 'hidden', excluded: true } : item
  );
}

function contextChildren(result) {
  return [
    ['Market', parameter(result, 'Market')],
    ['Environment', parameter(result, 'Environment')],
    ['Store', parameter(result, 'Store')],
    ['Feature', parameter(result, 'Feature')],
    ['User type', parameter(result, 'User Type')],
    ['SKU', parameter(result, 'SKU')],
    ['Payment', parameter(result, 'Payment')],
    ['Order ID', parameter(result, 'Order ID')],
    ['Runtime status', parameter(result, 'Runtime Status')],
  ].filter(([, value]) => clean(value)).map(([label, value]) => child(`${label} · ${clean(value)}`));
}

function businessStatusForStep(status) {
  return status === 'FAIL' ? 'failed' : status === 'BLOCKED' ? 'skipped' : 'passed';
}

let files = 0;
let structured = 0;
let hiddenParameters = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  const id = samId(result);
  if (!id) continue;

  const status = runtimeStatus(result);
  const defect = clean(parameter(result, 'Known Defect'));
  const defectTitle = clean(parameter(result, 'Known Defect Title'));
  const originalDescription = String(result.description || '');

  const objective = readField(originalDescription, ['Validated', 'Objective', 'Validation goal', 'O que foi validado'])
    || `Validate the official ${id} business scenario.`;
  const expected = readField(originalDescription, ['Expected', 'Expected result', 'Resultado esperado'])
    || 'The expected business acceptance criteria should be satisfied.';
  const observed = readField(originalDescription, ['Observed', 'Actual Result', 'Resultado observado'])
    || clean(result.statusDetails?.message || 'Execution completed without a curated business observation.').split('\n')[0];
  const prerequisite = readField(originalDescription, ['Prerequisite', 'Blocker', 'Pré-requisito / desbloqueio']);

  // Keep only the actual authored business execution steps; this script may run more
  // than once, so drop previous synthetic presentation sections before rebuilding.
  const actualSteps = (result.steps || []).filter((step) => {
    const stepName = clean(step?.name);
    return !/^(?:0[1-9]|1[0-9]) · /.test(stepName)
      && !/^Known Defect · /i.test(stepName)
      && !/^Business execution$/i.test(stepName);
  });

  hideNoisyParameters(result);
  hiddenParameters += (result.parameters || []).filter((item) => item?.mode === 'hidden').length;

  const sections = [];
  sections.push(section('01 · O que foi validado', [child(objective)]));
  sections.push(section('02 · Resultado esperado', [child(expected)]));
  sections.push(section('03 · Resultado observado', [child(observed, businessStatusForStep(status))], businessStatusForStep(status)));

  let next = 4;
  if (defect) {
    sections.push(section(
      `${String(next).padStart(2, '0')} · Known Defect · ${defect}`,
      [
        child(defectTitle || 'Mapped known functional defect.', 'skipped'),
        child(`Runtime preservado · ${status}`, 'skipped'),
      ],
      'skipped'
    ));
    next += 1;
  }

  if (status === 'BLOCKED') {
    sections.push(section(
      `${String(next).padStart(2, '0')} · Pré-requisito / desbloqueio`,
      [child(prerequisite || observed || 'A required prerequisite must be restored before conclusive validation.', 'skipped')],
      'skipped'
    ));
    next += 1;
  }

  const context = contextChildren(result);
  if (context.length) {
    sections.push(section(`${String(next).padStart(2, '0')} · Contexto da execução`, context));
    next += 1;
  }

  if (actualSteps.length) {
    sections.push({
      ...section(`${String(next).padStart(2, '0')} · Execução do negócio`, [], businessStatusForStep(status)),
      steps: actualSteps,
    });
  }

  result.steps = sections;

  // Description is intentionally short. All detailed business information is now
  // organized under Test body, where this Allure UI renders hierarchy reliably.
  const headline = defect
    ? `KNOWN DEFECT · ${defect}${defectTitle ? ` — ${defectTitle}` : ''}`
    : `${status} · ${id}`;
  result.description = `${headline}\n${objective}`;

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  files += 1;
  structured += 1;
}

console.log(`[allure-business-view] READY · ${structured} official TC(s) structured; ${hiddenParameters} repeated parameter field(s) hidden from suite rows.`);
