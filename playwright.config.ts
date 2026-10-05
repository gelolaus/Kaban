import { defineConfig, devices } from '@playwright/test'

const isPreviewOnly = process.argv.some((a) => a.includes('preview') || a === '--project=preview')

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'dev',
      testMatch: /^(?!.*preview).*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
    {
      name: 'preview',
      testMatch: /.*\.preview\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4173',
      },
    },
  ],
  webServer: isPreviewOnly
    ? {
        command: 'pnpm build && pnpm preview',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : [
        {
          command: 'pnpm dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          // dist/ is produced by `pnpm verify` before `pnpm test:e2e`
          command: 'pnpm preview',
          url: 'http://localhost:4173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
})
