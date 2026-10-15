const fs = require('node:fs');
const path = require('node:path');

function credentialId(environment) {
  const target = String(environment || '').toLowerCase();
  if (!['s1', 's2'].includes(target)) throw new Error('Set BACKOFFICE_ENV explicitly to S1 or S2.');
  // Keep the existing IDs; these credentials are shared by all four markets.
  return `samsung-mx-${target}-backoffice-admin`;
}

async function publishBackoffice({ environment, credentialsFile, baseUrl, user, token, fetchImpl = fetch }) {
  const id = credentialId(environment);
  const target = String(environment).toLowerCase();
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('BackOffice credentials require HTTPS or a loopback Jenkins URL.');
  }
  if (!user || !token) throw new Error('Set JENKINS_USER and JENKINS_API_TOKEN.');
  const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  if (typeof credentials.username !== 'string' || !credentials.username.trim() ||
    typeof credentials.password !== 'string' || !credentials.password) {
    throw new Error('The BackOffice file must contain a username and password.');
  }
  const domain = '/manage/credentials/store/system/domain/_';
  const resource = `${domain}/credential/${id}`;
  const auth = `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
  const request = (relative, options = {}) => fetchImpl(`${url.href.replace(/\/$/, '')}${relative}`, {
    redirect: 'manual', signal: AbortSignal.timeout(15000), ...options,
    headers: { Authorization: auth, ...(options.headers || {}) },
  });
  const inspect = async () => {
    const response = await request(`${resource}/api/json`);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`BackOffice credential lookup failed (HTTP ${response.status}).`);
    return true;
  };
  const exists = await inspect();
  const crumbResponse = await request('/crumbIssuer/api/json');
  if (!crumbResponse.ok) throw new Error(`Jenkins crumb failed (HTTP ${crumbResponse.status}).`);
  const crumb = await crumbResponse.json();
  const encoded = Buffer.from(JSON.stringify({ username: credentials.username.trim(), password: credentials.password })).toString('base64');
  const xml = [
    '<org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>',
    '<scope>GLOBAL</scope>', `<id>${id}</id>`,
    `<description>Shared BackOffice ${target.toUpperCase()} Admin for MX PE CO CL</description>`,
    `<fileName>backoffice-admin-${target}.json</fileName>`, `<secretBytes>${encoded}</secretBytes>`,
    '</org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>',
  ].join('\n');
  const response = await request(exists ? `${resource}/config.xml` : `${domain}/createCredentials`, {
    method: 'POST', headers: { [crumb.crumbRequestField]: crumb.crumb, 'Content-Type': 'application/xml' }, body: xml,
  });
  if (!response.ok) throw new Error(`BackOffice credential publish failed (HTTP ${response.status}).`);
  if (!(await inspect())) throw new Error('BackOffice credential was not observable after publication.');
  return { id, environment: target.toUpperCase(), operation: exists ? 'updated' : 'created' };
}

async function main() {
  const environment = process.env.BACKOFFICE_ENV;
  credentialId(environment);
  const result = await publishBackoffice({
    environment,
    credentialsFile: path.resolve(process.env.BACKOFFICE_ADMIN_CREDENTIALS_FILE || `playwright/.auth/backoffice-admin-${environment.toLowerCase()}.json`),
    baseUrl: process.env.JENKINS_URL,
    user: process.env.JENKINS_USER,
    token: process.env.JENKINS_API_TOKEN,
  });
  console.log(`[auth:publish:jenkins:backoffice] READY · ${result.id} ${result.operation}; shared by MX/PE/CO/CL. No credential contents logged.`);
}

if (require.main === module) main().catch(error => {
  console.error(`[auth:publish:jenkins:backoffice] ${error.message}`);
  process.exitCode = 1;
});
module.exports = { credentialId, publishBackoffice };
