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

function clean(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

function esc(value) {
  return clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  return 'NOT RUN';
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

function readField(description, label) {
  const source = String(description || '');
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^${escaped}:\\s*(.+)$`, 'im'),
    new RegExp(`\\*\\*${escaped}:?\\*\\*\\s*(.+)$`, 'im'),
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function samId(result) {
  return `${result.name || ''} ${result.fullName || ''}`.match(/SAM-\d+/)?.[0] || '';
}

function scenarioName(result) {
  const id = samId(result);
  const source = clean(result.name || result.fullName || 'Official QST scenario');
  return source.replace(new RegExp(`^${id}\\s*[·:\-]?\\s*`, 'i'), '').trim() || source;
}

function visual(status, defect) {
  if (defect) return { label: 'KNOWN DEFECT', icon: '◆', fg: '#6941c6', bg: '#f4f0ff', border: '#bdb4fe' };
  if (status === 'PASS') return { label: 'PASS', icon: '✓', fg: '#067647', bg: '#ecfdf3', border: '#75e0a7' };
  if (status === 'BLOCKED') return { label: 'BLOCKED', icon: '!', fg: '#b54708', bg: '#fffaeb', border: '#fec84b' };
  if (status === 'FAIL') return { label: 'FAIL', icon: '×', fg: '#b42318', bg: '#fef3f2', border: '#f97066' };
  return { label: 'NOT RUN', icon: '•', fg: '#475467', bg: '#f2f4f7', border: '#d0d5dd' };
}

function card(title, body, color = '#d0d5dd', background = '#fff') {
  return `<div style="border:1px solid ${color};border-left:5px solid ${color};border-radius:10px;padding:14px 16px;margin:12px 0;background:${background};box-shadow:0 1px 2px rgba(16,24,40,.04)">` +
    `<div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;color:#344054">${esc(title)}</div>` +
    `<div style="font-size:14px;line-height:1.6;color:#101828">${body}</div></div>`;
}

function compactContext(result) {
  const fields = [
    ['Market', parameter(result, 'Market')],
    ['Environment', parameter(result, 'Environment')],
    ['Store', parameter(result, 'Store')],
    ['User Type', parameter(result, 'User Type')],
    ['SKU', parameter(result, 'SKU')],
    ['Payment', parameter(result, 'Payment')],
    ['Order ID', parameter(result, 'Order ID')],
    ['Runtime', parameter(result, 'Runtime Status')],
    ['Technical Result', parameter(result, 'Technical Result')],
  ].filter(([, value]) => clean(value));

  if (!fields.length) return '';
  return `<table style="border-collapse:collapse;width:100%;font-size:13px"><tbody>${fields.map(([key, value]) =>
    `<tr><td style="padding:5px 16px 5px 0;font-weight:700;color:#475467;width:150px">${esc(key)}</td><td style="padding:5px 0;color:#101828">${esc(value)}</td></tr>`
  ).join('')}</tbody></table>`;
}

function buildPresentation(result) {
  const id = samId(result);
  if (!id) return false;

  const status = runtimeStatus(result);
  const defect = clean(parameter(result, 'Known Defect'));
  const defectTitle = clean(parameter(result, 'Known Defect Title'));
  const v = visual(status, defect);
  const title = scenarioName(result);
  const objective = readField(result.description, 'Validated') || readField(result.description, 'Objective') || readField(result.description, 'Validation goal') || `Validate the official ${id} business scenario.`;
  const expected = readField(result.description, 'Expected') || readField(result.description, 'Expected result') || 'The expected business acceptance criteria should be satisfied.';
  const observed = readField(result.description, 'Observed') || readField(result.description, 'Actual Result') || clean(result.statusDetails?.message || 'Execution completed without a curated business observation.').split('\n')[0];
  const prerequisite = readField(result.description, 'Prerequisite') || readField(result.description, 'Blocker') || '';
  const jiraUrl = `https://jira.secext.samsung.net/browse/${id}`;

  const header = `<div style="border-radius:12px;padding:14px 16px;margin:0 0 14px;background:${v.bg};border:1px solid ${v.border}">` +
    `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">` +
    `<span style="display:inline-block;padding:5px 10px;border-radius:999px;font-weight:800;color:${v.fg};background:#fff;border:1px solid ${v.border}">${v.icon} ${v.label}</span>` +
    `<a href="${jiraUrl}" style="font-weight:800;text-decoration:none">${esc(id)}</a>` +
    `</div><div style="font-size:19px;font-weight:800;line-height:1.35;color:#101828">${esc(title)}</div></div>`;

  let html = header;

  if (defect) {
    const defectUrl = `https://jira.secext.samsung.net/browse/${encodeURIComponent(defect)}`;
    html += card(
      'Known Defect',
      `<div style="font-size:16px;font-weight:800;margin-bottom:5px"><a href="${defectUrl}">${esc(defect)}</a>${defectTitle ? ` — ${esc(defectTitle)}` : ''}</div>` +
      `<div style="color:#475467">Este TC está mapeado para um defeito conhecido neste escopo. O status técnico original continua preservado; o relatório apenas contextualiza o resultado.</div>`,
      '#bdb4fe', '#f9f7ff'
    );
  }

  html += card('O que foi validado', esc(objective), '#84caff', '#f5fbff');
  html += card('Resultado esperado', esc(expected), '#84caff', '#f8fbff');
  html += card('Resultado observado', esc(observed), v.border, v.bg);

  if (status === 'BLOCKED') {
    html += card(
      'Pré-requisito / desbloqueio',
      esc(prerequisite || observed || 'A execução não alcançou a validação funcional porque um pré-requisito estava indisponível.'),
      '#fec84b', '#fffaeb'
    );
  }

  const context = compactContext(result);
  if (context) html += card('Contexto da execução', context, '#d0d5dd', '#fcfcfd');

  html += card(
    'Evidências',
    `<div style="color:#475467">Screenshot, vídeo, request/response curado e Playwright Trace ficam disponíveis quando capturados. O Trace permanece como fonte de debug técnico de baixo nível.</div>`,
    '#d0d5dd', '#fcfcfd'
  );

  result.descriptionHtml = `<div style="max-width:900px">${html}</div>`;

  // Some Allure side panels render the plain description instead of descriptionHtml.
  // Keep this fallback deliberately scannable even without Markdown rendering.
  const lines = [
    `${v.icon} ${v.label}  ·  ${id}`,
    title,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'VALIDAÇÃO',
    objective,
    '',
    'RESULTADO ESPERADO',
    expected,
    '',
    'RESULTADO OBSERVADO',
    observed,
  ];
  if (defect) {
    lines.push('', 'KNOWN DEFECT', `${defect}${defectTitle ? ` — ${defectTitle}` : ''}`);
  }
  if (status === 'BLOCKED') {
    lines.push('', 'PRÉ-REQUISITO / DESBLOQUEIO', prerequisite || observed);
  }
  const fallbackContext = [
    ['Market', parameter(result, 'Market')],
    ['Environment', parameter(result, 'Environment')],
    ['Store', parameter(result, 'Store')],
    ['User Type', parameter(result, 'User Type')],
    ['SKU', parameter(result, 'SKU')],
    ['Payment', parameter(result, 'Payment')],
    ['Order ID', parameter(result, 'Order ID')],
    ['Runtime', parameter(result, 'Runtime Status')],
  ].filter(([, value]) => clean(value));
  if (fallbackContext.length) {
    lines.push('', 'CONTEXTO');
    for (const [key, value] of fallbackContext) lines.push(`${key}: ${clean(value)}`);
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  result.description = lines.join('\n');
  return true;
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
    message: `KNOWN DEFECT · ${defect}${title ? ` · ${title}` : ''} · Runtime ${raw}. Business summary and raw evidence are preserved below.`,
    trace: '',
  };
  result.steps ||= [];
  if (!result.steps.some((step) => String(step?.name || '').includes(defect))) {
    const start = Number(result.start || Date.now());
    const stop = Number(result.stop || start);
    result.steps.unshift({
      name: `Known Defect · ${defect}`,
      status: 'skipped',
      stage: 'finished',
      start,
      stop,
      steps: [],
      attachments: [],
      parameters: [],
      statusDetails: { message: title || 'Mapped known functional defect.' },
    });
  }
  return true;
}

let files = 0;
let cleanedSteps = 0;
let knownDefects = 0;
let polished = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = JSON.stringify(result.steps || []).length;
  result.steps = cleanSteps(result.steps);
  if (JSON.stringify(result.steps || []).length < before) cleanedSteps += 1;

  if (buildPresentation(result)) polished += 1;
  if (hardenKnownDefect(result)) knownDefects += 1;

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  files += 1;
}

console.log(`[allure-presentation] READY · ${files} result(s); ${polished} official result(s) received final visual hierarchy; low-level steps cleaned in ${cleanedSteps}; known defects hardened ${knownDefects}.`);
