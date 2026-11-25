// @ts-check
import { defineConfig, devices } from '@playwright/test';
import mxQstScope from './utils/mxQstScope.cjs';

const allureEnabled = process.env.ENABLE_ALLURE === '1';
const videoEnabled = process.env.PW_VIDEO === '1';
const traceAll = process.env.PW_TRACE === '1';
const headless = process.env.MX_QST_HEADLESS === '1' ||
  (!!process.env.CI && process.env.MX_QST_HEADLESS !== '0');
const mxOfficialP1 = process.env.TEST_MARKET === 'MX' && process.env.TEST_SUITE === 'P1/QST';
const mxPreqaFirst = mxOfficialP1 && process.env.MX_QST_ENVIRONMENT === 'S2';
const mxPreqaPattern = /SAM-(?:24964|24968|24969)\b/;
const peOfficialP1 = process.env.TEST_MARKET === 'PE' && process.env.TEST_SUITE === 'P1/QST';
const coOfficialP1 = process.env.TEST_MARKET === 'CO' && process.env.TEST_SUITE === 'P1/QST';
const clOfficialP1 = process.env.TEST_MARKET === 'CL' && process.env.TEST_SUITE === 'P1/QST' && process.env.TEST_STORE === 'BASE_STORE';
const { MX_BASE_P1_IDS } = mxQstScope;
const mxActiveP1Pattern = new RegExp(`(?:${MX_BASE_P1_IDS.join('|')})\\b`);

// S2 WMC cases run immediately after preflight, before lengthy payment cases
// consume that independent session. Registered cases retain their next priority.
// Runtime acceptance proved the canonical market-first paths, so no legacy MX
// compatibility matching remains.
const mxAuthenticatedPriorityFiles = [
  '**/markets/mx/qst/base-store/authenticated-safe.spec.js',
  '**/markets/mx/qst/base-store/cart-isolation-safe.spec.js',
  '**/markets/mx/qst/base-store/profile-address-destructive.spec.js',
  '**/markets/mx/qst/base-store/registered-address-safe.spec.js',
  '**/markets/mx/qst/base-store/registered-order.spec.js',
];

const peAuthenticatedPriorityFiles = [
  '**/markets/pe/qst/base-store/authenticated-safe.spec.js',
  '**/markets/pe/qst/base-store/profile-destructive.spec.js',
  '**/markets/pe/qst/base-store/*registered*.spec.js',
];

const chromiumUse = { ...devices['Desktop Chrome'] };
const peProjectUse = { ...chromiumUse };

export default defineConfig({
  testDir: './tests',
  // CL/CO scenario bodies set their own budget; context teardown still uses
  // this default while finalizing video/trace, including under CI load.
  timeout: coOfficialP1 || clOfficialP1 ? 120000 : 30000,
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
          // Keep the report business-readable. Our explicit test.step(...) nodes,
          // curated evidence and attachments remain visible, while low-level
          // Playwright API calls (waitFor/click/fill/locator/etc.) stay in Trace.
          detail: false,
          suiteTitle: false
        }]]
      : []),
    ['./reporting/evidence/SmbEvidenceReporter.js', {
      outputDir: process.env.SMB_EVIDENCE_DIR || 'test-results/evidence'
    }]
  ],

  use: {
    headless,
    // Recording must not silently change the validated CO storefront browser.
    channel: coOfficialP1 || !videoEnabled ? 'chrome' : undefined,
    viewport: { width: 1440, height: 900 },
    screenshot: 'on',
    video: videoEnabled
      ? { mode: 'on', size: { width: 1280, height: 800 } }
      : 'off',
    trace: traceAll ? 'on' : 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 60000
  },

  projects: mxOfficialP1
    ? [
        ...(mxPreqaFirst ? [{
          name: 'mx-preqa-priority',
          testMatch: ['**/markets/mx/qst/base-store/bc-add-safe.spec.js', '**/markets/mx/qst/base-store/official-p1-gaps.spec.js'],
          grep: mxPreqaPattern,
          // Preserve the partition even when a targeted CLI --grep is supplied.
          grepInvert: /SAM-(?!(?:24964|24968|24969)\b)\d+/,
          use: chromiumUse
        }] : []),
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
          ...(mxPreqaFirst ? { grepInvert: mxPreqaPattern } : {}),
          use: chromiumUse
        }
      ]
    : peOfficialP1
      ? [
          {
            name: 'PE · Authenticated first',
            testMatch: peAuthenticatedPriorityFiles,
            use: peProjectUse
          },
          {
            name: 'PE · Storefront + BackOffice',
            testIgnore: peAuthenticatedPriorityFiles,
            use: peProjectUse
          }
        ]
      : [
          {
            name: 'chromium',
            use: chromiumUse
          }
        ]
});
