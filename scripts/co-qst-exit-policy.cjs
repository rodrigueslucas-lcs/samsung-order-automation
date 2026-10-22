const fs = require('node:fs');
const { activeKnownDefects } = require('./annotate-known-defects-dashboard.cjs');

function readAttachmentText(attachment) {
  if (attachment?.body) return Buffer.from(attachment.body, 'base64').toString('utf8');
  if (attachment?.path && fs.statSync(attachment.path).size < 2 * 1024 * 1024) {
    return fs.readFileSync(attachment.path, 'utf8');
  }
  return '';
}

function isCoLogoutCartDefect(result, readText = readAttachmentText) {
  if (result.status !== 'failed' || result.errors?.length !== 1) return false;
  const attachments = result.attachments || [];
  const json = name => {
    try { return JSON.parse(readText(attachments.find(a => a.name === name))); } catch { return null; }
  };
  const product = json('CO Product Context');
  const transition = json('co-logout-transition');
  if (product?.market !== 'CO' || product.environment !== 'S2' || !product.sku ||
      ![200, 302, 303, 307, 308].includes(transition?.logoutStatus) ||
      transition.returnStatus !== 200 || !(transition.menuAttempts >= 1 && transition.menuAttempts <= 3) ||
      !attachments.some(a => a.name === 'co-logout-registered-cart')) return false;
  const error = result.errors[0];
  const clean = text => String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
  if (!clean(error.message).includes(`getByText('${product.sku}', { exact: true }).first()`) ||
      !/element\(s\) not found/.test(clean(error.message)) ||
      !/>[^\n]*await expect\(page\.getByText\(cfg\.sku,\{exact:true\}\)\.first\(\)\)\.toBeVisible/.test(clean(result.error?.snippet || error.snippet))) return false;
  try {
    const context = readText(attachments.find(a => a.name === 'error-context'));
    const snapshot = context.split('```yaml')[1]?.split('```')[0] || '';
    return /^\s*- heading "Su carrito est[aá] vac[ií]o"/m.test(snapshot);
  } catch { return false; }
}

function failedResults(report) {
  const rows = [];
  const visit = node => {
    for (const spec of node.specs || []) for (const test of spec.tests || []) {
      for (const result of test.results || []) if (['failed', 'timedOut', 'interrupted'].includes(result.status)) {
        rows.push({ samId: spec.title?.match(/SAM-\d+/)?.[0], result });
      }
    }
    for (const child of node.suites || []) visit(child);
  };
  visit(report || {});
  return rows;
}

function evaluateCoCampaignExit({ runtime, report, phases, registry, targeted = false, sessionGateFailed = false, readText }) {
  const active = activeKnownDefects(runtime, registry).some(({ defect }) =>
    defect.samId === 'SAM-24896' && defect.jira === 'RT-752445');
  const accepted = row => active && row.samId === 'SAM-24896' && isCoLogoutCartDefect(row.result, readText);
  const failures = failedResults(report);
  const knownDefectIds = [...new Set(failures.filter(accepted).map(row => row.samId))];
  const unexpected = failures.some(row => !accepted(row));
  const infrastructure = sessionGateFailed || !report || !phases?.length || (report.errors || []).length > 0 || phases.some(phase =>
    phase.error || phase.signal || ![0, 1].includes(phase.status) || !phase.report ||
    (phase.report.errors || []).length > 0 ||
    (phase.status === 1 && !failedResults(phase.report).length));
  const failedRuntime = (runtime?.tests || []).some(test => test.status === 'FAIL' && !knownDefectIds.includes(test.samId));
  const missing = !targeted && (runtime?.tests || []).some(test => test.status === 'NOT_RUN');
  return { exitCode: infrastructure || unexpected || failedRuntime || missing ? 1 : 0, knownDefectIds };
}

module.exports = { evaluateCoCampaignExit, isCoLogoutCartDefect };
