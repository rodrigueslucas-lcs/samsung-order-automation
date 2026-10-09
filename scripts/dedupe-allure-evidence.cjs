const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "allure-results");
const PRIMARY_KINDS = new Set(["screenshot", "video", "trace", "context"]);

if (!fs.existsSync(resultsDir)) {
  console.log("[allure-evidence] Results directory does not exist; nothing to process.");
  process.exit(0);
}

function kindOf(attachment = {}) {
  const name = String(attachment.name || "");
  const type = String(attachment.type || "");
  const source = String(attachment.source || "");
  if (/screenshot/i.test(name) || /^image\//i.test(type) || /\.(png|jpe?g|webp|gif)$/i.test(source)) return "screenshot";
  if (/trace/i.test(name) || /\.zip$/i.test(source)) return "trace";
  if (/video/i.test(name) || /^video\//i.test(type) || /\.(webm|mp4)$/i.test(source)) return "video";
  if (/error.context|context/i.test(name) || /\.md$/i.test(source)) return "context";
  return "artifact";
}

function displayName(kind, current) {
  if (kind === "screenshot") return "Screenshot · Final state";
  if (kind === "trace") return "Playwright Trace";
  if (kind === "video") return "Video · Execution";
  if (kind === "context") return "Error Context";
  return current || "Evidence";
}

function sourceFile(attachment = {}) {
  const source = String(attachment.source || "");
  return source ? path.join(resultsDir, source) : null;
}

function sizeOf(attachment = {}) {
  const file = sourceFile(attachment);
  if (!file) return 0;
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function fingerprint(attachment = {}) {
  const source = String(attachment.source || "");
  if (!source) return `meta:${kindOf(attachment)}:${attachment.name || ""}:${attachment.type || ""}`;
  const file = sourceFile(attachment);
  try {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    return `sha256:${hash}`;
  } catch {
    return `source:${source}`;
  }
}

function evidenceScore(candidate) {
  const { attachment, kind, topLevel } = candidate;
  const name = String(attachment.name || "").toLowerCase();
  const generic = /^(screenshot|video|trace|error context|screenshot · final state|video · execution|playwright trace)$/i.test(String(attachment.name || "").trim());
  let score = topLevel ? 20 : 0;

  // Explicit business/failure evidence must beat Playwright's generic automatic
  // attachments. This keeps the most useful screenshot when a TC captures a
  // known defect or a targeted failure state.
  if (!generic) score += 100;
  if (/known.?defect|failure|failed|error|context|final|evidence/.test(name)) score += 60;

  // A browser context can record one video per Page. Prefer the largest file,
  // which is normally the primary storefront journey rather than a short helper
  // tab (Mailinator, popup, etc.). Size is only a tie-breaker for screenshots.
  if (kind === "video") score += Math.min(200, sizeOf(attachment) / (1024 * 1024));
  else score += Math.min(20, sizeOf(attachment) / (1024 * 1024));

  return score;
}

function collectCandidates(result) {
  const candidates = [];
  const collect = (list, topLevel = false) => {
    if (!Array.isArray(list)) return;
    for (const attachment of list) {
      candidates.push({
        attachment,
        kind: kindOf(attachment),
        fingerprint: fingerprint(attachment),
        topLevel,
      });
    }
  };
  const visitSteps = (steps) => {
    if (!Array.isArray(steps)) return;
    for (const step of steps) {
      collect(step.attachments, false);
      visitSteps(step.steps);
    }
  };
  collect(result.attachments, true);
  visitSteps(result.steps);
  return candidates;
}

function selectPrimaryFingerprints(result) {
  const selected = new Map();
  for (const candidate of collectCandidates(result)) {
    if (!PRIMARY_KINDS.has(candidate.kind)) continue;
    const current = selected.get(candidate.kind);
    if (!current || evidenceScore(candidate) > evidenceScore(current)) {
      selected.set(candidate.kind, candidate);
    }
  }
  return new Map([...selected].map(([kind, candidate]) => [kind, candidate.fingerprint]));
}

function normalizeList(list, state) {
  if (!Array.isArray(list)) return [];
  const kept = [];
  for (const attachment of list) {
    const kind = kindOf(attachment);
    const key = fingerprint(attachment);

    if (PRIMARY_KINDS.has(kind)) {
      if (state.primary.get(kind) !== key || state.emittedPrimary.has(kind)) {
        state.removed += 1;
        continue;
      }
      state.emittedPrimary.add(kind);
      attachment.name = displayName(kind, attachment.name);
      kept.push(attachment);
      continue;
    }

    if (state.seenArtifacts.has(key)) {
      state.removed += 1;
      continue;
    }
    state.seenArtifacts.add(key);
    kept.push(attachment);
  }
  return kept;
}

function normalizeSteps(steps, state) {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    step.attachments = normalizeList(step.attachments, state);
    normalizeSteps(step.steps, state);
  }
}

let files = 0;
let removed = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith("-result.json"))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const state = {
    primary: selectPrimaryFingerprints(result),
    emittedPrimary: new Set(),
    seenArtifacts: new Set(),
    removed: 0,
  };

  result.attachments = normalizeList(result.attachments, state);
  normalizeSteps(result.steps, state);

  removed += state.removed;
  files += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

console.log(
  `[allure-evidence] Processed ${files} result file(s); removed ${removed} redundant attachment(s). ` +
  "Published policy: max 1 screenshot, 1 video, 1 trace and 1 error context per test."
);
