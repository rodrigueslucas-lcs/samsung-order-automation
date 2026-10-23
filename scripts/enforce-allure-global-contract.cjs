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

function esc(value) {
  return clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
    process.env.MX_QST_ENVIRONMENT || process.env.PE_QST_ENVIRONMENT ||
    process.env.CO_QST_ENVIRONMENT || process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT
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

function humanizeTechnical(raw) {
  const text = clean(raw).replace(/^(?:FAIL|BLOCKED)\s*[·:-]?\s*/i, '');
  if (!text) return '';
  if (/bounded wait\/recovery|exceeded.*wait|expected storefront state/i.test(text)) {
    return 'O cenário excedeu a janela controlada de espera antes de atingir o estado funcional esperado.';
  }
  if (/cart readback is unresolved|product absence was not proven/i.test(text)) {
    return 'O estado do carrinho não pôde ser confirmado com segurança dentro da janela de recuperação controlada.';
  }
  if (/authentication|session|credentials|unauthenticated|login/i.test(text)) {
    return 'A execução não pôde continuar porque o pré-requisito de autenticação/sessão não estava disponível.';
  }
  if (/HTTP\s*500/i.test(text)) {
    return 'O backend retornou HTTP 500 durante o fluxo e impediu a conclusão esperada do cenário.';
  }
  if (/timeout|timed out/i.test(text)) {
    return 'O cenário excedeu a janela controlada de espera antes de atingir o estado esperado.';
  }
  return text;
}

function statusMessage(result, status, defect, originalMessage) {
  const title = parameter(result, 'Known Defect Title');
  if (defect) return `KNOWN DEFECT · ${defect}${title ? ` · ${title}` : ''}`;
  if (status === 'PASS') return 'PASS · Critérios automatizados do cenário atendidos.';
  if (status === 'BLOCKED') return `BLOCKED · ${humanizeTechnical(originalMessage) || 'Pré-requisito necessário indisponível.'}`;
  if (status === 'FAIL') return `FAIL · ${humanizeTechnical(originalMessage) || 'O comportamento observado não atendeu ao resultado esperado.'}`;
  return clean(originalMessage);
}

function samId(result) {
  return `${result.name || ''} ${result.fullName || ''}`.match(/SAM-\d+/)?.[0] || '';
}

function scenarioTitle(result, id) {
  return clean(result.name || result.fullName || id).replace(new RegExp(`^${id}\\s*[·:\\-]?\\s*`, 'i'), '').trim();
}

function stepValue(result, prefix) {
  const step = (result.steps || []).find((item) => clean(item?.name).startsWith(prefix));
  return clean(step?.steps?.[0]?.name || '');
}

function contextMap(result) {
  const labels = ['Market', 'Environment', 'Store', 'User Type', 'SKU', 'Payment', 'Order ID', 'Runtime Status', 'Technical Result'];
  return labels.map((label) => [label, parameter(result, label)]).filter(([, value]) => value);
}

function statusVisual(status, defect) {
  if (defect) return { icon: '🟣', label: 'KNOWN DEFECT' };
  if (status === 'PASS') return { icon: '🟢', label: 'PASS' };
  if (status === 'BLOCKED') return { icon: '🟡', label: 'BLOCKED' };
  if (status === 'FAIL') return { icon: '🔴', label: 'FAIL' };
  return { icon: '⚪', label: 'NOT RUN' };
}

function markdownDescription(result, status, defect, market, environment, store) {
  const id = samId(result);
  const title = scenarioTitle(result, id);
  const visual = statusVisual(status, defect);
  const objective = stepValue(result, '01 · ') || `Validar o cenário oficial ${id}: ${title}.`;
  const expected = stepValue(result, '02 · ') || `O comportamento funcional “${title}” deve atender aos critérios de aceite definidos para o TC sem divergências.`;
  const observed = stepValue(result, '03 · ') || statusMessage(result, status, defect, result.statusDetails?.message || '');
  const prerequisiteStep = (result.steps || []).find((item) => /Pré-requisito|desbloqueio/i.test(clean(item?.name)));
  const prerequisite = clean(prerequisiteStep?.steps?.[0]?.name || '');
  const defectTitle = parameter(result, 'Known Defect Title');
  const context = contextMap(result);
  if (!context.some(([label]) => label === 'Market')) context.unshift(['Market', market]);
  if (!context.some(([label]) => label === 'Environment')) context.splice(1, 0, ['Environment', environment]);
  if (!context.some(([label]) => label === 'Store')) context.splice(2, 0, ['Store', store]);

  const lines = [
    `## ${visual.icon} **${visual.label}** · **${id}**`, `### ${title}`, '', '---', '',
    '### **O que foi validado**', objective, '',
    '### **Resultado esperado**', expected, '',
    '### **Resultado observado**', `**${visual.icon} ${observed}**`,
  ];
  if (defect) lines.push('', '### **Known Defect**', `🟣 **${defect}**${defectTitle ? ` — ${defectTitle}` : ''}`, 'O runtime técnico original permanece preservado nas evidências para diagnóstico.');
  if (status === 'BLOCKED' && prerequisite) lines.push('', '### **Pré-requisito / desbloqueio**', `🟡 ${prerequisite}`);
  lines.push('', '### **Contexto da execução**', '', '| Campo | Valor |', '|---|---|');
  for (const [label, value] of context) lines.push(`| **${label}** | ${value} |`);
  return lines.join('\n');
}

function replaceTechnicalTextInHtml(html, originalMessage, replacement) {
  if (!html || !originalMessage || !replacement) return html;
  const candidates = [clean(originalMessage), clean(originalMessage).replace(/^(?:FAIL|BLOCKED)\s*[·:-]?\s*/i, '')];
  let output = String(html);
  for (const candidate of candidates.filter(Boolean)) {
    output = output.split(esc(candidate)).join(esc(replacement));
  }
  return output;
}

function removeConsoleNoiseFromSteps(steps) {
  let removed = 0;
  for (const step of steps || []) {
    if (Array.isArray(step.attachments)) {
      const before = step.attachments.length;
      step.attachments = step.attachments.filter((attachment) => !/^(stdout|stderr)$/i.test(clean(attachment?.name)));
      removed += before - step.attachments.length;
    }
    removed += removeConsoleNoiseFromSteps(step.steps || []);
  }
  return removed;
}

let processed = 0;
let suiteNormalized = 0;
let behaviorNormalized = 0;
let consoleNoiseRemoved = 0;
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
  const id = samId(result);
  const title = scenarioTitle(result, id);
  const originalStatusMessage = clean(result.statusDetails?.message || result.statusDetails?.trace || '');

  upsertLabel(result, 'parentSuite', `${market} · ${environment}`);
  upsertLabel(result, 'suite', `${store} · P1/QST`);
  upsertLabel(result, 'subSuite', `${market} QST · ${store} Official P1`);
  suiteNormalized += 1;

  upsertLabel(result, 'epic', 'Samsung SMB QST');
  upsertLabel(result, 'feature', `${market} · ${store} · P1/QST`);
  upsertLabel(result, 'story', `${id} · ${title}`);
  behaviorNormalized += 1;

  if (defect) {
    result.status = 'unknown'; addTag(result, 'known-defect'); counts.defect += 1;
  } else if (status === 'PASS') {
    result.status = 'passed'; counts.passed += 1;
  } else if (status === 'BLOCKED') {
    result.status = 'broken'; addTag(result, 'blocked'); counts.blocked += 1;
  } else if (status === 'FAIL') {
    result.status = 'failed'; counts.failed += 1;
  } else counts.other += 1;

  result.stage = 'finished';
  result.statusDetails ||= {};
  const finalMessage = statusMessage(result, status, defect, originalStatusMessage);
  result.statusDetails.message = finalMessage;
  if (defect || status === 'PASS') result.statusDetails.trace = '';

  const conciseObserved = defect
    ? `O comportamento conhecido está mapeado em ${defect}${parameter(result, 'Known Defect Title') ? ` — ${parameter(result, 'Known Defect Title')}` : ''}.`
    : humanizeTechnical(originalStatusMessage);
  if (clean(result.descriptionHtml) && conciseObserved) {
    result.descriptionHtml = replaceTechnicalTextInHtml(result.descriptionHtml, originalStatusMessage, conciseObserved);
  }

  result.description = markdownDescription(result, status, defect, market, environment, store);
  if (!clean(result.descriptionHtml)) console.error(`[allure-global-contract] Missing rich HTML description for ${id}.`);

  if (Array.isArray(result.attachments)) {
    const before = result.attachments.length;
    result.attachments = result.attachments.filter((attachment) => !/^(stdout|stderr)$/i.test(clean(attachment?.name)));
    consoleNoiseRemoved += before - result.attachments.length;
  }
  consoleNoiseRemoved += removeConsoleNoiseFromSteps(result.steps || []);

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  processed += 1;
}

console.log(`[allure-global-contract] READY · ${processed} official TC(s) · suites=${suiteNormalized} · behaviors=${behaviorNormalized} · console-noise-removed=${consoleNoiseRemoved} · PASS=${counts.passed} FAIL=${counts.failed} BLOCKED=${counts.blocked} KNOWN_DEFECT=${counts.defect} OTHER=${counts.other}.`);
