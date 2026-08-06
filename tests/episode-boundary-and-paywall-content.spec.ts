import { test, expect } from '../src/fixtures/app.fixture';

/**
 * Variation: checks what a full paywall-reaching run doesn't — the free/locked episode
 * boundary is consistent, and the paywall's content is complete (timer, plans, terms,
 * selection). Currency/discount % aren't asserted (vary by geo/A-B test). Signed-in state
 * comes from `authStoragePath` reuse, not a fresh UI sign-in — see app.fixture.ts.
 */
test.use({
  storageState: async ({ authStoragePath }, use) => {
    await use(authStoragePath);
  },
});

test('episode list boundary is consistent and paywall content is complete', { tag: '@regression' }, async ({ app }) => {
  await app.openPlayerAsAuthenticatedWorker();
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
    expect(selectedBefore, 'Exactly one plan should be selected by default').not.toBeNull();
    // Narrowed by the assertion above, but TypeScript doesn't know that — narrow it here too.
    if (selectedBefore === null) throw new Error('Unreachable: selectedBefore was just asserted non-null');

    const otherPlanIndex = selectedBefore === 0 ? 1 : 0;
    await app.paywall.selectPlan(otherPlanIndex);
    await app.paywall.checkPlanIsSelected(otherPlanIndex);
  });
});
