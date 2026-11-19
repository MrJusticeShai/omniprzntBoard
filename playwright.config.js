// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  retries: 0,
  use: {
    // Serve the single HTML file directly via file:// — no server needed
    baseURL: 'file://' + __dirname + '/index.html',
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    // Suppress Firebase / Cloudinary network errors in tests
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  reporter: [['list']],
});
