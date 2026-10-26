const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:9223';
function launchConfiguration(profileDir, { env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  const candidates = [env.PREQA2_CHROME_EXECUTABLE, ...(platform === 'win32' ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  ] : platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'])].filter(Boolean);
  const executable = candidates.find(candidate => exists(candidate));
  if (!executable) throw new Error('Google Chrome is unavailable. Configure PREQA2_CHROME_EXECUTABLE with its executable path.');
  return { executable, args: [`--user-data-dir=${path.resolve(profileDir)}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9223', '--start-maximized', '--disable-background-mode', '--no-first-run', '--no-default-browser-check', '--new-window', 'https://wds.samsung.com'] };
}

async function connectPreqa2Browser({ chromium, profileDir, endpoint = DEFAULT_ENDPOINT, launchIfMissing = true }, {
  launch = spawn, configuration = launchConfiguration, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now,
} = {}) {
  const connect = async () => {
    try {
      const browser = await chromium.connectOverCDP(endpoint, { timeout: 2000 });
      if (!browser.contexts()[0]) { await browser.close(); throw new Error('PreQA2 CDP has no browser context.'); }
      return browser;
    } catch { return null; }
  };
  const existing = await connect();
  if (existing) return existing;
  if (!launchIfMissing || endpoint !== DEFAULT_ENDPOINT) throw new Error('The configured PreQA2 CDP endpoint is unavailable. Start its dedicated Chrome; no alternate profile was launched.');
  fs.mkdirSync(profileDir, { recursive: true });
  const { executable, args } = configuration(profileDir);
  let launchError;
  const child = launch(executable, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.once('error', () => { launchError = true; });
  child.unref();
  const deadline = now() + 30000;
  while (now() < deadline) {
    if (launchError) throw new Error('Dedicated PreQA2 Chrome could not start.');
    const browser = await connect();
    if (browser) return browser;
    await pause(250);
  }
  throw new Error('Dedicated PreQA2 Chrome did not expose port 9223. Its profile may already be occupied by a non-debug browser. No profile or process was removed.');
}

module.exports = { DEFAULT_ENDPOINT, launchConfiguration, connectPreqa2Browser };
