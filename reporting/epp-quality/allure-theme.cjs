const fs = require('node:fs');
const path = require('node:path');
const STYLE_FILE = 'samsung-epp-allure.css';
const MARKER = 'data-samsung-epp-allure-theme';

function applyAllureTheme(reportDirectory, io = fs) {
  const report = path.resolve(reportDirectory);
  const index = path.join(report, 'index.html');
  if (!io.existsSync(index)) return false;
  const html = io.readFileSync(index, 'utf8');
  if (!/<\/head>/i.test(html)) return false;
  const css = io.readFileSync(path.join(__dirname, 'allure-theme.css'));
  io.writeFileSync(path.join(report, STYLE_FILE), css);
  if (!html.includes(MARKER)) {
    const link = '<link ' + MARKER + '="true" rel="stylesheet" href="' + STYLE_FILE + '">';
    io.writeFileSync(index, html.replace(/<\/head>/i, link + '</head>'));
  }
  return true;
}
module.exports = { applyAllureTheme, STYLE_FILE };
