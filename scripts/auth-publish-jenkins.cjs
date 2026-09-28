const fs = require("node:fs");
const path = require("node:path");

const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported MX auth environment: ${environment}.`);

const baseUrl = String(process.env.JENKINS_URL || "").replace(/\/$/, "");
const user = String(process.env.JENKINS_USER || "");
const token = String(process.env.JENKINS_API_TOKEN || "");
if (!baseUrl || !user || !token) {
  throw new Error("Jenkins publisher requires JENKINS_URL, JENKINS_USER and JENKINS_API_TOKEN in the local environment.");
}
const parsed = new URL(baseUrl);
if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
  throw new Error("Refusing to publish sensitive session material to Jenkins without HTTPS.");
}

const suffix = environment.toLowerCase();
const bundlePath = path.resolve("playwright/.session-packages", `mx-${suffix}-session-bundle.json`);
if (!fs.existsSync(bundlePath)) throw new Error("Session bundle missing. Run auth:refresh:mx first.");
const credentialId = process.env.JENKINS_MX_SESSION_BUNDLE_CREDENTIAL || `samsung-mx-${suffix}-session-bundle`;
const fileName = path.basename(bundlePath);
const auth = `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
const credentialBase = `/manage/credentials/store/system/domain/_/credential/${encodeURIComponent(credentialId)}`;

async function request(relative, options = {}) {
  return fetch(`${baseUrl}${relative}`, {
    redirect: "manual",
    ...options,
    headers: { Authorization: auth, ...(options.headers || {}) },
  });
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

function credentialJson() {
  return JSON.stringify({
    scope: "GLOBAL",
    id: credentialId,
    description: `Managed by samsung-order-automation auth refresh; ephemeral MX ${environment} session bundle`,
    $class: "org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl",
  });
}

async function submitCredential(relative, crumbHeader) {
  const bytes = fs.readFileSync(bundlePath);
  const form = new FormData();
  form.append("json", credentialJson());
  form.append("file", new Blob([bytes], { type: "application/json" }), fileName);

  const response = await request(relative, {
    method: "POST",
    headers: crumbHeader,
    body: form,
  });
  if (response.status >= 200 && response.status < 400) return;

  const hint = response.status === 403
    ? " Jenkins API user does not have permission to manage this credential through the Credentials UI endpoint."
    : "";
  throw new Error(`Jenkins credential publish failed (HTTP ${response.status}).${hint}`);
}

async function main() {
  const crumbHeader = await getCrumb();
  const exists = await credentialExists();

  if (exists) {
    await submitCredential(`${credentialBase}/updateSubmit`, crumbHeader);
  } else {
    await submitCredential("/manage/credentials/store/system/domain/_/createCredentials", crumbHeader);
  }

  if (!(await credentialExists())) {
    throw new Error(`Jenkins did not expose credential '${credentialId}' after publish.`);
  }

  console.log(`[auth:publish:jenkins] READY · MX ${environment} session bundle ${exists ? "updated" : "created"} in Jenkins credential '${credentialId}'.`);
  console.log("[auth:publish:jenkins] Used the Credentials UI endpoint; Script Console access is not required.");
  console.log("[auth:publish:jenkins] No session contents were logged.");
}

main().catch((error) => {
  console.error(`[auth:publish:jenkins] ${error.message}`);
  process.exitCode = 1;
});
