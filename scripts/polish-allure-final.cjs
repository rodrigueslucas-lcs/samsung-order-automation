const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
const phase = String(process.argv[3] || 'final').toLowerCase();

if (!fs.existsSync(resultsDir)) {
  console.log('[allure-final-polish] Results directory does not exist; nothing to polish.');
  process.exit(0);
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

function parameter(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || '';
}

function samId(result) {
  return `${result.name || ''} ${result.fullName || ''}`.match(/SAM-\d+/)?.[0] || '';
}

function titleOf(result) {
  const id = samId(result);
  const raw = clean(result.name || result.fullName || id || 'Official QST scenario');
  return raw.replace(new RegExp(`^${id}\\s*[·:\\-]?\\s*`, 'i'), '').trim() || raw;
}

function businessStatus(result) {
  const explicit = clean(parameter(result, 'Runtime Status')).toUpperCase();
  if (/BLOCKED|SKIPPED/.test(explicit)) return 'BLOCKED';
  if (/PASS/.test(explicit)) return 'PASS';
  if (/FAIL|TIMEDOUT|INTERRUPTED|UNEXPECTED/.test(explicit)) return 'FAIL';

  const technical = clean(parameter(result, 'Technical Result')).toUpperCase();
  if (/BLOCKED|SKIPPED/.test(technical)) return 'BLOCKED';
  if (/PASS/.test(technical)) return 'PASS';
  if (/FAIL|TIMEDOUT|INTERRUPTED|UNEXPECTED/.test(technical)) return 'FAIL';

  const status = clean(result.status).toLowerCase();
  if (status === 'passed') return 'PASS';
  if (status === 'skipped' || status === 'broken') return 'BLOCKED';
  if (status === 'failed') return 'FAIL';
  if (status === 'unknown' && parameter(result, 'Known Defect')) return 'FAIL';
  return 'NOT RUN';
}

function knownDefect(result) {
  return clean(parameter(result, 'Known Defect')).match(/(?:SAM|RT)-\d+/i)?.[0]?.toUpperCase() || '';
}

function knownDefectTitle(result) {
  return clean(parameter(result, 'Known Defect Title'));
}

function sourceExists(attachment) {
  const source = clean(attachment?.source);
  return source && fs.existsSync(path.join(resultsDir, source));
}

function attachmentKind(attachment) {
  const name = clean(attachment?.name);
  const type = clean(attachment?.type);
  const source = clean(attachment?.source);
  if (/screenshot/i.test(name) || /^image\//i.test(type) || /\.(png|jpe?g|webp)$/i.test(source)) return 'screenshot';
  if (/trace/i.test(name) || /\.zip$/i.test(source)) return 'trace';
  if (/video/i.test(name) || /^video\//i.test(type) || /\.(webm|mp4)$/i.test(source)) return 'video';
  if (/error[ ._-]*context/i.test(name) || /\.md$/i.test(source)) return 'error-context';
  return 'artifact';
}

function evidenceName(kind, current) {
  if (kind === 'screenshot') return 'Screenshot · Estado final';
  if (kind === 'trace') return 'Playwright Trace · Diagnóstico técnico';
  if (kind === 'video') return 'Vídeo · Execução do negócio';
  if (kind === 'error-context') return 'Error Context · Diagnóstico bruto';
  return current || 'Evidência';
}

function collectStepAttachments(steps, collected = []) {
  for (const step of steps || []) {
    for (const attachment of step.attachments || []) collected.push(attachment);
    collectStepAttachments(step.steps, collected);
  }
  return collected;
}

function promoteEvidence(result) {
  const candidates = [
    ...(result.attachments || []),
    ...collectStepAttachments(result.steps || []),
  ];
  const seen = new Set();
  const promoted = [];
  for (const attachment of candidates) {
    if (!sourceExists(attachment)) continue;
    const source = clean(attachment.source);
    if (seen.has(source)) continue;
    seen.add(source);
    const kind = attachmentKind(attachment);
    promoted.push({ ...attachment, name: evidenceName(kind, attachment.name) });
  }
  result.attachments = promoted;
  return promoted.length;
}

function field(description, labels) {
  const source = String(description || '');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`\\*\\*${escaped}:?\\*\\*\\s*([^\\n]+)`, 'i'),
      new RegExp(`^${escaped}:\\s*([^\\n]+)`, 'im'),
      new RegExp(`^${escaped}\\s*\\n([^\\n]+)`, 'im'),
      new RegExp(`^${escaped}\\s*·\\s*([^\\n]+)`, 'im'),
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return clean(match[1]);
    }
  }
  return '';
}

