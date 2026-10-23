const fs = require('node:fs');
const path = require('node:path');

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || 'allure-results');
const reportDir = path.resolve(process.argv[3] || process.env.ALLURE_REPORT_DIR || 'allure-report');
const testCasesDir = path.join(reportDir, 'data', 'test-cases');
const widgetsDir = path.join(reportDir, 'widgets');

function clean(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
}

function samId(value) {
  return clean(value).match(/SAM-\d+/i)?.[0]?.toUpperCase() || '';
}

function removeConsoleNoise(attachments) {
  if (!Array.isArray(attachments)) return 0;
  const before = attachments.length;
  const kept = attachments.filter((item) => !/^(stdout|stderr)$/i.test(clean(item?.name)));
  attachments.splice(0, attachments.length, ...kept);
  return before - kept.length;
}

function cleanSteps(steps) {
  let removed = 0;
  for (const step of steps || []) {
    removed += removeConsoleNoise(step.attachments);
    removed += cleanSteps(step.steps || []);
  }
  return removed;
}

function decorateBusinessLinks(html) {
  const pillStyle = 'display:inline-block;margin:4px 8px 4px 0;padding:6px 10px;border:1px solid #475467;border-radius:999px;background:#182230;color:#d1e9ff;text-decoration:none;font-weight:700;line-height:1.25';
  return String(html || '')
    .replace(/<a href="([^"]+)" style="font-weight:700">Official TC · ([^<]+)<\/a>/g,
      `<a href="$1" style="${pillStyle}">🧾 TC oficial · $2</a>`)
    .replace(/<a href="([^"]+)" style="font-weight:700">Known Defect · ([^<]+)<\/a>/g,
      `<a href="$1" style="${pillStyle}">🐞 Defeito conhecido · $2</a>`)
    .replace(/<a href="([^"]+)" style="font-weight:700">Jenkins Build([^<]*)<\/a>/g,
      `<a href="$1" style="${pillStyle}">▶ Jenkins$2</a>`)
    .replace(/<a href="([^"]+)" style="font-weight:700">Jenkins Artifacts · Evidence<\/a>/g,
      `<a href="$1" style="${pillStyle}">📎 Evidências</a>`);
}

function backupAndEmptyWidget(fileName, backupName = fileName.replace(/\.json$/i, '-full.json')) {
  const widgetFile = path.join(widgetsDir, fileName);
  if (!fs.existsSync(widgetFile)) return false;

  const raw = fs.readFileSync(widgetFile, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }

  const hasData = Array.isArray(parsed)
    ? parsed.length > 0
    : parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
  if (!hasData) return false;

  fs.writeFileSync(path.join(widgetsDir, backupName), JSON.stringify(parsed));
  fs.writeFileSync(widgetFile, Array.isArray(parsed) ? '[]' : '{}');
  return true;
}

function simplifyStockGraphs() {
  const suppressed = [];
  const widgetsToSuppress = [
    ['history-trend.json', 'history-trend-full.json'],
    ['retries-trend.json', 'retries-trend-full.json'],
    ['categories-trend.json', 'categories-trend-full.json'],
    ['severity.json', 'severity-full.json'],
  ];

  for (const [fileName, backupName] of widgetsToSuppress) {
    if (backupAndEmptyWidget(fileName, backupName)) suppressed.push(fileName);
  }

  return suppressed;
}

function hideTimelineNavigation() {
  const indexFile = path.join(reportDir, 'index.html');
  if (!fs.existsSync(indexFile)) return false;

  const marker = 'data-samsung-hide-timeline';
  const html = fs.readFileSync(indexFile, 'utf8');
  if (html.includes(marker)) return true;

  const script = `
<script ${marker}="true">
(() => {
  const hideTimeline = () => {
    for (const node of document.querySelectorAll('a,button,[role="link"],[role="button"]')) {
      const text = (node.textContent || '').trim().toLowerCase();
      const href = (node.getAttribute?.('href') || '').toLowerCase();
      if (text === 'timeline' || /(?:#|\/)timeline(?:$|[/?#])/.test(href)) {
        const item = node.closest('li') || node.closest('[class*="menu"]') || node;
        item.style.display = 'none';
      }
    }
  };
  hideTimeline();
  const observer = new MutationObserver(hideTimeline);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;

  const updated = html.includes('</body>')
    ? html.replace('</body>', `${script}\n</body>`)
    : `${html}\n${script}`;
  fs.writeFileSync(indexFile, updated);
  return true;
}

if (!fs.existsSync(resultsDir) || !fs.existsSync(testCasesDir)) {
  console.log('[allure-generated-polish] Results/report data missing; nothing to polish.');
  process.exit(0);
}

const sourceById = new Map();
for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith('-result.json'))) {
  const result = JSON.parse(fs.readFileSync(path.join(resultsDir, name), 'utf8'));
  const id = samId(`${result.name || ''} ${result.fullName || ''}`);
  if (!id) continue;
  sourceById.set(id, result);
}

let polished = 0;
let consoleNoiseRemoved = 0;
let duplicateLinksRemoved = 0;
let missingHtml = 0;

for (const name of fs.readdirSync(testCasesDir).filter((file) => file.endsWith('.json'))) {
  const file = path.join(testCasesDir, name);
  const testCase = JSON.parse(fs.readFileSync(file, 'utf8'));
  const id = samId(`${testCase.name || ''} ${testCase.fullName || ''} ${(testCase.links || []).map((link) => link?.name || '').join(' ')}`);
  if (!id) continue;

  const source = sourceById.get(id);
  if (!source) continue;

  const richHtml = clean(source.descriptionHtml);
  if (richHtml) {
    testCase.descriptionHtml = decorateBusinessLinks(source.descriptionHtml);
    delete testCase.description;
    duplicateLinksRemoved += Array.isArray(testCase.links) ? testCase.links.length : 0;
    testCase.links = [];
  } else {
    missingHtml += 1;
    testCase.description = source.description || testCase.description || '';
  }

  consoleNoiseRemoved += removeConsoleNoise(testCase.attachments);
  consoleNoiseRemoved += cleanSteps(testCase.steps || []);

  fs.writeFileSync(file, JSON.stringify(testCase));
  polished += 1;
}

const suppressedGraphWidgets = simplifyStockGraphs();
const timelineHidden = hideTimelineNavigation();

console.log(`[allure-generated-polish] READY · ${polished} TC(s) polished in generated report · console-noise-removed=${consoleNoiseRemoved} · duplicate-links-removed=${duplicateLinksRemoved} · graph-widgets-suppressed=${suppressedGraphWidgets.join(',') || 'none'} · timeline-nav=${timelineHidden ? 'hidden' : 'unchanged'} · missing-rich-html=${missingHtml}.`);
if (missingHtml > 0) process.exitCode = 2;
