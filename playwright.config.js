// @ts-check
import { defineConfig, devices } from '@playwright/test';
import mxQstScope from './utils/mxQstScope.cjs';

const allureEnabled = process.env.ENABLE_ALLURE === '1';
const videoEnabled = process.env.PW_VIDEO === '1';
const headless = process.env.MX_QST_HEADLESS === '1' ||
  (!!process.env.CI && process.env.MX_QST_HEADLESS !== '0');
const mxOfficialP1 = process.env.TEST_MARKET === 'MX' && process.env.TEST_SUITE === 'P1/QST';
const { MX_BASE_P1_IDS } = mxQstScope;
const mxActiveP1Pattern = new RegExp(`(?:${MX_BASE_P1_IDS.join('|')})\\b`);

// Authenticated/registered scenarios are intentionally declared as the first
// MX P1 project. With workers=1 Playwright executes this project first, keeping
// session-sensitive cases at the front of the campaign. The remaining project
// is intentionally NOT a dependency: failures in auth-priority must be reported
// without preventing the other official P1 scenarios from running.
const mxAuthenticatedPriorityFiles = [
  '**/markets/mx/qst/base-store/authenticated-safe.spec.js',
  '**/markets/mx/qst/base-store/cart-isolation-safe.spec.js',
  '**/markets/mx/qst/base-store/profile-address-destructive.spec.js',
  '**/markets/mx/qst/base-store/registered-address-safe.spec.js',
  '**/markets/mx/qst/base-store/registered-order.spec.js',
];

const chromiumUse = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: './tests',

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: 1,

  captureGitInfo: { commit: false, diff: false },

  reporter: [
    ['html', { open: 'never', outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || 'playwright-report' }],
    ['list'],
    ...(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE
      ? [['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE }]]
      : []),
    ...(allureEnabled
      ? [['allure-playwright', {
          resultsDir: process.env.ALLURE_RESULTS_DIR || 'allure-results',
          detail: false,
          suiteTitle: false
        }]]
      : []),
    ['./reporters/evidence/SmbEvidenceReporter.js', {
      outputDir: process.env.SMB_EVIDENCE_DIR || 'test-results/evidence'
    }]
  ],

  use: {
    // Jenkins runs as a Windows service and must not rely on an interactive
    // desktop. Respect the pipeline's headless flag; CI defaults to headless
    // unless MX_QST_HEADLESS=0/--headed explicitly opts out.
    headless,

    // Chrome-for-Testing produced blank video frames on the Windows service.
    // When video is requested use Playwright's bundled Chromium/headless-shell,
    // installed by the pipeline together with its matching FFmpeg build.
    channel: videoEnabled ? undefined : 'chrome',

    viewport: {
      width: 1440,
      height: 900
    },

    screenshot: 'on',

    video: videoEnabled
      ? { mode: 'on', size: { width: 1280, height: 800 } }
      : 'off',

    trace: 'retain-on-failure',

    actionTimeout: 15000,

    navigationTimeout: 60000
  },

  projects: mxOfficialP1
    ? [
        {
          name: 'mx-auth-priority',
          testMatch: mxAuthenticatedPriorityFiles,
          grep: mxActiveP1Pattern,
          use: chromiumUse
        },
        {
          name: 'chromium',
          testIgnore: mxAuthenticatedPriorityFiles,
          grep: mxActiveP1Pattern,
          use: chromiumUse
        }
      ]
    : [
        {
          name: 'chromium',
          use: chromiumUse
        }
      ]
});
