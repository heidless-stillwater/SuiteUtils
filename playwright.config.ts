import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000, // Increase global test timeout to 45s
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Enable 1 retry locally to absorb transient flakes
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    headless: true, // Run silently in the background
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
