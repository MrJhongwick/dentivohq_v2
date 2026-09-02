import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tooling/e2e',
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'pnpm --filter @dentivohq/landing exec astro dev --host=127.0.0.1 --port=4321',
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm --filter @dentivohq/dashboard exec vite --host=127.0.0.1 --port=5173',
      url: 'http://127.0.0.1:5173/dashboard-preview',
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
  ]
});
