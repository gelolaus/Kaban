import { defineConfig } from '@playwright/test'

const wantsPreview =
  process.argv.includes('--project=preview') ||
  process.argv.some((arg) => arg === 'preview')

export default defineConfig({
  testDir: 'tests',
  projects: [
    {
      name: 'dev',
      testIgnore: /pwa\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5199',
      },
    },
    {
      name: 'preview',
      testMatch: /pwa\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5198',
      },
    },
  ],
  webServer: wantsPreview
    ? {
        command: 'pnpm build && pnpm preview --port 5198',
        url: 'http://localhost:5198',
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : {
        command: 'pnpm dev',
        url: 'http://localhost:5199',
        reuseExistingServer: true,
      },
})
