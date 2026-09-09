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

function marketTagsFromTitle(title) {
  const tags = String(title).match(/@(mx|pe|cl|co)\b/gi) || [];
  return [...new Set(tags.map((tag) => tag.slice(1).toUpperCase()))];
}

function collectTitlesFromFiles(files) {
  const entries = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const title of testTitles(source)) {
      entries.push({
        title,
        spec: path.relative(process.cwd(), file).replace(/\\/g, "/"),
      });
    }
  }
  return entries;
}

function collectMarketImplementation(market, { root = path.resolve("tests/s1") } = {}) {
  const code = String(market).toUpperCase();
  if (!SUPPORTED_MARKETS.includes(code)) {
    throw new Error(`Unsupported S1 QST implementation market: ${market}`);
  }

  const cases = [];
  const marketRoot = path.join(root, code.toLowerCase(), "qst");
  for (const entry of collectTitlesFromFiles(walkSpecFiles(marketRoot))) {
    for (const id of officialIdsFromTitle(entry.title)) {
      cases.push({ ...entry, id, source: "market" });
    }
  }

  const sharedRoot = path.join(root, "smb", "qst");
  for (const entry of collectTitlesFromFiles(walkSpecFiles(sharedRoot))) {
    const tags = marketTagsFromTitle(entry.title);
    if (!tags.includes(code)) continue;
    for (const id of officialIdsFromTitle(entry.title)) {
      cases.push({ ...entry, id, source: "shared" });
    }
  }

  return cases;
}

function validateSharedSpecMarketTags({ root = path.resolve("tests/s1") } = {}) {
  const errors = [];
  const sharedRoot = path.join(root, "smb", "qst");
  for (const entry of collectTitlesFromFiles(walkSpecFiles(sharedRoot))) {
    const ids = officialIdsFromTitle(entry.title);
    if (!ids.length) continue;
    const tags = marketTagsFromTitle(entry.title);
    if (tags.length !== 1) {
      errors.push(
        `${entry.spec}: official shared test title must contain exactly one market tag; found ${tags.join(", ") || "none"}.`
      );
    }
  }
  return errors;
}

function validateS1OfficialImplementation() {
  const errors = validateSharedSpecMarketTags();
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

    const implementedIds = [...byId.keys()].filter((id) => official.has(id)).sort();
    inventory[market] = {
      officialTotal: official.size,
      implementedIds,
      implementedCount: implementedIds.length,
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
  marketTagsFromTitle,
  officialIdsFromTitle,
  testTitles,
  validateS1OfficialImplementation,
};
