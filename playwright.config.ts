import { defineConfig } from '@playwright/test';

const browserPath = process.env.COPI_BROWSER_PATH;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3117/copi-autopint-formulario/',
    trace: 'retain-on-failure',
    launchOptions: browserPath ? { executablePath: browserPath } : {},
  },
  webServer: {
    command: 'node tests/serve-static.cjs',
    url: 'http://127.0.0.1:3117/copi-autopint-formulario/',
    reuseExistingServer: false,
  },
});

