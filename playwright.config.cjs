const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm start -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI }
});
