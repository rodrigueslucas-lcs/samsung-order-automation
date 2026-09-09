const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { bootstrapPreqa2Market } = require("../utils/preqa2Bootstrap");
const { normalizePreqa2Market } = require("../utils/preqa2Config");
const { PREQA2_HOST, classifyWmcUrl, safePageIdentity } = require("../utils/wmcSessionState");

const WMC_URL = "https://wds.samsung.com";

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function claimBootstrap(profileDir) {
  const ownerFile = path.join(profileDir, ".preqa2-bootstrap-owner.json");
  fs.mkdirSync(profileDir, { recursive: true });
  if (fs.existsSync(ownerFile)) {
    const owner = JSON.parse(fs.readFileSync(ownerFile, "utf8"));
    if (isProcessAlive(owner.pid)) {
      throw new Error(`PreQA2 bootstrap is already running with PID ${owner.pid}; continue that headed browser instead of launching a competing profile instance.`);
    }
    fs.rmSync(ownerFile);
  }
  fs.writeFileSync(ownerFile, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, { flag: "wx" });
  return () => {
    try {
      const owner = JSON.parse(fs.readFileSync(ownerFile, "utf8"));
      if (owner.pid === process.pid) fs.rmSync(ownerFile);
    } catch {}
  };
}

function loadLocalRuntimeCredentials() {
  const localFile = path.resolve(".env.preqa2.local");
  if (!fs.existsSync(localFile)) return {};
  const values = {};
  for (const line of fs.readFileSync(localFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

async function findPreqa2Control(page) {
  const controls = [];
  for (const frame of page.frames()) {
    const candidates = frame
      .getByRole("link", { name: /Preqa2/i })
      .or(frame.getByRole("button", { name: /Preqa2/i }))
      .or(frame.getByText(/^Preqa2$/i))
      .filter({ visible: true });
    for (const candidate of await candidates.all()) {
      controls.push({ candidate, href: (await candidate.getAttribute("href").catch(() => "")) || "" });
    }
  }
  const exactTarget = controls.find(({ href }) => href.includes(PREQA2_HOST));
  if (exactTarget) return exactTarget.candidate;
  if (controls.length === 1) return controls[0].candidate;
  if (controls.length > 1) {
    throw new Error("Multiple Preqa2 controls were visible and none identified the approved PreQA2 host.");
  }
  return null;
}

async function findEmployeeLoginControl(page) {
  for (const frame of page.frames()) {
    const marker = frame.getByText(/AD SSO Login/i).filter({ visible: true }).first();
    if (!(await marker.isVisible().catch(() => false))) continue;
    const section = marker.locator("xpath=ancestor::*[.//a or .//button][1]");
    const login = section
      .getByRole("link", { name: /^Login$/i })
      .or(section.getByRole("button", { name: /^Login$/i }))
      .filter({ visible: true })
      .first();
    if (await login.isVisible().catch(() => false)) return login;
  }
  return null;
}

async function waitForAuthenticatedPreqa2(context, timeoutMs, credentials = {}, runtime = {}) {
  const deadline = Date.now() + timeoutMs;
  let wmcNavigationTriggered = false;
  let employeeLoginTriggered = false;
  let ssoLoginSubmitted = false;
  let waitingForManualAuthReported = false;
  let handledHandshakeFailures = 0;
  const foregroundedMfaPages = new WeakSet();
  let nextDiagnosticAt = 0;
  while (Date.now() < deadline) {
    if ((runtime.handshakeFailures || 0) > handledHandshakeFailures) {
      handledHandshakeFailures = runtime.handshakeFailures;
      if (handledHandshakeFailures > 1) {
        throw new Error("WMC authentication handshake failed twice because its client correlation cookie was missing.");
      }
      const wmc = context.pages().find((page) => classifyWmcUrl(page.url()).startsWith("wmc"))
        || context.pages()[0]
        || await context.newPage();
      console.log("[preqa2] WMC correlation cookie was missing after MFA; restarting the login once from WMC in the same profile.");
      await wmc.goto(WMC_URL, { waitUntil: "domcontentloaded" });
      wmcNavigationTriggered = false;
      employeeLoginTriggered = false;
      ssoLoginSubmitted = false;
      waitingForManualAuthReported = false;
    }
    if (Date.now() >= nextDiagnosticAt) {
      const pages = await Promise.all(context.pages().map(async (page) => {
        const state = classifyWmcUrl(page.url());
        return {
          title: ["sso", "mfa"].includes(state) ? "Corporate authentication" : await page.title().catch(() => "N/A"),
          location: safePageIdentity(page.url()),
          state,
          frames: page.frames().map((frame) => safePageIdentity(frame.url())).filter((value) => value !== "N/A"),
        };
      }));
      const diagnostic = path.resolve("test-results/preqa2/runtime-state.json");
      fs.mkdirSync(path.dirname(diagnostic), { recursive: true });
      fs.writeFileSync(diagnostic, `${JSON.stringify({ observedAt: new Date().toISOString(), pages }, null, 2)}\n`);
      nextDiagnosticAt = Date.now() + 5000;
    }
    for (const page of context.pages()) {
      const state = classifyWmcUrl(page.url());
      if (state === "preqa2" || state === "preqa2-gate") {
        const text = await page.locator("body").innerText().catch(() => "");
        if (state === "preqa2" && !/Please login through WMC/i.test(text)) {
          return page;
        }
      }
      if (state === "mfa") {
        const verificationHeading = page.getByText(/Select Verification Option|Verify Using SingleID Authenticator/i)
          .filter({ visible: true })
          .first();
        const bioOption = page.getByText(/SingleID Authenticator\s*-\s*Bio/i)
          .filter({ visible: true })
          .first();
        const hasInteractiveMfa = await verificationHeading.isVisible().catch(() => false);
        if (hasInteractiveMfa && !foregroundedMfaPages.has(page)) {
          await page.bringToFront();
          foregroundedMfaPages.add(page);
        }
        if (hasInteractiveMfa && !waitingForManualAuthReported) {
          waitingForManualAuthReported = true;
          const canChooseBio = await bioOption.isVisible().catch(() => false);
          console.log(canChooseBio
            ? "[preqa2] MFA visible now: Select Verification Option / SingleID Authenticator - Bio. Waiting for manual interaction."
            : "[preqa2] MFA approval screen is visible now. Waiting for manual approval; no MFA interaction will be automated.");
        }
        continue;
      }
      if (state === "sso") {
        if (!ssoLoginSubmitted && credentials.email && credentials.password) {
          const userId = page.getByPlaceholder(/User ID/i).or(page.getByLabel(/User ID/i)).first();
          const password = page.getByPlaceholder(/Password/i).or(page.getByLabel(/Password/i)).first();
          const login = page.getByRole("button", { name: /^Login$/i }).first();
          if (
            await userId.isVisible().catch(() => false) &&
            await password.isVisible().catch(() => false) &&
            await login.isVisible().catch(() => false)
          ) {
            await userId.fill(credentials.email);
            await password.fill(credentials.password);
            ssoLoginSubmitted = true;
            console.log("[preqa2] Corporate SSO form detected; submitting runtime credentials once.");
            await login.click();
          }
        } else if (!waitingForManualAuthReported && !ssoLoginSubmitted) {
          waitingForManualAuthReported = true;
          console.log("[preqa2] Corporate SSO requires manual sign-in; no credentials were persisted.");
        }
        continue;
      }
      if (state === "wmc-login" && !employeeLoginTriggered) {
        const login = await findEmployeeLoginControl(page);
        if (login) {
          employeeLoginTriggered = true;
          waitingForManualAuthReported = false;
          console.log("[preqa2] WMC session requires corporate authentication; opening Samsung Employees AD SSO.");
          await login.click();
        }
        continue;
      }
      if (state === "wmc" && !wmcNavigationTriggered) {
        const preqa2 = await findPreqa2Control(page);
        if (preqa2) {
          wmcNavigationTriggered = true;
          waitingForManualAuthReported = false;
          console.log("[preqa2] Authenticated WMC detected; opening QA / Preqa2.");
          await preqa2.click();
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for the authenticated Preqa2 tab opened from WMC.");
}

async function main() {
  const profileDir = path.resolve("playwright/profiles/preqa2-smb");
  const releaseBootstrap = claimBootstrap(profileDir);
  const markets = String(process.env.PREQA2_MARKETS || process.env.PREQA2_MARKET || "mx")
    .split(",")
    .map(normalizePreqa2Market);
  const localRuntime = loadLocalRuntimeCredentials();
  const credentials = {
    email: process.env.WMC_SSO_EMAIL || localRuntime.WMC_SSO_EMAIL || "",
    password: process.env.WMC_SSO_PASSWORD || localRuntime.WMC_SSO_PASSWORD || "",
  };
  delete process.env.WMC_SSO_EMAIL;
  delete process.env.WMC_SSO_PASSWORD;
  delete localRuntime.WMC_SSO_EMAIL;
  delete localRuntime.WMC_SSO_PASSWORD;
  let context;
  let ownsContext = false;
  try {
    if (process.env.PREQA2_CDP_URL) {
      const browser = await chromium.connectOverCDP(process.env.PREQA2_CDP_URL);
      context = browser.contexts()[0];
      if (!context) throw new Error("The visible Chrome CDP session has no browser context.");
      console.log("[preqa2] Attached to the user-visible Chrome through local CDP.");
    } else {
      context = await chromium.launchPersistentContext(profileDir, {
        channel: "chrome",
        headless: false,
        viewport: null,
        args: ["--start-maximized", "--disable-background-mode"],
      });
      ownsContext = true;
    }
  } catch (error) {
    releaseBootstrap();
    if (/ProcessSingleton|profile.*(?:in use|locked)|user data directory is already in use/i.test(error.message)) {
      throw new Error("The dedicated PreQA2 profile is already in use. Continue the existing bootstrap if it is alive; otherwise close only the Chrome tree using playwright/profiles/preqa2-smb and rerun. The profile and its session data were not modified.");
    }
    throw error;
  }
  const runtime = { handshakeFailures: 0 };
  const observePage = (page) => {
    page.on("dialog", async (dialog) => {
      if (/cookie value does not exist in client browser/i.test(dialog.message())) {
        runtime.handshakeFailures += 1;
        await dialog.accept();
        return;
      }
      await dialog.dismiss();
    });
  };
  context.pages().forEach(observePage);
  context.on("page", observePage);

  try {
    const wmc = context.pages()[0] || await context.newPage();
    await wmc.goto(WMC_URL, { waitUntil: "domcontentloaded" });
    console.log("[preqa2] Complete WMC -> Samsung Employees -> AD SSO Login -> QA / Preqa2.");
    console.log("[preqa2] Waiting for the authenticated Preqa2 tab; Chrome must remain open.");

    const page = await waitForAuthenticatedPreqa2(
      context,
      Number(process.env.PREQA2_AUTH_TIMEOUT_MS || 7200000),
      credentials,
      runtime
    );
    credentials.email = "";
    credentials.password = "";
    const results = [];
    for (const market of markets) {
      const config = await bootstrapPreqa2Market(page, { environment: { PREQA2_MARKET: market } });
      results.push({
        market: config.market,
        url: page.url(),
        title: await page.title(),
        headings: (await page.getByRole("heading").allTextContents())
          .map((text) => text.trim())
          .filter(Boolean)
          .slice(0, 20),
      });
      console.log(`[preqa2] ${config.market} opened: ${page.url()}`);
    }

    const output = path.resolve("test-results/preqa2/discovery.json");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
    console.log(`[preqa2] Discovery written to ${output}`);
    console.log("[preqa2] Press Ctrl+C after reviewing the storefront; the profile remains Git-ignored.");
    await new Promise((resolve) => context.on("close", resolve));
  } finally {
    if (ownsContext) await context.close().catch(() => {});
    releaseBootstrap();
  }
}

main().catch((error) => {
  console.error(`[preqa2] ${error.message}`);
  process.exitCode = 1;
});
