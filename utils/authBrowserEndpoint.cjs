const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function probeOwnedProfile(profileDir, { includeListeners = true } = {}) {
  const shell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  try {
    return JSON.parse(execFileSync(shell, ['-NoProfile', '-NonInteractive', '-File',
      path.resolve(__dirname, '../scripts/auth-probe-browser.ps1'), '-ProfileDirectory', profileDir, ...includeListeners ? [] : ['-SkipListeners']],
    { encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 131072 }));
  } catch (error) { return { known: false, reason: error.code === 'ETIMEDOUT' ? 'PROBE_TIMEOUT' : 'PROBE_FAILED' }; }
}

// Used only after the recorded CDP connection fails. A stale port must never
// cause another --new-window launch into an already running dedicated profile.
async function recoverAuthBrowserEndpoint(profileDir, {
  platform = process.platform, probe = probeOwnedProfile, request = fetch,
  write = fs.writeFileSync,
} = {}) {
  if (platform !== 'win32') return { occupied: false };
  const folder = path.resolve(profileDir);
  if (!/^s[12]-(mx|pe|co|cl)-(qa|second)$/.test(path.basename(folder))) throw Error('Invalid dedicated auth profile.');
  const unavailable = () => Object.assign(new Error('Dedicated auth profile is running but its connection cannot be verified; no additional window was opened.'),
    { code: 'AUTH_BROWSER_ENDPOINT_UNAVAILABLE', exitCode: 73 });
  const snapshot = await probe(folder);
  if (snapshot.known !== true || !Array.isArray(snapshot.browsers)) throw unavailable();
  if (!snapshot.browsers.length) return { occupied: false, absent: true };
  if (snapshot.browsers.length !== 1) throw unavailable();
  const owner = snapshot.browsers[0];
  if (!Number.isInteger(owner.pid) || owner.pid < 1 || typeof owner.createdAt !== 'string' || !Array.isArray(owner.ports)) throw unavailable();
  const endpoints = [];
  for (const port of owner.ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) continue;
    try {
      const response = await request(`http://127.0.0.1:${port}/json/version`, { redirect: 'error', signal: AbortSignal.timeout(2000) });
      if (!response.ok) continue;
      const info = await response.json();
      const endpoint = new URL(info.webSocketDebuggerUrl);
      if (!/^Chrome\//.test(info.Browser || '') || endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1' ||
        endpoint.port !== String(port) || !/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(endpoint.pathname) || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) continue;
      endpoints.push({ endpoint: endpoint.href, port, browserPath: endpoint.pathname });
    } catch { /* A listener alone is not proof of a Chrome endpoint. */ }
  }
  if (endpoints.length !== 1) throw unavailable();
  // Recheck exact profile PID + creation time before replacing stale metadata.
  // The connection uses the verified browser-specific WS path, so a later port
  // reuse rejects the handshake instead of attaching to a different browser.
  const current = await probe(folder, { includeListeners: false });
  const same = current.known === true && current.browsers?.length === 1 && current.browsers[0];
  const found = endpoints[0];
  if (!same || same.pid !== owner.pid || same.createdAt !== owner.createdAt) throw unavailable();
  write(path.join(folder, 'DevToolsActivePort'), `${found.port}\n${found.browserPath}\n`, 'utf8');
  return { occupied: true, endpoint: found.endpoint };
}

module.exports = { recoverAuthBrowserEndpoint };
