const fs = require('node:fs');
const path = require('node:path');

function publisherEnvironment(env = process.env, { readFile = fs.readFileSync } = {}) {
  let source = env;
  // Never mix a different server from the shell with a local saved token.
  if (!['JENKINS_URL', 'JENKINS_USER', 'JENKINS_API_TOKEN'].some(key => env[key])) {
    let local;
    try { local = JSON.parse(readFile(path.resolve('playwright/.auth/jenkins-publisher.local.json'), 'utf8')); }
    catch { throw new Error('Jenkins publish requires JENKINS_URL/JENKINS_USER/JENKINS_API_TOKEN or ignored playwright/.auth/jenkins-publisher.local.json.'); }
    source = { JENKINS_URL: local.url, JENKINS_USER: local.user, JENKINS_API_TOKEN: local.apiToken };
  }
  if (!source.JENKINS_URL || !source.JENKINS_USER || !source.JENKINS_API_TOKEN) throw new Error('Incomplete Jenkins publisher configuration; set all three environment values together.');
  let url;
  try { url = new URL(source.JENKINS_URL); } catch { throw new Error('Invalid Jenkins publisher URL.'); }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Jenkins publisher requires HTTPS or local HTTP and a URL without credentials or query parameters.');
  return { ...env, JENKINS_URL: url.href.replace(/\/$/, ''), JENKINS_USER: source.JENKINS_USER, JENKINS_API_TOKEN: source.JENKINS_API_TOKEN };
}

module.exports = { publisherEnvironment };
