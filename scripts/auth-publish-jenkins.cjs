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
const domainBase = "/manage/credentials/store/system/domain/_";
const credentialBase = `${domainBase}/credential/${encodeURIComponent(credentialId)}`;

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

function credentialPayload() {
  return {
    scope: "GLOBAL",
    id: credentialId,
    description: `Managed by samsung-order-automation auth refresh; ephemeral MX ${environment} session bundle`,
    $class: "org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl",
  };
}

async function submitCredential(relative, crumbHeader, mode) {
  const bytes = fs.readFileSync(bundlePath);
  const form = new FormData();

  // Jenkins Credentials uses a hetero-list named "credentials" in its
  // create/update dialogs. The previous flat JSON payload was accepted by
  // Stapler with a redirect but did not create a credential.
  form.append("json", JSON.stringify({ credentials: credentialPayload() }));
  form.append("file", new Blob([bytes], { type: "application/json" }), fileName);

  const response = await request(relative, {
    method: "POST",
    headers: crumbHeader,
    body: form,
  });

  if (response.status === 403) {
    throw new Error("Jenkins credential publish failed (HTTP 403). Jenkins API user cannot manage credentials through this endpoint.");
  }
  if (response.status >= 400) {
    throw new Error(`Jenkins credential publish failed (HTTP ${response.status}).`);
  }

  const location = response.headers.get("location") || "";
  if (response.status >= 300) {
    const normalized = location.replace(baseUrl, "");
    const expectedParent = `${domainBase}/`;
    const expectedCredential = `${credentialBase}/`;
    if (normalized && normalized !== expectedParent && normalized !== domainBase && normalized !== expectedCredential && normalized !== credentialBase) {
      throw new Error(`Jenkins ${mode} redirected unexpectedly (HTTP ${response.status}, Location: ${normalized}).`);
    }
  }
}

async function main() {
  const crumbHeader = await getCrumb();
  const exists = await credentialExists();

  if (exists) {
    await submitCredential(`${credentialBase}/updateSubmit`, crumbHeader, "update");
  } else {
    await submitCredential(`${domainBase}/createCredentials`, crumbHeader, "create");
  }

  if (!(await credentialExists())) {
    throw new Error(`Jenkins accepted the ${exists ? "update" : "create"} request but credential '${credentialId}' is still absent. No legacy credential was changed.`);
  }

  console.log(`[auth:publish:jenkins] READY · MX ${environment} session bundle ${exists ? "updated" : "created"} in Jenkins credential '${credentialId}'.`);
  console.log("[auth:publish:jenkins] Used the Credentials UI endpoint; Script Console access is not required.");
  console.log("[auth:publish:jenkins] No session contents were logged.");
}

main().catch((error) => {
  console.error(`[auth:publish:jenkins] ${error.message}`);
  process.exitCode = 1;
});
