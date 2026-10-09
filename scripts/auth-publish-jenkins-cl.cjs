const fs = require("node:fs");
const path = require("node:path");

const environment = String(process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported CL auth environment: ${environment}.`);

const baseUrl = String(process.env.JENKINS_URL || "").replace(/\/$/, "");
const user = String(process.env.JENKINS_USER || "");
const token = String(process.env.JENKINS_API_TOKEN || "");
if (!baseUrl || !user || !token) throw new Error("Jenkins publisher requires JENKINS_URL, JENKINS_USER and JENKINS_API_TOKEN in the local environment.");
let parsed;
try { parsed = new URL(baseUrl); } catch { throw new Error("JENKINS_URL is not a valid URL."); }
if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("JENKINS_URL must not contain credentials, query parameters or fragments.");
if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))) {
  throw new Error("Refusing to publish sensitive session material to Jenkins without HTTPS.");
}

const suffix = environment.toLowerCase();
const bundlePath = path.resolve("playwright/.session-packages", `cl-${suffix}-session-bundle.json`);
if (!fs.existsSync(bundlePath)) throw new Error("CL session bundle missing. Run auth:refresh:cl first.");
const bundleBytes = fs.readFileSync(bundlePath);
let bundle;
try { bundle = JSON.parse(bundleBytes.toString("utf8")); } catch { throw new Error("CL session bundle is not valid JSON."); }
if (bundle.schemaVersion !== 1 || bundle.market !== "CL" || bundle.environment !== environment || !bundle.primary?.storageState || !bundle.primary?.sessionStorage) {
  throw new Error("CL session bundle does not match the selected market, environment or schema.");
}

const credentialId = process.env.JENKINS_CL_SESSION_BUNDLE_CREDENTIAL || `samsung-cl-${suffix}-session-bundle`;
const auth = `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
const domainBase = "/manage/credentials/store/system/domain/_";
const credentialBase = `${domainBase}/credential/${encodeURIComponent(credentialId)}`;

async function request(relative, options = {}) {
  return fetch(`${baseUrl}${relative}`, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: auth, ...(options.headers || {}) },
  });
}
async function credentialExists() {
  const response = await request(`${credentialBase}/api/json`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Unable to inspect Jenkins CL credential (HTTP ${response.status}).`);
  return true;
}
function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function credentialXml() {
  return [
    "<org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>",
    "  <scope>GLOBAL</scope>",
    `  <id>${xmlEscape(credentialId)}</id>`,
    `  <description>Managed by samsung-order-automation auth refresh; ephemeral CL ${environment} session bundle</description>`,
    `  <fileName>${xmlEscape(path.basename(bundlePath))}</fileName>`,
    `  <secretBytes>${bundleBytes.toString("base64")}</secretBytes>`,
    "</org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>",
  ].join("\n");
}
async function main() {
  const response = await request("/crumbIssuer/api/json");
  if (!response.ok) throw new Error(`Jenkins crumb request failed (HTTP ${response.status}).`);
  const crumb = await response.json();
  const exists = await credentialExists();
  const endpoint = exists ? `${credentialBase}/config.xml` : `${domainBase}/createCredentials`;
  const submitted = await request(endpoint, {
    method: "POST",
    headers: { [crumb.crumbRequestField]: crumb.crumb, "Content-Type": "application/xml" },
    body: credentialXml(),
  });
  if (submitted.status === 403) throw new Error("Jenkins credential publish failed (HTTP 403). Jenkins API user cannot manage credentials through the Credentials REST API.");
  if (!submitted.ok) throw new Error(`Jenkins CL credential publish failed (HTTP ${submitted.status}).`);
  if (!(await credentialExists())) throw new Error("Jenkins accepted the request but the CL credential is still absent.");
  console.log(`[auth:publish:jenkins:cl] READY · CL ${environment} session bundle ${exists ? "updated" : "created"} in Jenkins.`);
  console.log("[auth:publish:jenkins:cl] No session contents were logged.");
}
main().catch(() => {
  // Errors from network libraries may contain sensitive request details.
  console.error("[auth:publish:jenkins:cl] Publish failed. Check Jenkins access, API permissions and endpoint availability.");
  process.exitCode = 1;
});
