const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const profileDir = path.resolve("playwright/profiles/st2-peru-qa");
const setupUrl = "https://stg2.shop.samsung.com/getcookie.html";

fs.mkdirSync(profileDir, { recursive: true });

const chrome = spawn(
  "open",
  [
    "-na",
    "Google Chrome",
    "--args",
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-port=0",
    "--disable-background-mode",
    setupUrl,
  ],
  {
    detached: true,
    stdio: "ignore",
  }
);

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
