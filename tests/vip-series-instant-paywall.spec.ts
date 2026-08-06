import { test, expect } from '../src/fixtures/app.fixture';

/**
 * Variation: an alternate, shorter path to the same paywall. "VIP Series" cards paywall
 * episode 1 immediately — no free preview, no episode list needed. Also exercises the
 * top-level-document render path (?from=home), vs. the iframe path other tests use — see
 * VideoPage.resolveScope().
 */
test('a VIP series paywalls its first episode immediately', { tag: '@regression' }, async ({ app }) => {
  await test.step('sign in and open a VIP series', async () => {
    await app.signInFromHome();
    await app.home.openVipSeriesFromGrid();
    await app.video.waitUntilLoaded();
  });

  await test.step('episode 1 is already paywalled', async () => {
    const { current } = await app.video.getEpisodeCounter();
    expect(current, 'VIP series should paywall from episode 1').toBe(1);

    await app.paywall.checkIsVisible();
    await app.paywall.checkGetFullAccessButtonIsVisible();
  });
});
