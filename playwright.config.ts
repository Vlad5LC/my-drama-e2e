import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { BASE_URL } from './src/config/constants';

/**
 * The task requires testing the MOBILE WEB version only — no desktop project
 * is defined on purpose. Both projects use real Playwright device descriptors
 * (viewport, UA, isMobile, hasTouch) rather than a resized desktop window.
 */

export default defineConfig({
  testDir: './tests',
  globalSetup: './src/config/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'mobile-safari-iphone13',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'mobile-chrome-pixel5',
      use: {
        ...devices['Pixel 5'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
});
