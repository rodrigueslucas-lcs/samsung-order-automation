const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "allure-results");
const runtimeFile = path.resolve(process.argv[3] || "runtime-summary.json");

if (!fs.existsSync(resultsDir)) process.exit(0);
const runtime = fs.existsSync(runtimeFile)
  ? JSON.parse(fs.readFileSync(runtimeFile, "utf8"))
  : { tests: [] };
const byId = new Map((runtime.tests || []).map((test) => [test.samId, test]));

function upsertLabel(labels, name, value) {
  const next = (labels || []).filter((label) => label.name !== name);
  if (value) next.push({ name, value });
  return next;
}

function classifyBlocker(text = "") {
  if (/auth|session|login|logged|account|credential/i.test(text)) return "AUTH";
  if (/sku|product|eligible|data|address|order|email/i.test(text)) return "TEST_DATA";
  if (/environment|staging|s1|backend|server|maintenance|timeout|unavailable|endpoint|cdp/i.test(text)) return "ENVIRONMENT";
  return "PREREQUISITE";
}

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith("-result.json"))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const searchable = `${result.name || ""} ${result.fullName || ""}`;
  const samId = searchable.match(/SAM-\d+/)?.[0];
  if (!samId) continue;

  const runtimeTest = byId.get(samId);
  const tags = searchable.match(/@[\w-]+/g) || [];
  const cleanTitle = (runtimeTest?.title || result.name || samId)
    .replace(/\s+@(qst|mx|base-store|safe|registered|guest|destructive)\b/gi, "")
    .trim();

  result.name = cleanTitle.startsWith(samId) ? cleanTitle : `${samId} - ${cleanTitle}`;
  result.labels = upsertLabel(result.labels, "parentSuite", "Samsung SMB Automation");
  result.labels = upsertLabel(result.labels, "suite", "MX · S1 · Base Store");
  result.labels = upsertLabel(result.labels, "subSuite", "P1 / QST");
  result.labels = upsertLabel(result.labels, "epic", "Samsung SMB Commerce");
  result.labels = upsertLabel(result.labels, "feature", "MX Base Store");
  result.labels = upsertLabel(result.labels, "severity", "critical");
  result.labels = upsertLabel(result.labels, "testCaseId", samId);
  for (const tag of tags) result.labels.push({ name: "tag", value: tag.slice(1) });

  if (runtimeTest?.status) result.labels.push({ name: "tag", value: `runtime:${runtimeTest.status}` });
  const reason = runtimeTest?.blockedReason || runtimeTest?.error || "";
  if (runtimeTest?.status === "SKIPPED-BLOCKED") {
    result.labels.push({ name: "tag", value: "BLOCKED" });
    result.labels.push({ name: "tag", value: `blocker:${classifyBlocker(reason)}` });
    result.description = [
      `**Official runtime:** BLOCKED`,
      `**Blocker:** ${classifyBlocker(reason)}`,
      reason ? `**Reason:** ${String(reason).split("\n")[0]}` : null,
      `**Campaign:** MX · S1 · Base Store · P1/QST`,
    ].filter(Boolean).join("  \n");
  } else {
    result.description = [
      `**Official runtime:** ${runtimeTest?.status || "Playwright result"}`,
      `**Campaign:** MX · S1 · Base Store · P1/QST`,
      `**Test case:** ${samId}`,
    ].join("  \n");
  }

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

const environment = [
  "Project=Samsung SMB Automation",
  "Market=MX",
  "Environment=S1/STG",
  "Store=Base Store",
  "Suite=P1/QST",
  `Branch=${process.env.BRANCH_NAME || process.env.GIT_BRANCH || "local"}`,
  `Build=${process.env.BUILD_NUMBER || "local"}`,
].join("\n") + "\n";
fs.writeFileSync(path.join(resultsDir, "environment.properties"), environment);

fs.writeFileSync(path.join(resultsDir, "categories.json"), JSON.stringify([
  { name: "Authentication / session", matchedStatuses: ["failed", "broken"], messageRegex: ".*(auth|session|login|logged|credential).*" },
  { name: "Environment / backend", matchedStatuses: ["failed", "broken"], messageRegex: ".*(environment|backend|server|maintenance|unavailable|endpoint|timeout).*" },
  { name: "Test data / prerequisite", matchedStatuses: ["failed", "broken"], messageRegex: ".*(sku|eligible|test data|address|order|prerequisite).*" },
  { name: "Functional assertion", matchedStatuses: ["failed"] },
], null, 2));

if (process.env.BUILD_URL) {
  fs.writeFileSync(path.join(resultsDir, "executor.json"), JSON.stringify({
    name: "Jenkins",
    type: "jenkins",
    buildName: `Samsung SMB MX QST #${process.env.BUILD_NUMBER || ""}`,
    buildUrl: process.env.BUILD_URL,
    reportUrl: `${process.env.BUILD_URL}Allure_20MX_20QST/`,
  }, null, 2));
}

console.log(`[allure] Enriched MX QST results with Samsung business metadata: ${resultsDir}`);
