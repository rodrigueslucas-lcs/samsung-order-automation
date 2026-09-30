const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const {
  CO_AUTH_SESSION_STORAGE_PATH,
  getCoAuthState,
  markCoAuthStateVerified,
} = require("../utils/coAuthState");
const { getCoQstConfig } = require("../config/markets/co");

function writeJsonSecurely(destination, value) {
  const temporary = `${destination}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, destination);
}

async function safeDiagnostic(page) {
  let url = "unavailable";
  let title = "unavailable";
  let readyState = "unavailable";
  let bodyChars = 0;
  let profileButtons = 0;
  try {
    const current = new URL(page.url());
    url = `${current.origin}${current.pathname}`;
  } catch {}
  try { title = (await page.title()).slice(0, 120); } catch {}
  try {
    const dom = await page.evaluate(() => ({
      readyState: document.readyState,
      bodyChars: document.body?.innerText?.length || 0,
    }));
    readyState = dom.readyState;
    bodyChars = dom.bodyChars;
    profileButtons = await page.getByRole("button", { name: "My Profile", exact: true }).count();
  } catch {}
  return { url, title, readyState, bodyChars, profileButtons };
}

async function verifyCoAuthentication() {
  const config = getCoQstConfig();
  const auth = getCoAuthState();
  const ci = ["1", "true"].includes(String(process.env.CI || "").toLowerCase());
  const browser = await chromium.launch({
    channel: "chrome",
    headless: ci,
    args: ci ? [] : ["--start-maximized"],
  });

  try {
    const context = await browser.newContext({
      storageState: auth.requireAuthState(),
      viewport: ci ? { width: 1440, height: 900 } : null,
    });
    await auth.applyAuthSessionStorage(context);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(ci ? 120000 : 60000);
    page.setDefaultTimeout(ci ? 90000 : 60000);

    console.log(`[auth:verify:co] fresh ${config.environment} CO browser context created`);
    console.log(`[auth:verify:co] target: ${config.environment} | CO | ${config.baseUrl.hostname}`);
    console.log(`[auth:verify:co] runtime: ${ci ? "CI Chrome | headless" : "local Chrome | headed"}`);

    let lastError;
    const attempts = ci ? 3 : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await auth.validateAuthenticatedSession(page);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        const diagnostic = await safeDiagnostic(page);
        console.error(`[auth:verify:co] attempt ${attempt}/${attempts} diagnostic url: ${diagnostic.url}`);
        console.error(`[auth:verify:co] attempt ${attempt}/${attempts} diagnostic title: ${diagnostic.title}`);
        console.error(
          `[auth:verify:co] attempt ${attempt}/${attempts} diagnostic document: readyState=${diagnostic.readyState} bodyChars=${diagnostic.bodyChars} myProfileButtons=${diagnostic.profileButtons}`
        );

        const message = String(error?.message || error);
        const storefrontDidNotRender = /storefront did not render My Profile/i.test(message);
        const runtimeBlank = storefrontDidNotRender && Number(diagnostic.bodyChars) < 100;
        if (!ci || !runtimeBlank || attempt === attempts) {
          if (ci && runtimeBlank) {
            const runtimeError = new Error(
              `CO ${config.environment} storefront did not render usable content in Jenkins CI Chrome after ${attempts} attempts; authentication could not be evaluated. This is a CI/storefront runtime failure, not proof that the saved Samsung session expired.`
            );
            runtimeError.name = "CoStorefrontRuntimeError";
            throw runtimeError;
          }
          throw error;
        }

        console.warn(`[auth:verify:co] blank storefront runtime detected; retrying with a fresh navigation (${attempt + 1}/${attempts})`);
        await page.waitForTimeout(3000);
        try { await page.goto("about:blank"); } catch {}
      }
    }
    if (lastError) throw lastError;

    console.log(`[auth:verify:co] authenticated profile action validated in a fresh ${config.environment} CO context`);

    await context.storageState({ path: auth.requireAuthState(), indexedDB: true });
    const sessionStorage = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return [key, window.sessionStorage.getItem(key)];
        }).filter(([key]) => key !== null)
      )
    );
    writeJsonSecurely(CO_AUTH_SESSION_STORAGE_PATH, sessionStorage);
    markCoAuthStateVerified();
    console.log(`[auth:verify:co] refreshed ${config.environment} CO session state preserved and marked as verified for the test fixture`);
  } finally {
    await browser.close();
  }
}

verifyCoAuthentication().catch((error) => {
  const summary = String(error.message || "unknown error")
    .split("\n", 1)[0]
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=<redacted>");
  console.error(`[auth:verify:co] ${error.name}: ${summary}`);
  process.exitCode = 1;
});
