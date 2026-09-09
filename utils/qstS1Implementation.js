const fs = require("node:fs");
const path = require("node:path");

const registry = require("../test-mapping/smb-qst.json");

const SUPPORTED_MARKETS = Object.freeze(["MX", "PE", "CL", "CO"]);

function walkSpecFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkSpecFiles(target));
    else if (/\.spec\.[cm]?js$/i.test(entry.name)) files.push(target);
  }
  return files;
}

function testTitles(source) {
  const titles = [];
  const expression = /\btest\s*\(\s*(["'`])([\s\S]*?)\1\s*,/g;
  let match;
  while ((match = expression.exec(source))) titles.push(match[2]);
  return titles;
}

function officialIdsFromTitle(title) {
  return [...new Set(String(title).match(/SAM-\d+/g) || [])];
}

function collectMarketImplementation(market, { root = path.resolve("tests/s1") } = {}) {
  const code = String(market).toUpperCase();
  if (!SUPPORTED_MARKETS.includes(code)) {
    throw new Error(`Unsupported S1 QST implementation market: ${market}`);
  }

  const marketRoot = path.join(root, code.toLowerCase(), "qst");
  const cases = [];
  for (const file of walkSpecFiles(marketRoot)) {
    const source = fs.readFileSync(file, "utf8");
    for (const title of testTitles(source)) {
      for (const id of officialIdsFromTitle(title)) {
        cases.push({
          id,
          title,
          spec: path.relative(process.cwd(), file).replace(/\\/g, "/"),
        });
      }
    }
  }
  return cases;
}

function validateS1OfficialImplementation() {
  const errors = [];
  const inventory = {};

  for (const market of SUPPORTED_MARKETS) {
    const official = new Set(registry.markets?.[market]?.cases || []);
    const cases = collectMarketImplementation(market);
    const byId = new Map();

    for (const entry of cases) {
      if (!official.has(entry.id)) {
        errors.push(`${market}: ${entry.id} appears in an S1 QST test title but is not an official ${market} ID (${entry.spec}).`);
      }
      const previous = byId.get(entry.id) || [];
      previous.push(entry);
      byId.set(entry.id, previous);
    }

    for (const [id, entries] of byId) {
      if (entries.length > 1) {
        errors.push(`${market}: official ID ${id} appears in multiple S1 QST test titles: ${entries.map(({ spec }) => spec).join(", ")}.`);
      }
    }

    inventory[market] = {
      officialTotal: official.size,
      implementedIds: [...byId.keys()].filter((id) => official.has(id)).sort(),
      implementedCount: [...byId.keys()].filter((id) => official.has(id)).length,
    };
  }

  if (errors.length) {
    throw new Error(`Invalid S1 official QST implementation inventory:\n${errors.join("\n")}`);
  }

  return inventory;
}

module.exports = {
  SUPPORTED_MARKETS,
  collectMarketImplementation,
  officialIdsFromTitle,
  testTitles,
  validateS1OfficialImplementation,
};
