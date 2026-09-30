const fs = require("node:fs");
const path = require("node:path");

const environment = String(process.env.PE_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported PE auth environment: ${environment}.`);

const baseUrl = String(process.env.JENKINS_URL || "").replace(/\/$/, "");
const user = String(process.env.JENKINS_USER || "");
const token = String(process.env.JENKINS_API_TOKEN || "");
if (!baseUrl || !user || !token) throw new Error("Jenkins publisher requires JENKINS_URL, JENKINS_USER and JENKINS_API_TOKEN in the local environment.");
const parsed = new URL(baseUrl);
if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
  throw new Error("Refusing to publish sensitive session material to Jenkins without HTTPS.");
}

const suffix = environment.toLowerCase();
const bundlePath = path.resolve("playwright/.session-packages", `pe-${suffix}-session-bundle.json`);
if (!fs.existsSync(bundlePath)) throw new Error("PE session bundle missing. Run auth:refresh:pe first.");

const credentialId = process.env.JENKINS_PE_SESSION_BUNDLE_CREDENTIAL || `samsung-pe-${suffix}-session-bundle`;
const fileName = path.basename(bundlePath);
const auth = `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
const domainBase = "/manage/credentials/store/system/domain/_";
const credentialBase = `${domainBase}/credential/${encodeURIComponent(credentialId)}`;

async function request(relative, options = {}) {
  return fetch(`${baseUrl}${relative}`, { redirect: "manual", ...options, headers: { Authorization: auth, ...(options.headers || {}) } });
}
async function getCrumb() {
  const response = await request("/crumbIssuer/api/json");
  if (!response.ok) throw new Error(`Jenkins crumb request failed (HTTP ${response.status}).`);
  const crumb = await response.json();
  return { [crumb.crumbRequestField]: crumb.crumb };
}
async function credentialExists() {
  const response = await request(`${credentialBase}/api/json`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Unable to inspect Jenkins credential '${credentialId}' (HTTP ${response.status}).`);
  return true;
}
function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function credentialXml() {
  const encodedFile = fs.readFileSync(bundlePath).toString("base64");
  return [
    "<org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>",
    "  <scope>GLOBAL</scope>",
    `  <id>${xmlEscape(credentialId)}</id>`,
    `  <description>${xmlEscape(`Managed by samsung-order-automation auth refresh; ephemeral PE ${environment} session bundle`)}</description>`,
    `  <fileName>${xmlEscape(fileName)}</fileName>`,
    `  <secretBytes>${encodedFile}</secretBytes>`,
    "</org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>",
  ].join("\\n");
}
async function submitCredential(relative, crumbHeader, mode) {
  const response = await request(relative, { method: "POST", headers: { ...crumbHeader, "Content-Type": "application/xml" }, body: credentialXml() });
  if (response.status === 403) throw new Error("Jenkins credential publish failed (HTTP 403). Jenkins API user cannot manage credentials through the Credentials REST API.");
  if (!response.ok) throw new Error(`Jenkins credential ${mode} failed (HTTP ${response.status}).`);
}
async function main() {
  const crumbHeader = await getCrumb();
  const exists = await credentialExists();
  if (exists) await submitCredential(`${credentialBase}/config.xml`, crumbHeader, "update");
  else await submitCredential(`${domainBase}/createCredentials`, crumbHeader, "create");
  if (!(await credentialExists())) throw new Error(`Jenkins accepted the request but credential '${credentialId}' is still absent.`);
  console.log(`[auth:publish:jenkins:pe] READY · PE ${environment} session bundle ${exists ? "updated" : "created"} in Jenkins credential '${credentialId}'.`);
  console.log("[auth:publish:jenkins:pe] No session contents were logged.");
}
main().catch((error) => { console.error(`[auth:publish:jenkins:pe] ${error.message}`); process.exitCode = 1; });
