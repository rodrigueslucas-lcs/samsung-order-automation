const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
if (!fs.existsSync(resultsDir)) {
  console.log('[allure-presentation] Results directory does not exist; nothing to polish.');
  process.exit(0);
}

const LOW_LEVEL_STEP = /^(?:before hooks?|after hooks?|locator|expect\b|wait for\b|waitfor\b|page\.|browser\.|context\.|fixture|query count|evaluate|attach|api\b|click\b|fill\b|type\b|blur\b|press\b|scroll\b|screenshot$|check$|uncheck$|hover$|focus$|reload$|go back$|go forward$|select option$|set input files$)/i;

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parameter(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || '';
}

function samId(result) {
  return `${result.name || ''} ${result.fullName || ''}`.match(/SAM-\d+/)?.[0] || '';
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

function section(description, heading) {
  const source = String(description || '');
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`### ${escaped}\\n([\\s\\S]*?)(?=\\n### |$)`, 'i'));
  return match?.[1]?.trim() || '';
}

function inlineField(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([^\\n]+)`, 'i'));
  return match?.[1]?.trim() || '';
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .trim();
}

function contextRows(result) {
  const fields = [
    ['Market', 'Market'], ['Environment', 'Environment'], ['Store', 'Store'],
    ['Feature', 'Feature'], ['User Type', 'User Type'], ['SKU', 'SKU'],
    ['Payment', 'Payment'], ['Order ID', 'Order ID'], ['Runtime Status', 'Runtime Status'],
    ['Coverage', 'Automation Coverage'],
  ];
  return fields
    .map(([name, label]) => [label, parameter(result, name)])
    .filter(([, value]) => value);
}

function tone(status, defect) {
  if (defect) return { fg: '#6941c6', bg: '#f4f3ff', border: '#c7b9ff', label: `KNOWN DEFECT · ${defect}` };
  if (status === 'PASS') return { fg: '#027a48', bg: '#ecfdf3', border: '#abefc6', label: 'PASS' };
  if (status === 'BLOCKED') return { fg: '#b54708', bg: '#fffaeb', border: '#fedf89', label: 'BLOCKED' };
  if (status === 'FAIL') return { fg: '#b42318', bg: '#fef3f2', border: '#fecdca', label: 'FAIL' };
  return { fg: '#475467', bg: '#f2f4f7', border: '#d0d5dd', label: 'NOT RUN' };
}

function renderHtml(result) {
  const description = String(result.description || '');
  const summary = section(description, 'Validation Summary');
  const expected = stripMarkdown(section(description, 'Expected Result'));
  const actual = stripMarkdown(section(description, 'Actual Result'));
  const blocker = stripMarkdown(section(description, 'Blocker / Prerequisite'));
  const technical = stripMarkdown(section(description, 'Technical Error'));
  const goal = stripMarkdown(inlineField(summary, 'Validation goal')) || 'Validate the official business scenario with auditable evidence.';
  const happened = stripMarkdown(inlineField(summary, 'What happened'));
  const status = runtimeStatus(result);
  const defect = String(parameter(result, 'Known Defect') || '');
  const defectTitle = String(parameter(result, 'Known Defect Title') || '');
  const palette = tone(status, defect);
  const tc = samId(result);
  const title = String(result.name || '').replace(/^SAM-\d+\s*[·:\-]?\s*/i, '').trim() || 'Official QST scenario';
  const rows = contextRows(result).map(([label, value]) => `
    <div style="padding:8px 10px;border-bottom:1px solid #eaecf0;display:grid;grid-template-columns:145px 1fr;gap:12px">
      <strong style="color:#344054">${esc(label)}</strong><span>${esc(value)}</span>
    </div>`).join('');

  const defectBlock = defect ? `
    <div style="margin-top:14px;padding:14px 16px;border:1px solid #c7b9ff;border-left:5px solid #7f56d9;border-radius:10px;background:#f9f5ff">
      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#6941c6;text-transform:uppercase">Known Defect</div>
      <div style="margin-top:6px;font-size:16px;font-weight:800;color:#42307d">${esc(defect)}${defectTitle ? ` · ${esc(defectTitle)}` : ''}</div>
      <div style="margin-top:5px;color:#53389e">Mapped only for this exact market / environment / store / TC scope. Raw runtime evidence remains preserved.</div>
    </div>` : '';

  const blockerBlock = status === 'BLOCKED' && blocker ? `
    <div style="margin-top:14px;padding:14px 16px;border:1px solid #fedf89;border-left:5px solid #f79009;border-radius:10px;background:#fffaeb">
      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#b54708;text-transform:uppercase">Blocker / Prerequisite</div>
      <div style="margin-top:6px;color:#7a2e0e">${esc(blocker)}</div>
    </div>` : '';

  const technicalBlock = status === 'FAIL' && technical ? `
    <details style="margin-top:14px;border:1px solid #fecdca;border-radius:10px;background:#fff">
      <summary style="cursor:pointer;padding:12px 14px;font-weight:800;color:#b42318">Technical Error · engineering detail</summary>
      <pre style="white-space:pre-wrap;margin:0;padding:14px;background:#101828;color:#f2f4f7;border-radius:0 0 10px 10px;font-size:12px;line-height:1.45">${esc(technical)}</pre>
    </details>` : '';

  return `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45;color:#101828;max-width:980px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:13px;font-weight:800;color:#175cd3">${esc(tc)}</div>
        <div style="font-size:22px;font-weight:800;margin-top:3px">${esc(title)}</div>
      </div>
      <span style="display:inline-block;padding:7px 11px;border-radius:999px;font-weight:800;font-size:12px;color:${palette.fg};background:${palette.bg};border:1px solid ${palette.border}">${esc(palette.label)}</span>
    </div>

    <div style="margin-top:18px;padding:16px 18px;border:1px solid #d0d5dd;border-radius:12px;background:#f9fafb">
      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#475467;text-transform:uppercase">Validation Summary</div>
      <div style="margin-top:7px"><strong>Validation goal:</strong> ${esc(goal)}</div>
      ${happened ? `<div style="margin-top:6px"><strong>What happened:</strong> ${esc(happened)}</div>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px;margin-top:12px">
      <div style="padding:14px 16px;border:1px solid #d0d5dd;border-radius:10px;background:#fff">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#475467;text-transform:uppercase">Expected Result</div>
        <div style="margin-top:7px">${esc(expected || 'Expected business acceptance criteria should be satisfied.')}</div>
      </div>
      <div style="padding:14px 16px;border:1px solid ${palette.border};border-radius:10px;background:${palette.bg}">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:${palette.fg};text-transform:uppercase">Actual Result</div>
        <div style="margin-top:7px;font-weight:650;color:${palette.fg}">${esc(actual || palette.label)}</div>
      </div>
    </div>

    ${defectBlock}
    ${blockerBlock}
    ${technicalBlock}

    <div style="margin-top:14px;border:1px solid #d0d5dd;border-radius:10px;overflow:hidden;background:#fff">
      <div style="padding:11px 12px;background:#f2f4f7;font-size:12px;font-weight:800;letter-spacing:.08em;color:#475467;text-transform:uppercase">Execution Context</div>
      ${rows || '<div style="padding:12px">No additional runtime parameters were published.</div>'}
    </div>

    <div style="margin-top:14px;padding:13px 15px;border-radius:10px;background:#eff8ff;border:1px solid #b2ddff;color:#1849a9">
      <strong>Evidence:</strong> business steps remain visible below. Screenshot, video, curated request/response evidence and Playwright Trace remain attached when captured.
    </div>
  </div>`;
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
    message: `KNOWN DEFECT ${defect}${title ? ` · ${title}` : ''}\nRaw runtime status: ${raw}. This result is non-gating only because the failure is mapped to the active Jira defect for this exact scope.`,
    trace: '',
  };
  result.steps ||= [];
  if (!result.steps.some((step) => String(step?.name || '').includes(defect))) {
    const start = Number(result.start || Date.now());
    const stop = Number(result.stop || start);
    result.steps.unshift({
      name: `Known Defect · ${defect}${title ? ` · ${title}` : ''}`,
      status: 'skipped', stage: 'finished', start, stop,
      steps: [], attachments: [], parameters: [], statusDetails: {},
    });
  }
  return true;
}

let files = 0;
let cleanedSteps = 0;
let knownDefects = 0;
for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = JSON.stringify(result.steps || []).length;
  result.steps = cleanSteps(result.steps);
  if (JSON.stringify(result.steps || []).length < before) cleanedSteps += 1;
  result.descriptionHtml = renderHtml(result);
  if (hardenKnownDefect(result)) knownDefects += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  files += 1;
}

console.log(`[allure-presentation] READY · ${files} result(s); low-level steps cleaned in ${cleanedSteps}; known defects hardened ${knownDefects}.`);
