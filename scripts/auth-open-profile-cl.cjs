const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { getClQstConfig } = require('../config/markets/cl');
const config = getClQstConfig();
const slot = String(process.env.CL_AUTH_SLOT || 'primary').toLowerCase();
if (!['primary', 'second'].includes(slot)) throw new Error('Invalid CL auth slot.');
const profile = path.resolve(`playwright/profiles/${config.environment.toLowerCase()}-cl-${slot === 'second' ? 'second' : 'qa'}`);
fs.mkdirSync(profile, { recursive: true });
const args = [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--disable-background-mode', '--start-maximized', '--no-first-run', '--no-default-browser-check', '--hide-crash-restore-bubble', '--new-window', config.setupUrl?.href || config.baseUrl.href];
let command, launchArgs = args;
if (process.platform === 'win32') {
  command = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe')].filter(Boolean).find(candidate => fs.existsSync(candidate));
} else if (process.platform === 'darwin') { command = 'open'; launchArgs = ['-na', 'Google Chrome', '--args', ...args]; }
else command = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find(candidate => spawnSync('which', [candidate], { stdio: 'ignore' }).status === 0);
if (!command) throw new Error('Google Chrome was not found for the dedicated CL profile.');
const chrome = spawn(command, launchArgs, { detached: true, stdio: 'ignore' });
chrome.once('error', () => { console.error('Dedicated CL Chrome could not open.'); process.exitCode = 1; });
chrome.once('spawn', () => { chrome.unref(); console.log(`[auth:login:cl] maximized ${config.environment} ${slot} Chrome opened; refresh will continue automatically.`); });
