import { request } from '@playwright/test';
import { BASE_URL } from './constants';

/** Fails fast with one clear message if BASE_URL is unreachable, instead of every test timing out separately. */
export default async function globalSetup() {
  const context = await request.newContext();
  try {
    const response = await context.get(BASE_URL, { timeout: 10_000 });
    if (!response.ok()) {
      throw new Error(`BASE_URL responded with HTTP ${response.status()}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `BASE_URL is not reachable before running any tests: ${BASE_URL}\n` +
        `Check the URL, your network, or override it — see README "Running against a different environment".\n` +
        `Original error: ${reason}`,
    );
  } finally {
    await context.dispose();
  }
}
