// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: 1,

  reporter: [
    ['html', { open: 'always' }],
    ['list']
  ],

  use: {
    baseURL: 'https://stg2.shop.samsung.com',

    channel: 'chrome',

    headless: false,

    viewport: {
      width: 1440,
      height: 900
    },

    screenshot: 'on',

    // Playwright video requires its bundled FFmpeg. On managed Windows machines
    // where that executable is unavailable/blocked, context teardown fails with
    // `spawn EPERM` after an otherwise valid test. Trace and screenshots remain
    // enabled; opt in to video only after FFmpeg is available.
    video: process.env.PW_VIDEO === '1' ? 'on' : 'off',

    trace: 'retain-on-failure',

    actionTimeout: 15000,

    navigationTimeout: 60000
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
