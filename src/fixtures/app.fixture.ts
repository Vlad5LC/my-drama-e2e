import { test as base } from '@playwright/test';
import os from 'os';
import path from 'path';
import { App } from '../pages/app';
import { TEST_EMAIL_DOMAIN, TEST_USER_EMAIL_OVERRIDE } from '../config/constants';

type WorkerFixtures = { testEmail: string; authStoragePath: string };
type TestFixtures = { app: App };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // One real account per worker, not per test — a worker's tests run sequentially (never a
  // concurrent sign-in race) and each worker gets its own distinct email. TEST_USER_EMAIL_OVERRIDE
  // pins all workers to one fixed email instead — see constants.ts.
  testEmail: [
    async ({}, use) => {
      const email =
        TEST_USER_EMAIL_OVERRIDE ?? `my-drama-qa-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${TEST_EMAIL_DOMAIN}`;
      await use(email);
    },
    { scope: 'worker' },
  ],

  /**
   * Signs in once per worker, saves the cookies to a file — tests that just need a signed-in
   * session as a precondition can load this via `test.use({ storageState: ... })` instead of
   * repeating the sign-in UI. Not wired in globally: vip-series-instant-paywall.spec.ts still
   * does a real sign-in, since it's the one test actually covering that flow.
   */
  authStoragePath: [
    async ({ browser, testEmail }, use, workerInfo) => {
      // newContext() alone doesn't inherit the project's baseURL/device config — pass it
      // explicitly, or relative page.goto() calls fail with no baseURL configured.
      const context = await browser.newContext(workerInfo.project.use);
      const page = await context.newPage();
      const app = new App(page, testEmail);
      await app.signInFromHome();

      const storagePath = path.join(os.tmpdir(), `my-drama-e2e-auth-worker-${workerInfo.workerIndex}.json`);
      await context.storageState({ path: storagePath });
      await context.close();
      await use(storagePath);
    },
    { scope: 'worker' },
  ],

  app: async ({ page, testEmail }, use) => {
    await use(new App(page, testEmail));
  },
});

export { expect } from '@playwright/test';
