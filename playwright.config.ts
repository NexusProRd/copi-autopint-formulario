import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx next dev -p 3100',
    url: 'http://localhost:3100/copi-autopint-formulario/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
