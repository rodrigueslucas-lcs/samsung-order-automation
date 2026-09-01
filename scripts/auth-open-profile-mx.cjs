const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const profileDir = path.resolve("playwright/profiles/s1-mx-qa");
const setupUrl = "https://stg.shop.samsung.com/getcookie.html";

fs.mkdirSync(profileDir, { recursive: true });

const chromeArguments = [
  `--user-data-dir=${profileDir}`,
  "--remote-debugging-port=0",
  "--disable-background-mode",
  "--start-maximized",
  setupUrl,
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
  console.log("A maximized Chrome window was opened with the dedicated S1 MX QA profile.");
  console.log("");
  console.log("Complete these steps manually:");
  console.log("1. Wait for: You can access pages now!");
  console.log("2. Open https://stg.shop.samsung.com/mx/");
  console.log("3. Maximize the browser if the OS did not maximize it automatically.");
  console.log("4. Use My Profile → Iniciar sesión.");
  console.log("5. Complete FedCM/CAPTCHA/MFA/SMS manually.");
  console.log("6. Confirm that Cerrar sesión is available.");
  console.log("7. Keep this dedicated Chrome open.");
  console.log("8. Run: npm run auth:export:mx");
});