function humanizeTechnical(result) {
  const raw = clean(result.statusDetails?.message || result.statusDetails?.trace || '');
  if (!raw) return '';
  if (/HTTP\s*500/i.test(raw)) return 'O fluxo chegou ao backend, porém a operação retornou HTTP 500 e impediu a conclusão esperada.';
  if (/timeout|timed out|exceeded/i.test(raw)) return 'O cenário excedeu a janela controlada de espera antes de atingir o estado esperado.';
  if (/credentials|required for checkout login|authentication|session/i.test(raw)) return 'A execução não pôde continuar porque um pré-requisito de autenticação/sessão não estava disponível.';
  const receivedUrl = raw.match(/Received string:\s*["']([^"']+)["']/i)?.[1];
  if (receivedUrl) return `A navegação não atingiu o destino esperado; o browser permaneceu em ${receivedUrl}.`;
  return raw.split('\n')[0].replace(/^Error:\s*/i, '').slice(0, 520);
}

function contextRows(result) {
  const preferred = [
    ['Market', 'Market'],
    ['Environment', 'Environment'],
    ['Store', 'Store'],
    ['Feature', 'Feature'],
    ['User Type', 'User Type'],
    ['SKU', 'SKU'],
    ['Payment', 'Payment'],
    ['Payment Method', 'Payment'],
    ['Order ID', 'Order ID'],
    ['Runtime Status', 'Runtime Status'],
    ['Technical Result', 'Technical Result'],
  ];
  const seen = new Set();
  return preferred.flatMap(([name, label]) => {
    if (seen.has(label)) return [];
    const value = clean(parameter(result, name));
    if (!value) return [];
    seen.add(label);
    return [[label, value]];
  });
}

function visual(status, defect) {
  if (defect) return { label: 'KNOWN DEFECT', icon: '◆', fg: '#7F56D9', bg: '#F4F0FF', border: '#BDB4FE' };
  if (status === 'PASS') return { label: 'PASS', icon: '✓', fg: '#067647', bg: '#ECFDF3', border: '#75E0A7' };
  if (status === 'FAIL') return { label: 'FAIL', icon: '×', fg: '#B42318', bg: '#FEF3F2', border: '#F97066' };
  if (status === 'BLOCKED') return { label: 'BLOCKED', icon: '!', fg: '#B54708', bg: '#FFFAEB', border: '#FEC84B' };
  return { label: 'NOT RUN', icon: '•', fg: '#475467', bg: '#F2F4F7', border: '#D0D5DD' };
}

function card(title, body, accent, background) {
  return `<section style="border:1px solid ${accent};border-left:5px solid ${accent};border-radius:10px;padding:14px 16px;margin:12px 0;background:${background}">` +
    `<div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${accent};margin-bottom:7px">${esc(title)}</div>` +
    `<div style="font-size:14px;line-height:1.65">${body}</div></section>`;
}

