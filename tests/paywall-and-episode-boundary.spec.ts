import { test, expect } from '../src/fixtures/app.fixture';

/**
 * Variation: verifies things a full paywall-reaching run doesn't check on its own —
 * the free/locked episode boundary (data-is-locked attributes), that free content
 * actually stays playable without the paywall (the negative case — every other test
 * only proves the positive, "locked episode → paywall"), and the paywall's actual
 * content (timer, three priced plans, terms checkbox). Currency and discount
 * percentage are not asserted since they can vary by geo/A-B test.
 */
test('episode list boundary is consistent and paywall content is complete', { tag: '@regression' }, async ({ app }) => {
  await app.openPlayerFromHome();
  await app.video.openEpisodesList();
  await app.episodes.checkHeaderContent();

  await test.step('free episodes precede locked ones', async () => {
    const states = await app.episodes.getLockStates();
    expect(states.length, 'Episodes grid should not be empty').toBeGreaterThan(0);
    expect(states[0], 'First episode in the grid should be unlocked').toBe(false);
    expect(states.includes(true), 'Series should have at least one locked episode').toBe(true);
    await app.episodes.checkLockBoundaryIsMonotonic(states);
    await expect(app.episodes.currentEpisode, 'Exactly one episode should be marked as current').toHaveCount(1);
  });

  await test.step('opening a locked episode shows the paywall', async () => {
    await app.episodes.openFirstLockedEpisode();
    await app.paywall.checkIsVisible();
  });

  await test.step('paywall lists a timer, three priced plans and terms', async () => {
    await app.paywall.checkDiscountTimerIsVisible();
    await app.paywall.checkPlansAreListed(3);
    await app.paywall.checkEachPlanHasPrice();
    await app.paywall.checkTermsCheckboxIsVisible();

    const selectedBefore = await app.paywall.getSelectedPlanIndex();
    expect(selectedBefore, 'Exactly one plan should be selected by default').toBeGreaterThanOrEqual(0);

    const otherPlanIndex = selectedBefore === 0 ? 1 : 0;
    await app.paywall.selectPlan(otherPlanIndex);
    await app.paywall.checkPlanIsSelected(otherPlanIndex);
  });
});

test('a free episode plays without triggering the paywall', { tag: '@regression' }, async ({ app }) => {
  await app.openPlayerFromHome();
  await app.video.openEpisodesList();
  // The last unlocked episode, not episode 1 (already playing by default) — proves free
  // content stays playable regardless of position, not just that the starting episode does.
  await app.episodes.openLastUnlockedEpisode();
  await app.paywall.checkIsNotVisible();
  await expect(app.video.contentContainer, 'Player content is not visible for a free episode').toBeVisible();
});
