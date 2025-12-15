import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5000 },
  reporter: [['list'], ['github']],
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry'
  }
});
