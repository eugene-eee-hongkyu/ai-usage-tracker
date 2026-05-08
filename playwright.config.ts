import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(resolve(__dirname, '.env.local'));

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  reporter: [
    ['html', { outputFolder: 'playwright-report/detail', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env.ANCHOR_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: process.env.SKIP_AUTH_SETUP ? [] : ['setup'],
      testIgnore: '**/auth.setup.ts',
    },
  ],
});
