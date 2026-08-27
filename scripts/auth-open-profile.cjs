const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const profileDir = path.resolve("playwright/profiles/st2-peru-qa");
const setupUrl = "https://stg2.shop.samsung.com/getcookie.html";

fs.mkdirSync(profileDir, { recursive: true });

const chromeArguments = [
  `--user-data-dir=${profileDir}`,
  "--remote-debugging-port=0",
  "--disable-background-mode",
  setupUrl,
];

function getChromeLaunch() {
  if (process.platform === "darwin") {
    return {
      command: "open",
      args: [
        "-na",
        "Google Chrome",
        "--args",
        ...chromeArguments,
      ],
    };
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA
        ? path.join(
            process.env.LOCALAPPDATA,
            "Google",
            "Chrome",
            "Application",
            "chrome.exe"
          )
        : null,
    ].filter(Boolean);
    const command = candidates.find((candidate) => fs.existsSync(candidate));

    if (!command) {
      throw new Error(
        `Google Chrome was not found. Checked: ${candidates.join(", ")}`
      );
    }

    return { command, args: chromeArguments };
  }

  const candidates = [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ];
  const command = candidates.find((candidate) => {
    const result = spawnSync("which", [candidate], { stdio: "ignore" });
    return result.status === 0;
  });

  if (!command) {
    throw new Error(
      `Chrome/Chromium was not found. Checked: ${candidates.join(", ")}`
    );
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

  console.log("A normal Chrome window was opened with the dedicated ST2 QA profile.");
  console.log("");
  console.log("Complete these steps manually:");
  console.log("1. Wait for: You can access pages now!");
  console.log("2. Open https://stg2.shop.samsung.com/pe/");
  console.log("3. Use My Profile → Iniciar sesión.");
  console.log("4. Complete Google/FedCM/CAPTCHA/MFA/SMS as a human.");
  console.log("5. Return to ST2 and confirm that Cerrar sesión is available.");
  console.log("6. Keep this dedicated Chrome open and run: npm run auth:export");
  console.log("7. The exporter connects only after login; close Chrome normally after it finishes.");
});
