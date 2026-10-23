const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
if (!fs.existsSync(resultsDir)) {
  console.log('[allure-business-view] Results directory does not exist; nothing to structure.');
  process.exit(0);
}

const buildUrl = String(process.env.BUILD_URL || '').trim();
const artifactDir = String(process.env.JENKINS_ARTIFACT_DIR || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
const buildNumber = String(process.env.BUILD_NUMBER || '').trim();
const jiraBase = 'https://jira.secext.samsung.net/browse/';

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

function parameter(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || '';
}

function samId(result) {
  return `${result.name || ''} ${result.fullName || ''}`.match(/SAM-\d+/)?.[0] || '';
}

function issueKey(value) {
  return clean(value).match(/(?:SAM|RT)-\d+/i)?.[0]?.toUpperCase() || '';
}

function jiraUrl(key) {
  const normalized = issueKey(key);
  return normalized ? `${jiraBase}${encodeURIComponent(normalized)}` : '';
}

function scenarioTitle(result) {
  const id = samId(result);
  return clean(result.name || result.fullName || id).replace(new RegExp(`^${id}\\s*[·:\\-]?\\s*`, 'i'), '').trim();
}

function runtimeStatus(result) {
  const explicit = clean(parameter(result, 'Runtime Status')).toUpperCase();
  if (/BLOCKED|SKIPPED/.test(explicit)) return 'BLOCKED';
  if (/PASS/.test(explicit)) return 'PASS';
  if (/FAIL|TIMEDOUT|INTERRUPTED|UNEXPECTED/.test(explicit)) return 'FAIL';
  const status = clean(result.status).toLowerCase();
  if (status === 'passed') return 'PASS';
  if (status === 'skipped' || status === 'broken') return 'BLOCKED';
  if (['failed', 'unknown'].includes(status)) return 'FAIL';
  return 'NOT RUN';
}

function readField(description, labels) {
  const source = String(description || '');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`^${escaped}:\\s*(.+)$`, 'im'),
      new RegExp(`\\*\\*${escaped}:?\\*\\*\\s*(.+)$`, 'im'),
      new RegExp(`^${escaped}\\s*\\n([^\\n]+)$`, 'im'),
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return clean(match[1]);
    }
  }
  return '';
}

function isGenericBusinessText(value) {
  const text = clean(value);
  return !text || /Validate the official SAM-\d+ business scenario/i.test(text) || /expected business acceptance criteria should be satisfied/i.test(text);
}

function humanizeTechnical(result) {
  const raw = clean(result.statusDetails?.message || result.statusDetails?.trace || '');
  if (!raw) return '';
  if (/HTTP\s*500/i.test(raw)) return 'O backend retornou HTTP 500 durante o fluxo e impediu a conclusão esperada do cenário.';
  if (/timeout|timed out|exceeded/i.test(raw)) return 'O cenário excedeu a janela controlada de espera antes de atingir o estado funcional esperado.';
  if (/authentication|session|credentials/i.test(raw)) return 'A execução não pôde continuar porque o pré-requisito de autenticação/sessão não estava disponível.';
  return raw.split('\n')[0].replace(/^Error:\s*/i, '').slice(0, 520);
}

function child(name, status = 'passed') {
  return { name: clean(name), status, stage: 'finished', steps: [], attachments: [], parameters: [], statusDetails: {} };
}

function section(name, children, status = 'passed') {
  return { name, status, stage: 'finished', steps: children.filter((item) => item && clean(item.name)), attachments: [], parameters: [], statusDetails: {} };
}

function hideNoisyParameters(result) {
  const hide = new Set(['Environment', 'Market', 'Project', 'Runtime Status', 'Technical Result', 'SKU', 'Store', 'User Type', 'Feature', 'Payment', 'Order ID', 'Coverage', 'Known Defect', 'Known Defect Title']);
  result.parameters = (result.parameters || []).map((item) => hide.has(String(item?.name || '')) ? { ...item, mode: 'hidden', excluded: true } : item);
}

function contextPairs(result) {
  return [
    ['Market', parameter(result, 'Market')],
    ['Environment', parameter(result, 'Environment')],
    ['Store', parameter(result, 'Store')],
    ['Feature', parameter(result, 'Feature')],
    ['User Type', parameter(result, 'User Type')],
    ['SKU', parameter(result, 'SKU')],
    ['Payment', parameter(result, 'Payment')],
    ['Order ID', parameter(result, 'Order ID')],
    ['Runtime Status', parameter(result, 'Runtime Status')],
    ['Technical Result', parameter(result, 'Technical Result')],
  ].filter(([, value]) => clean(value));
}

function contextChildren(result) {
  return contextPairs(result).map(([label, value]) => child(`${label} · ${clean(value)}`));
}

function businessStatusForStep(status, defect) {
  if (defect) return 'skipped';
  return status === 'FAIL' ? 'failed' : status === 'BLOCKED' ? 'skipped' : 'passed';
}

