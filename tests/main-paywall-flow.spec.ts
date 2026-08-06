import { test, expect } from '../src/fixtures/app.fixture';

/**
 * Main flow: land on the site → click the most prominent element (hero "Start watching")
 * → browse free episodes → hit the paywall on the first locked one. Fully anonymous —
 * sign-in isn't a gate on this site (verified independently, see docs/exploration-notes.md);
 * that flow is covered instead by vip-series-instant-paywall.spec.ts. Stops at paywall
 * visibility — no "Get Full Access" click, no payment details entered.
 */
test('user reaches the paywall from the home page on mobile web', { tag: '@smoke' }, async ({ app }) => {
  await test.step('open home page and click the featured series', async () => {
    await app.home.open();
    await app.home.checkUserIsSignedOut();
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
