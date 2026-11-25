const { evidence, isFinancialSubmission } = require('../../utils/dstPilot.cjs');
const { recordBusinessEvidence } = require('../../reporting/evidence/evidenceContext');
const path = require('node:path');

function pilotScreenshotOptions(options, testInfo) {
  if (!options?.path || !/^evidence\/screenshots\/[^/]+\.png$/.test(String(options.path).replace(/\\/g, '/'))) return options;
  return { ...options, path: testInfo.outputPath('business-screenshots', path.basename(options.path)) };
}

async function installPilotSafety(page, testInfo, id, environment) {
  recordBusinessEvidence(testInfo, evidence(id, environment));
  // Legacy BasePage helpers write fixed screenshot names. Isolate only those
  // calls for this pilot page so previous QST/legacy artifacts remain intact.
  const screenshot = page.screenshot.bind(page);
  page.screenshot = options => screenshot(pilotScreenshotOptions(options, testInfo));
  testInfo.annotations.push({ type: 'official-definition-gap', description: 'Current source contains scenario text only; formal preconditions/steps/expected results remain unverified.' });
  const guard = async route => {
    const request = route.request();
    if (isFinancialSubmission(request.method(), request.url())) {
      await route.abort('blockedbyclient');
      throw new Error('DST_PILOT_FINANCIAL_SUBMISSION_FORBIDDEN');
    }
    await route.fallback();
  };
  await page.context().route('**/*', guard);
  // BC already owns a page route; current-page guard must precede it too.
  await page.route('**/*', guard);
}

module.exports = { installPilotSafety, pilotScreenshotOptions };
