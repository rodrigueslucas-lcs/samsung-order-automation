const { EVIDENCE_ANNOTATION } = require("./schema");
const { sanitize } = require("./sanitizer");

function recordBusinessEvidence(testInfo, evidence = {}) {
  if (!testInfo?.annotations) {
    throw new TypeError("recordBusinessEvidence requires Playwright testInfo.");
  }
  testInfo.annotations.push({
    type: EVIDENCE_ANNOTATION,
    description: JSON.stringify(sanitize(evidence)),
  });
}

function readBusinessEvidence(annotations = []) {
  return annotations
    .filter(({ type }) => type === EVIDENCE_ANNOTATION)
    .reduce((merged, annotation) => {
      if (!annotation.description) return merged;
      try {
        return { ...merged, ...sanitize(JSON.parse(annotation.description)) };
      } catch {
        return merged;
      }
    }, {});
}

module.exports = { recordBusinessEvidence, readBusinessEvidence };
