import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Riddlestorm is a static site (./site). The tests serve it with a tiny Node server.
// Google Fonts are blocked in the UI tests (see tests/ui/helpers.ts) so they never depend on the network.
const OUT = join(tmpdir(), 'riddlestorm-playwright');
const PORT = 8132;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // the storm animates all the time; too many browsers at once starve each other
  workers: 3,
  expect: { timeout: 10_000 },
  outputDir: join(OUT, 'test-results'),
  reporter: [['list'], ['html', { open: 'never', outputFolder: join(OUT, 'report') }]],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'data', testDir: './tests/data' },
    { name: 'chromium', testDir: './tests/ui', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testDir: './tests/ui', grep: /@mobile/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