function stableArtifactsUrl() {
  if (!buildUrl || !artifactDir) return '';
  const prefix = buildUrl.endsWith('/') ? buildUrl : `${buildUrl}/`;
  return `${prefix}artifact/${artifactDir}/`;
}

function normalizeLinks(result, id, defect) {
  const links = [];
  const tcUrl = jiraUrl(id);
  const defectUrl = jiraUrl(defect);
  if (tcUrl) links.push({ name: `Official TC · ${issueKey(id)}`, url: tcUrl, type: 'tms' });
  if (defectUrl) links.push({ name: `Known Defect · ${issueKey(defect)}`, url: defectUrl, type: 'issue' });
  if (buildUrl) links.push({ name: `Jenkins Build${buildNumber ? ` · #${buildNumber}` : ''}`, url: buildUrl, type: 'link' });
  const artifactsUrl = stableArtifactsUrl();
  if (artifactsUrl) links.push({ name: 'Jenkins Artifacts · Evidence', url: artifactsUrl, type: 'link' });
  result.links = links;
}

function visual(status, defect) {
  if (defect) return { label: 'KNOWN DEFECT', icon: '◆', fg: '#7f56d9', bg: '#f4f0ff', border: '#bdb4fe' };
  if (status === 'PASS') return { label: 'PASS', icon: '✓', fg: '#067647', bg: '#ecfdf3', border: '#75e0a7' };
  if (status === 'BLOCKED') return { label: 'BLOCKED', icon: '!', fg: '#b54708', bg: '#fffaeb', border: '#fec84b' };
  if (status === 'FAIL') return { label: 'FAIL', icon: '×', fg: '#b42318', bg: '#fef3f2', border: '#f97066' };
  return { label: 'NOT RUN', icon: '•', fg: '#475467', bg: '#f2f4f7', border: '#d0d5dd' };
}

function htmlSection(title, body, accent, background = '#101828') {
  return `<div style="border:1px solid ${accent};border-left:5px solid ${accent};border-radius:10px;padding:14px 16px;margin:12px 0;background:${background};"><div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${accent};margin-bottom:7px">${esc(title)}</div><div style="font-size:14px;line-height:1.65;color:#f2f4f7">${body}</div></div>`;
}

function renderDescriptionHtml({ result, id, title, status, defect, defectTitle, objective, expected, observed, prerequisite }) {
  const v = visual(status, defect);
  const tcLink = jiraUrl(id);
  const defectLink = jiraUrl(defect);
  const context = contextPairs(result);
  let html = `<div style="max-width:920px;font-family:Arial,sans-serif">`;
  html += `<div style="border:1px solid ${v.border};background:${v.bg};border-radius:12px;padding:16px 18px;margin-bottom:14px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><span style="display:inline-block;padding:5px 10px;border-radius:999px;border:1px solid ${v.border};background:#fff;color:${v.fg};font-size:12px;font-weight:800">${v.icon} ${v.label}</span><a href="${tcLink}" style="font-size:13px;font-weight:800;text-decoration:none">${esc(id)}</a></div><div style="font-size:20px;line-height:1.35;font-weight:800;color:#101828">${esc(title)}</div></div>`;
  if (defect) html += htmlSection(`Known Defect · ${defect}`, `<div style="font-weight:800;margin-bottom:4px"><a href="${defectLink}">${esc(defect)}</a>${defectTitle ? ` — ${esc(defectTitle)}` : ''}</div><div>Resultado conhecido e mapeado neste escopo. O runtime técnico original permanece preservado nas evidências.</div>`, '#bdb4fe', '#211a33');
  html += htmlSection('O que foi validado', `<strong>${esc(objective)}</strong>`, '#53b1fd');
  html += htmlSection('Resultado esperado', esc(expected), '#84caff');
  html += htmlSection('Resultado observado', `<strong style="color:${v.fg}">${esc(observed)}</strong>`, v.border, status === 'PASS' && !defect ? '#10261d' : status === 'FAIL' && !defect ? '#2b1716' : status === 'BLOCKED' && !defect ? '#2d2613' : '#211a33');
  if (status === 'BLOCKED') html += htmlSection('Pré-requisito / desbloqueio', `<strong>${esc(prerequisite || observed || 'Restaurar o pré-requisito antes de uma validação conclusiva.')}</strong>`, '#fec84b', '#2d2613');
  if (context.length) {
    html += `<div style="border:1px solid #344054;border-radius:10px;padding:14px 16px;margin:12px 0;background:#111827"><div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;margin-bottom:8px">Contexto da execução</div><table style="border-collapse:collapse;width:100%;font-size:13px">${context.map(([key, value]) => `<tr><td style="padding:5px 14px 5px 0;width:160px;color:#98a2b3;font-weight:700">${esc(key)}</td><td style="padding:5px 0;color:#f2f4f7">${esc(value)}</td></tr>`).join('')}</table></div>`;
  }
  const links = [];
  if (tcLink) links.push(`<a href="${tcLink}" style="font-weight:700">Official TC · ${esc(id)}</a>`);
  if (defectLink) links.push(`<a href="${defectLink}" style="font-weight:700">Known Defect · ${esc(defect)}</a>`);
  if (buildUrl) links.push(`<a href="${buildUrl}" style="font-weight:700">Jenkins Build${buildNumber ? ` · #${esc(buildNumber)}` : ''}</a>`);
  if (stableArtifactsUrl()) links.push(`<a href="${stableArtifactsUrl()}" style="font-weight:700">Jenkins Artifacts · Evidence</a>`);
  if (links.length) html += htmlSection('Links e evidências', links.join('<br>'), '#667085', '#111827');
  html += `</div>`;
  return html;
}

let structured = 0;
let hiddenParameters = 0;
let normalizedLinks = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  const id = samId(result);
  if (!id) continue;

  const title = scenarioTitle(result);
  const status = runtimeStatus(result);
  const defect = issueKey(parameter(result, 'Known Defect'));
  const defectTitle = clean(parameter(result, 'Known Defect Title'));
  const originalDescription = String(result.description || '');
  const sectionStatus = businessStatusForStep(status, defect);

  let objective = readField(originalDescription, ['Validated', 'Objective', 'Validation goal', 'O que foi validado']);
  if (isGenericBusinessText(objective)) objective = `Validar o cenário oficial ${id}: ${title}.`;
  let expected = readField(originalDescription, ['Expected', 'Expected result', 'Resultado esperado']);
  if (isGenericBusinessText(expected)) expected = `O comportamento funcional “${title}” deve atender aos critérios de aceite definidos para o TC sem divergências.`;
  const observedFromDescription = readField(originalDescription, ['Observed', 'Actual Result', 'Resultado observado']);
  const technical = humanizeTechnical(result);
  const observed = observedFromDescription || (defect
    ? `O cenário encontrou o comportamento já mapeado em ${defect}${defectTitle ? ` — ${defectTitle}` : ''}.`
    : status === 'PASS'
      ? 'Todas as validações automatizadas previstas para o cenário foram atendidas.'
      : status === 'BLOCKED'
        ? technical || 'A execução foi interrompida por um pré-requisito indisponível.'
        : technical || 'O comportamento observado não atendeu ao resultado esperado.');
  const prerequisite = readField(originalDescription, ['Prerequisite', 'Blocker', 'Pré-requisito / desbloqueio']) || (status === 'BLOCKED' ? observed : '');

  const actualSteps = (result.steps || []).filter((step) => {
    const stepName = clean(step?.name);
    return !/^(?:0[1-9]|1[0-9]) · /.test(stepName) && !/^Known Defect · /i.test(stepName) && !/^Business execution$/i.test(stepName);
  });

  hideNoisyParameters(result);
  hiddenParameters += (result.parameters || []).filter((item) => item?.mode === 'hidden').length;
  normalizeLinks(result, id, defect);
  normalizedLinks += result.links.length;

  const sections = [
    section('01 · O que foi validado', [child(objective)]),
    section('02 · Resultado esperado', [child(expected)]),
    section('03 · Resultado observado', [child(observed, sectionStatus)], sectionStatus),
  ];

  let next = 4;
  if (defect) {
    sections.push(section(`${String(next).padStart(2, '0')} · Known Defect · ${defect}`, [child(defectTitle || 'Defeito funcional conhecido e mapeado.', 'skipped'), child(`Runtime preservado · ${status}`, 'skipped')], 'skipped'));
    next += 1;
  }
  if (status === 'BLOCKED') {
    sections.push(section(`${String(next).padStart(2, '0')} · Pré-requisito / desbloqueio`, [child(prerequisite, 'skipped')], 'skipped'));
    next += 1;
  }
  const context = contextChildren(result);
  if (context.length) {
    sections.push(section(`${String(next).padStart(2, '0')} · Contexto da execução`, context));
    next += 1;
  }
  const evidenceChildren = [];
  if (buildUrl) evidenceChildren.push(child(`Jenkins Build${buildNumber ? ` #${buildNumber}` : ''}`));
  if (stableArtifactsUrl()) evidenceChildren.push(child('Jenkins Artifacts · stable evidence fallback'));
  if (evidenceChildren.length) {
    sections.push(section(`${String(next).padStart(2, '0')} · Links e evidências`, evidenceChildren));
    next += 1;
  }
  if (actualSteps.length) sections.push({ ...section(`${String(next).padStart(2, '0')} · Execução do negócio`, [], sectionStatus), steps: actualSteps });

  result.steps = sections;
  result.descriptionHtml = renderDescriptionHtml({ result, id, title, status, defect, defectTitle, objective, expected, observed, prerequisite });
  result.description = [`${visual(status, defect).label} · ${id}`, title, `O que foi validado: ${objective}`, `Resultado esperado: ${expected}`, `Resultado observado: ${observed}`].join('\n');

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  structured += 1;
}

console.log(`[allure-business-view] READY · ${structured} official TC(s) structured with scenario-aware PASS/FAIL/BLOCKED/KNOWN DEFECT descriptions; ${hiddenParameters} repeated parameter field(s) hidden; ${normalizedLinks} stable link(s) published.`);
