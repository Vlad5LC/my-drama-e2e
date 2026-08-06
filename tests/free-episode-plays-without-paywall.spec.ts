import { test, expect } from '../src/fixtures/app.fixture';

/**
 * Variation: the negative case — every other test only proves "locked episode → paywall".
 * Uses the *last* unlocked episode (not episode 1) so it's not just proving the starting
 * episode works. Signed-in state comes from `authStoragePath` reuse — see app.fixture.ts.
 */
test.use({
  storageState: async ({ authStoragePath }, use) => {
    await use(authStoragePath);
  },
});

test('a free episode plays without triggering the paywall', { tag: '@regression' }, async ({ app }) => {
  await app.openPlayerAsAuthenticatedWorker();
  await app.video.openEpisodesList();
  await app.episodes.openLastUnlockedEpisode();
  await app.paywall.checkIsNotVisible();
  await expect(app.video.contentContainer, 'Player content is not visible for a free episode').toBeVisible();
});
