const fs = require("node:fs");
const path = require("node:path");

const TEMPLATE_DIRECTORY = path.join(__dirname, "..", "docs", "smb_priority_templates");
const MARKETS = ["MX", "PE", "CL", "CO"];

function parseRow(line) {
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (!/^\d+$/.test(cells[0] || "")) return null;
  if (!/^P[12]$/.test(cells[2] || "")) throw new Error(`Official source row ${cells[0]} has invalid or missing priority: ${cells[2] || "<missing>"}`);
  return { serial: Number(cells[0]), scenario: cells[1], priority: cells[2], site: cells[3] };
}

function parseOfficialTemplate(market, directory = TEMPLATE_DIRECTORY) {
  const sourceFilename = `STG-${market}-Smoke-Test-Template.md`;
  const sourcePath = path.join(directory, sourceFilename);
  const lines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);
  const contexts = { BASE_STORE: [], EPP: [] };
  let context = null;
  for (const line of lines) {
    if (/^\|\s*\*\*Base store\*\*/i.test(line)) context = "BASE_STORE";
    else if (/^\|\s*\*\*EPP\*\*/i.test(line)) context = "EPP";
    if (!context) continue;
    const parsed = parseRow(line);
    if (!parsed) continue;
    if (parsed.site !== market) throw new Error(`${sourceFilename}: row ${parsed.serial} belongs to ${parsed.site}, expected ${market}`);
    contexts[context].push({ sourceRowKey: `${market}-${context}-${parsed.serial}`, sourceSerial: parsed.serial, scenario: parsed.scenario, priority: parsed.priority, qstIncluded: parsed.priority === "P1", dstIncluded: true, sourceFilename });
  }
  for (const [name, rows] of Object.entries(contexts)) {
    if (!rows.length) throw new Error(`${sourceFilename}: ${name} table is empty or missing`);
    rows.forEach((row, index) => {
      if (row.sourceSerial !== index + 1) throw new Error(`${sourceFilename}: ${name} source row sequence breaks at ${index + 1}`);
    });
  }
  return { sourceFilename, contexts };
}

function loadOfficialTemplates(directory = TEMPLATE_DIRECTORY) {
  return Object.fromEntries(MARKETS.map((market) => [market, parseOfficialTemplate(market, directory)]));
}

module.exports = { TEMPLATE_DIRECTORY, MARKETS, parseRow, parseOfficialTemplate, loadOfficialTemplates };
