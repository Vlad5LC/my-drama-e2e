import { test, expect } from '../src/fixtures/app.fixture';

/**
 * Main flow: entering the site → clicking the single most prominent element on the
 * page (the hero banner's "Start watching" CTA) → browsing through the free episodes
 * → hitting the paywall on the first locked one. Fully anonymous — no sign-in step.
 *
 * Verified independently (two blind agents driving a live browser with no access to
 * this codebase, plus direct measurement here) that: (1) the hero banner really is the
 * most prominent thing on the page, (2) an anonymous, never-signed-in visitor reaches
 * the exact same paywall a signed-in one does — sign-in is not a gate on this site.
 * Sign-in is exercised instead by `vip-series-instant-paywall.spec.ts`, which needs it
 * for an unrelated reason (its own render path) — so coverage isn't lost, just moved.
 *
 * Stops at paywall visibility — no click on "Get Full Access" and no payment
 * details are ever entered (see README).
 */
test('user reaches the paywall from the home page on mobile web', { tag: '@smoke' }, async ({ app }) => {
  await test.step('open home page and click the featured series', async () => {
    await app.home.open();
    await app.home.checkUserIsSignedOut();
    // Must happen immediately — see HomePage.heroPlayButton's comment on why waiting
    // (e.g. to sign in first) breaks this specific click.
    await app.home.openFeaturedSeriesFromHero();
    await app.video.waitUntilLoaded();
  });

  await test.step('episode 1 of the featured series is playing', async () => {
    const { current, total } = await app.video.getEpisodeCounter();
    expect(current, 'Episode counter should start at episode 1').toBe(1);
    expect(total, 'Series should have more than one episode').toBeGreaterThan(current);
  });

  await test.step('open episodes list and select a locked episode', async () => {
    await app.video.openEpisodesList();
    await app.episodes.openFirstLockedEpisode();
  });

  await test.step('paywall is shown', async () => {
    await app.paywall.checkIsVisible();
    await app.paywall.checkGetFullAccessButtonIsVisible();
  });
});
