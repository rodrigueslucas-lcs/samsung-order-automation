const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { getPeS1QstConfig } = require("../config/markets/pe");

const config = getPeS1QstConfig();
const profileDir = path.resolve("playwright/profiles/s1-pe-qa");
const launchUrl = config.setupUrl?.href || config.baseUrl.href;

fs.mkdirSync(profileDir, { recursive: true });

const chromeArguments = [
  `--user-data-dir=${profileDir}`,
  "--remote-debugging-port=0",
  "--disable-background-mode",
  "--start-maximized",
  launchUrl,
];

function getChromeLaunch() {
  if (process.platform === "darwin") {
    return {
      command: "open",
      args: ["-na", "Google Chrome", "--args", ...chromeArguments],
    };
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
        : null,
    ].filter(Boolean);
    const command = candidates.find((candidate) => fs.existsSync(candidate));
    if (!command) {
      throw new Error(`Google Chrome was not found. Checked: ${candidates.join(", ")}`);
    }
    return { command, args: chromeArguments };
  }

  const candidates = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
  const command = candidates.find((candidate) =>
    spawnSync("which", [candidate], { stdio: "ignore" }).status === 0
  );
  if (!command) {
    throw new Error(`Chrome/Chromium was not found. Checked: ${candidates.join(", ")}`);
  }
  return { command, args: chromeArguments };
}

const launch = getChromeLaunch();
const chrome = spawn(launch.command, launch.args, {
  detached: true,
  stdio: "ignore",
});

chrome.once("error", (error) => {
  console.error(`Unable to open Google Chrome: ${error.message}`);
  process.exitCode = 1;
});

chrome.once("spawn", () => {
  chrome.unref();
  console.log("A maximized Chrome window was opened with the dedicated S1 PE QA profile.");
  console.log("");
  console.log("Complete these steps manually:");
  if (config.setupUrl) {
    console.log(`1. Complete/confirm storefront setup at ${config.setupUrl.origin}${config.setupUrl.pathname}.`);
    console.log(`2. Open ${config.baseUrl.href}.`);
  } else {
    console.log(`1. Confirm ${config.baseUrl.href} is accessible with the required staging/bootstrap state.`);
    console.log("2. If a separate cookie/bootstrap page is required, reopen with PE_SETUP_URL configured.");
  }
  console.log("3. Use My Profile and complete the legitimate Samsung login.");
  console.log("4. Complete CAPTCHA/MFA/FedCM manually if requested.");
  console.log("5. Confirm that the authenticated profile/logout action is visible.");
  console.log("6. Keep this dedicated Chrome open.");
  console.log("7. Run: npm run auth:export:pe");
});
