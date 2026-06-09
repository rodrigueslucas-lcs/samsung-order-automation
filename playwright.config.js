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

    headless: false,

    viewport: {
      width: 1440,
      height: 900
    },

    screenshot: 'on',

    video: 'on',

    trace: 'on',

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