function formatPresentation(result) {
  const id = samId(result);
  if (!id) return false;

  const status = businessStatus(result);
  const defect = knownDefect(result);
  const defectTitle = knownDefectTitle(result);
  const title = titleOf(result);
  const original = String(result.description || '');
  const objective = field(original, ['O que foi validado', 'Validated', 'Objective', 'Validation goal']) || `Validar o cenário oficial ${id}: ${title}.`;
  const expected = field(original, ['Resultado esperado', 'Expected result', 'Expected']) || 'Os critérios de aceite do cenário oficial devem ser atendidos.';
  const observedFromDescription = field(original, ['Resultado observado', 'Observed', 'Actual Result']);
  const technical = humanizeTechnical(result);
  const observed = observedFromDescription || (status === 'PASS'
    ? 'Todas as validações automatizadas previstas para o cenário foram atendidas.'
    : status === 'BLOCKED'
      ? technical || 'A execução foi interrompida por um pré-requisito indisponível.'
      : technical || 'O comportamento observado não atendeu ao resultado esperado.');
  const prerequisite = field(original, ['Pré-requisito / desbloqueio', 'Prerequisite', 'Blocker']) || (status === 'BLOCKED' ? observed : '');
  const v = visual(status, defect);

  const jira = `https://jira.secext.samsung.net/browse/${id}`;
  let html = `<div style="max-width:920px;font-family:Arial,sans-serif">`;
  html += `<div style="border:1px solid ${v.border};background:${v.bg};border-radius:12px;padding:16px 18px;margin-bottom:14px">` +
    `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">` +
    `<span style="display:inline-block;padding:5px 10px;border-radius:999px;border:1px solid ${v.border};background:#fff;color:${v.fg};font-size:12px;font-weight:800">${v.icon} ${v.label}</span>` +
    `<a href="${jira}" style="font-size:13px;font-weight:800;text-decoration:none">${esc(id)}</a></div>` +
    `<div style="font-size:20px;line-height:1.35;font-weight:800;color:#101828">${esc(title)}</div></div>`;

  if (defect) {
    const defectUrl = `https://jira.secext.samsung.net/browse/${defect}`;
    html += card('Known Defect', `<strong><a href="${defectUrl}">${esc(defect)}</a>${defectTitle ? ` — ${esc(defectTitle)}` : ''}</strong><br>Resultado conhecido e mapeado para este escopo. O runtime técnico continua preservado para diagnóstico.`, '#7F56D9', '#F4F0FF');
  }

  html += card('O que foi validado', `<strong>${esc(objective)}</strong>`, '#2E90FA', '#F5FBFF');
  html += card('Resultado esperado', esc(expected), '#53B1FD', '#F5FBFF');
  html += card('Resultado observado', `<strong>${esc(observed)}</strong>`, v.border, v.bg);

  if (status === 'BLOCKED') {
    html += card('Pré-requisito / desbloqueio', esc(prerequisite), '#FEC84B', '#FFFAEB');
  }

  const context = contextRows(result);
  if (context.length) {
    const rows = context.map(([label, value]) => `<tr><td style="padding:5px 14px 5px 0;width:160px;color:#667085;font-weight:700">${esc(label)}</td><td style="padding:5px 0;color:#101828">${esc(value)}</td></tr>`).join('');
    html += card('Contexto da execução', `<table style="border-collapse:collapse;width:100%;font-size:13px">${rows}</table>`, '#D0D5DD', '#FCFCFD');
  }

  const evidence = result.attachments || [];
  const evidenceLabels = [...new Set(evidence.map((item) => attachmentKind(item)))];
  const evidenceText = evidenceLabels.length
    ? `Evidências anexadas ao TC: <strong>${evidenceLabels.map((kind) => ({ screenshot: 'Screenshot', trace: 'Playwright Trace', video: 'Vídeo', 'error-context': 'Error Context', artifact: 'Artefato' })[kind]).join(' · ')}</strong>.`
    : 'Evidências técnicas permanecem disponíveis nos artefatos do build.';
  html += card('Links e evidências', `<a href="${jira}"><strong>TC oficial · ${esc(id)}</strong></a><br>${evidenceText}`, '#98A2B3', '#FCFCFD');
  html += '</div>';
  result.descriptionHtml = html;

  // Markdown/plain fallback for Allure views that do not render descriptionHtml.
  const plain = [
    `${v.icon} **${v.label} · ${id}**`,
    `**${title}**`,
    '',
    '**O que foi validado**',
    objective,
    '',
    '**Resultado esperado**',
    expected,
    '',
    '**Resultado observado**',
    observed,
  ];
  if (defect) plain.push('', '**Known Defect**', `${defect}${defectTitle ? ` — ${defectTitle}` : ''}`);
  if (status === 'BLOCKED') plain.push('', '**Pré-requisito / desbloqueio**', prerequisite);
  if (context.length) {
    plain.push('', '**Contexto da execução**');
    for (const [label, value] of context) plain.push(`- **${label}:** ${value}`);
  }
  plain.push('', '**Links e evidências**', `- TC oficial: ${id}`, `- ${evidenceText.replace(/<[^>]+>/g, '')}`);
  result.description = plain.join('\n');

  // Final Allure visual status. Runtime truth remains in Runtime Status / Technical Result.
  if (defect) result.status = 'unknown';
  else if (status === 'PASS') result.status = 'passed';
  else if (status === 'FAIL') result.status = 'failed';
  else if (status === 'BLOCKED') result.status = 'broken';

  result.stage = 'finished';
  result.statusDetails ||= {};
  if (defect) {
    result.statusDetails.message = `KNOWN DEFECT ${defect}${defectTitle ? ` — ${defectTitle}` : ''}. Runtime status preservado: ${status}.`;
  } else if (status === 'PASS') {
    result.statusDetails.message = 'PASS · Critérios automatizados do cenário atendidos.';
  } else if (status === 'BLOCKED') {
    result.statusDetails.message = `BLOCKED · ${prerequisite}`;
  } else if (status === 'FAIL') {
    result.statusDetails.message = `FAIL · ${observed}`;
  }
  return true;
}

let files = 0;
let promoted = 0;
let polished = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  promoted += promoteEvidence(result);
  if (phase !== 'evidence' && formatPresentation(result)) polished += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  files += 1;
}

console.log(`[allure-final-polish] ${phase.toUpperCase()} · processed ${files} result(s); promoted ${promoted} evidence attachment(s); polished ${polished} official TC(s).`);
