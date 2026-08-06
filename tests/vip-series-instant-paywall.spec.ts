import { test, expect } from '../src/fixtures/app.fixture';

/**
 * Variation: an alternate, shorter path to the same paywall. Series under the
 * home page's "VIP Series" section are paywalled from episode 1 — no free
 * preview, no episode list interaction needed. Verified by hand: clicking
 * such a card immediately shows the paywall modal.
 *
 * This also exercises VideoPage's other rendering path: entering from the
 * home grid (?from=home) renders straight into the top-level document,
 * whereas the main flow test (entering via a direct video URL) goes through
 * the ?from=cover handoff iframe — see VideoPage.resolveScope().
 */
test('a VIP series paywalls its first episode immediately', { tag: '@regression' }, async ({ app }) => {
  await app.signInFromHome();
  await app.home.openVipSeriesFromGrid();
  await app.video.waitUntilLoaded();

  const { current } = await app.video.getEpisodeCounter();
  expect(current, 'VIP series should paywall from episode 1').toBe(1);

  await app.paywall.checkIsVisible();
  await app.paywall.checkGetFullAccessButtonIsVisible();
});
