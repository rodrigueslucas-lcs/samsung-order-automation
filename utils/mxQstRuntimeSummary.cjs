const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { sanitize } = require("../reporting/evidence/sanitizer");

const TERMINAL_FAILURES = new Set(["failed", "timedOut", "interrupted"]);
const BLOCKED_PATTERN = /SystemParking|maintenance|auth(?:enticated)? state|credentials? (?:are|is) required|EPERM|environment prerequisite/i;
const AUTH_FAILURE_PATTERN = /auth|session|login|logged|credential|account/i;
const ENVIRONMENT_FAILURE_PATTERN = /environment|backend|server|maintenance|unavailable|endpoint|cdp|network|(?:response body|request).*timed out|timeout.*(?:api|backend|delivery)|5\\d\\d\\b/i;
const AUTOMATION_FAILURE_PATTERN = /locator|selector|strict mode|element.*(?:not found|not visible)|playwright|executable doesn.t exist|spawn (?:EPERM|ENOENT)|fixture|test timeout of \\d+ms exceeded/i;

function classifyFailure(status, reason = "") {
  if (status === "SKIPPED-BLOCKED") return "AUTH_BLOCKED";
  if (status !== "FAIL") return null;
  if (AUTH_FAILURE_PATTERN.test(reason)) return "AUTH_BLOCKED";
  if (ENVIRONMENT_FAILURE_PATTERN.test(reason)) return "ENVIRONMENT_ERROR";
  if (AUTOMATION_FAILURE_PATTERN.test(reason)) return "TEST_AUTOMATION_ERROR";
  return "FUNCTIONAL_FAIL";
}

function safeArtifact(filePath, root) {
  if (!filePath) return null;
  const relative = path.relative(root, path.resolve(filePath)).replaceAll("\\", "/");
  if (relative.startsWith("../") || /(^|\/)playwright\/\.auth(\/|$)/i.test(relative)) return null;
  return relative;
}

function resolveGitCommit(root = process.cwd()) {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    return null;
  }
}

function buildMxQstRuntimeSummary(report, {
  officialIds, root = process.cwd(), market = "MX", store = "BASE_STORE",
  suite = "P1/QST", environment = "S1/STG",
  buildNumber = process.env.BUILD_NUMBER || null,
  buildUrl = process.env.BUILD_URL || null,
  gitCommit = resolveGitCommit(root),
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
        failureType: classifyFailure(status, reason),
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
    samId, title: titles[samId] || null, market, store, suite, environment, status: "NOT_RUN", failureType: null, duration: 0,
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
  const targetIds = official;
  const executionMode = targetIds.length < Number(process.env.MX_QST_FULL_P1_COUNT || 29) ? "TARGETED" : "FULL";
  return sanitize({
    schemaVersion: 1, buildNumber, buildUrl, gitCommit, timestamp, market, store, suite, environment,
    executionMode, targetIds, branch: process.env.BRANCH_NAME || process.env.GIT_BRANCH || null,
    executionPolicy: process.env.EXECUTION_MODE || null, summary, tests,
  });
}

function writeRuntimeSummary(filePath, summary) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
}

module.exports = { buildMxQstRuntimeSummary, writeRuntimeSummary, safeArtifact, resolveGitCommit };
