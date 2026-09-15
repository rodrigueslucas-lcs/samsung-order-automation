const fs = require("node:fs");
const path = require("node:path");
const { sanitize } = require("../reporters/evidence/sanitizer");

const TERMINAL_FAILURES = new Set(["failed", "timedOut", "interrupted"]);
const BLOCKED_PATTERN = /SystemParking|maintenance|auth(?:enticated)? state|credentials? (?:are|is) required|EPERM|environment prerequisite/i;

function safeArtifact(filePath, root) {
  if (!filePath) return null;
  const relative = path.relative(root, path.resolve(filePath)).replaceAll("\\", "/");
  if (relative.startsWith("../") || /(^|\/)playwright\/\.auth(\/|$)/i.test(relative)) return null;
  return relative;
}

function buildMxQstRuntimeSummary(report, {
  officialIds, root = process.cwd(), market = "MX", store = "BASE_STORE",
  suite = "P1/QST", environment = "S1/STG",
  buildNumber = process.env.BUILD_NUMBER || null,
  gitCommit = process.env.GIT_COMMIT || null,
  timestamp = report?.stats?.startTime || new Date().toISOString(),
  titles = {},
} = {}) {
  const official = [...officialIds];
  const officialSet = new Set(official);
  const found = new Map();
  const visit = (node) => {
    for (const spec of node.specs || []) {
      const samIds = [...new Set((spec.title || "").match(/SAM-\d+/g) || [])].filter((id) => officialSet.has(id));
      if (!samIds.length) continue;
      const tests = spec.tests || [];
      const results = tests.flatMap((entry) => entry.results || []);
      const statuses = results.map((result) => result.status);
      const annotations = tests.flatMap((entry) => entry.annotations || []);
      const errors = results.flatMap((result) => result.errors || []).map((error) => error.message).filter(Boolean);
      const reason = [...annotations.map((item) => item.description), ...errors].filter(Boolean).join(" | ");
      const failed = statuses.some((status) => TERMINAL_FAILURES.has(status));
      const blocked = (statuses.length > 0 && statuses.every((status) => status === "skipped")) || (failed && BLOCKED_PATTERN.test(reason));
      const status = !statuses.length ? "NOT_RUN" : blocked ? "SKIPPED-BLOCKED" : failed ? "FAIL" : "PASS";
      const last = results.at(-1) || {};
      const attachments = results.flatMap((result) => result.attachments || []).map((attachment) => ({
        name: attachment.name || null,
        contentType: attachment.contentType || null,
        path: safeArtifact(attachment.path, root),
      })).filter((attachment) => attachment.path);
      for (const samId of samIds) found.set(samId, sanitize({
        samId, title: spec.title, market, store, suite, environment, status,
        duration: results.reduce((sum, result) => sum + (result.duration || 0), 0),
        error: status === "FAIL" ? errors.join(" | ") || null : null,
        blockedReason: status === "SKIPPED-BLOCKED" ? reason || "Test was skipped by an explicit runtime prerequisite." : null,
        testFile: spec.file ? safeArtifact(spec.file, root) : null,
        attachments, startTime: last.startTime || null, buildNumber, gitCommit, timestamp,
      }));
    }
    for (const child of node.suites || []) visit(child);
  };
  for (const suiteNode of report.suites || []) visit(suiteNode);

  const tests = official.map((samId) => found.get(samId) || {
    samId, title: titles[samId] || null, market, store, suite, environment, status: "NOT_RUN", duration: 0,
    error: null, blockedReason: "Official TC was not present in this execution result.", testFile: null, attachments: [], startTime: null,
    buildNumber, gitCommit, timestamp,
  });
  const count = (status) => tests.filter((entry) => entry.status === status).length;
  const summary = {
    official: official.length,
    executed: count("PASS") + count("FAIL"),
    passed: count("PASS"), failed: count("FAIL"), blocked: count("SKIPPED-BLOCKED"), notRun: count("NOT_RUN"),
    passRate: count("PASS") + count("FAIL") ? count("PASS") / (count("PASS") + count("FAIL")) * 100 : 0,
    duration: tests.reduce((sum, entry) => sum + entry.duration, 0),
  };
  if (summary.passed + summary.failed + summary.blocked + summary.notRun !== summary.official) throw new Error("MX QST runtime summary does not reconcile with official scope.");
  return sanitize({ schemaVersion: 1, buildNumber, gitCommit, timestamp, market, store, suite, environment, summary, tests });
}

function writeRuntimeSummary(filePath, summary) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
}

module.exports = { buildMxQstRuntimeSummary, writeRuntimeSummary, safeArtifact };
