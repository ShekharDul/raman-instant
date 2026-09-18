import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scratch/browser', timeout: 45_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173/raman-instant/', channel: process.platform === 'win32' ? 'chrome' : undefined, headless: true },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/raman-instant/', reuseExistingServer: !process.env.CI },
});
