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
const payload = fs.readFileSync(bundlePath);
const credentialId = process.env.JENKINS_MX_SESSION_BUNDLE_CREDENTIAL || `samsung-mx-${suffix}-session-bundle`;
const fileName = path.basename(bundlePath);
const auth = `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;

async function request(relative, options = {}) {
  const response = await fetch(`${baseUrl}${relative}`, {
    redirect: "error",
    ...options,
    headers: { Authorization: auth, ...(options.headers || {}) },
  });
  return response;
}

async function main() {
  let crumbHeader = {};
  const crumbResponse = await request("/crumbIssuer/api/json").catch(() => null);
  if (crumbResponse?.ok) {
    const crumb = await crumbResponse.json();
    crumbHeader = { [crumb.crumbRequestField]: crumb.crumb };
  }

  const encoded = payload.toString("base64");
  const groovy = `
import jenkins.model.Jenkins
import com.cloudbees.plugins.credentials.CredentialsScope
import com.cloudbees.plugins.credentials.domains.Domain
import com.cloudbees.plugins.credentials.impl.FileCredentialsImpl
import com.cloudbees.plugins.credentials.SystemCredentialsProvider
import hudson.util.SecretBytes

def store = SystemCredentialsProvider.getInstance().getStore()
def domain = Domain.global()
def id = ${JSON.stringify(credentialId)}
def bytes = java.util.Base64.decoder.decode(${JSON.stringify(encoded)})
def replacement = new FileCredentialsImpl(
  CredentialsScope.GLOBAL,
  id,
  "Managed by samsung-order-automation auth refresh; ephemeral MX ${environment} session bundle",
  ${JSON.stringify(fileName)},
  SecretBytes.fromBytes(bytes)
)
def existing = store.getCredentials(domain).find { it.id == id }
def changed = existing ? store.updateCredentials(domain, existing, replacement) : store.addCredentials(domain, replacement)
if (!changed) throw new RuntimeException("Jenkins credential store rejected the session bundle update")
println("SESSION_BUNDLE_UPDATED")
`;

  const body = new URLSearchParams({ script: groovy });
  const response = await request("/scriptText", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...crumbHeader },
    body,
  });
  const result = await response.text();
  if (!response.ok || !result.includes("SESSION_BUNDLE_UPDATED")) {
    const hint = response.status === 403
      ? " Jenkins API user needs permission to run the approved credential-update script."
      : "";
    throw new Error(`Jenkins session publish failed (HTTP ${response.status}).${hint}`);
  }

  console.log(`[auth:publish:jenkins] READY · MX ${environment} session bundle updated in Jenkins credential '${credentialId}'.`);
  console.log("[auth:publish:jenkins] No session contents were logged.");
}

main().catch((error) => {
  console.error(`[auth:publish:jenkins] ${error.message}`);
  process.exitCode = 1;
});
