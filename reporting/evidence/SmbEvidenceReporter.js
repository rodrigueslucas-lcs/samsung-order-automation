const fs = require("node:fs");
const path = require("node:path");
const { readBusinessEvidence } = require("./evidenceContext");
const { sanitize } = require("./sanitizer");
const { SCHEMA_VERSION } = require("./schema");

class SmbEvidenceReporter {
  constructor(options = {}) {
    this.outputDir = path.resolve(options.outputDir || "test-results/evidence");
    this.tests = [];
    this.startedAt = null;
  }

  onBegin() {
    this.startedAt = new Date();
    this.tests = [];
  }

  onTestEnd(test, result) {
    const metadata = readBusinessEvidence(result.annotations || test.annotations);
    const attachments = (result.attachments || []).map(({ name, contentType, path: filePath }) => ({
      name,
      contentType,
      path: filePath ? path.resolve(filePath) : null,
    }));
    const byType = (pattern) => attachments.filter(({ name, contentType }) =>
      pattern.test(`${name || ""} ${contentType || ""}`));
    const project = test.parent?.project?.();

    this.tests.push(sanitize({
      ...metadata,
      testId: test.id,
      title: test.title,
      titlePath: test.titlePath(),
      specFile: path.resolve(test.location.file),
      project: project?.name || null,
      worker: result.workerIndex,
      retry: result.retry,
      retries: result.retry,
      startTime: result.startTime?.toISOString?.() || null,
      durationMs: result.duration,
      result: result.status,
      error: result.error ? {
        message: result.error.message,
        stack: result.error.stack,
        snippet: result.error.snippet,
      } : null,
      flaky: result.status === "passed" && result.retry > 0,
      annotations: (result.annotations || test.annotations || [])
        .filter(({ type }) => type !== "smb-evidence"),
      screenshots: byType(/screenshot|image\//i),
      trace: byType(/trace|application\/zip/i)[0] || null,
      video: byType(/video/i)[0] || null,
      attachments,
    }));
  }

  async onEnd() {
    const endedAt = new Date();
    const counts = { passed: 0, failed: 0, skipped: 0, timedOut: 0, interrupted: 0 };
    const finalResults = [...this.tests.reduce(
      (byTest, result) => byTest.set(result.testId || result.titlePath.join(" > "), result),
      new Map()
    ).values()];
    for (const test of finalResults) {
      if (Object.hasOwn(counts, test.result)) counts[test.result] += 1;
      else if (test.result === "timedOut") counts.timedOut += 1;
    }
    const execution = sanitize({
      timestamp: this.startedAt?.toISOString() || endedAt.toISOString(),
      completedAt: endedAt.toISOString(),
      environment: process.env.TEST_ENV || process.env.BACKOFFICE_ENV || null,
      release: process.env.TEST_RELEASE || null,
      cycle: process.env.TEST_CYCLE || null,
    });
    const summary = {
      total: finalResults.length,
      attempts: this.tests.length,
      ...counts,
      durationMs: Math.max(0, endedAt.getTime() - (this.startedAt?.getTime() || endedAt.getTime())),
      flaky: this.tests.filter(({ flaky }) => flaky).length,
    };
    const evidence = { schemaVersion: SCHEMA_VERSION, execution, summary, tests: this.tests };

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, "qst-evidence.json"), JSON.stringify(evidence, null, 2));
    fs.writeFileSync(path.join(this.outputDir, "qst-summary.json"), JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      execution,
      summary,
    }, null, 2));
  }
}

module.exports = SmbEvidenceReporter;
