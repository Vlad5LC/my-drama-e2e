import { Page, expect } from '@playwright/test';
import { BasePage, Scope } from '../base.page';
import { TestIds, byTestId } from '../../config/test-ids';

/**
 * Episode list drawer inside the video player. Each episode button carries
 * data-episode-index / data-is-current / data-is-locked attributes — the most
 * reliable way to find a locked episode, far more robust than counting tiles.
 */
export class EpisodesList extends BasePage {
  readonly container;
  readonly grid;
  readonly header;
  readonly coverImage;
  readonly titleMobile;
  readonly description;
  readonly likeButton;
  readonly genreTags;
  readonly groupNavigation;
  readonly groupButtons;
  readonly episodeButtons;
  readonly lockedEpisodes;
  readonly unlockedEpisodes;
  readonly currentEpisode;

  constructor(page: Page, scope: Scope) {
    super(page, scope);
    this.container = this.scope.getByTestId(TestIds.episodesContainer);
    this.grid = this.scope.getByTestId(TestIds.episodesGrid);
    this.header = this.scope.getByTestId(TestIds.episodesHeader);
    this.coverImage = this.scope.getByTestId(TestIds.episodesCoverImage);
    this.titleMobile = this.scope.getByTestId(TestIds.episodesTitleMobile);
    this.description = this.scope.getByTestId(TestIds.episodesDescription);
    this.likeButton = this.scope.getByTestId(TestIds.episodesLikeButton);
    this.genreTags = this.scope.getByTestId(TestIds.episodesGenreTags);
    this.groupNavigation = this.scope.getByTestId(TestIds.episodesGroupNavigation);
    this.groupButtons = this.scope.getByTestId(TestIds.episodesGroupButton);
    this.episodeButtons = this.scope.getByTestId(TestIds.episodeButton);
    this.lockedEpisodes = this.scope.locator(byTestId(TestIds.episodeButton, '[data-is-locked="true"]'));
    this.unlockedEpisodes = this.scope.locator(byTestId(TestIds.episodeButton, '[data-is-locked="false"]'));
    this.currentEpisode = this.scope.locator(byTestId(TestIds.episodeButton, '[data-is-current="true"]'));
  }

  async checkIsOpen() {
    await this.checkVisible(this.container, 'Episodes list drawer did not open');
    await this.checkVisible(this.grid, 'Episodes grid is not visible');
  }

  async checkHeaderContent() {
    await this.checkVisible(this.coverImage, 'Episodes list cover image is not visible');
    await this.checkVisible(this.titleMobile, 'Episodes list title is not visible');
    await this.checkVisible(this.description, 'Episodes list description is not visible');
    await this.checkVisible(this.likeButton, 'Episodes list like button is not visible');
    await this.checkVisible(this.genreTags, 'Episodes list genre tags are not visible');
  }

  /** One round-trip to read every episode's lock state via data-is-locked. */
  async getLockStates(): Promise<boolean[]> {
    return this.episodeButtons.evaluateAll((buttons) =>
      buttons.map((button) => (button as HTMLElement).dataset.isLocked === 'true'),
    );
  }

  /** Accepts already-fetched states to avoid a second round-trip and a TOCTOU gap against a caller's own read. */
  async checkLockBoundaryIsMonotonic(states?: boolean[]) {
    const resolvedStates = states ?? (await this.getLockStates());
    const firstLockedIndex = resolvedStates.indexOf(true);
    if (firstLockedIndex === -1) return; // no locked episodes in this group — nothing to check
    const hasUnlockedAfterFirstLocked = resolvedStates.slice(firstLockedIndex).some((locked) => !locked);
    expect(hasUnlockedAfterFirstLocked, 'Found an unlocked episode after the first locked one').toBe(false);
  }

  /**
   * Opens the first locked episode found, switching episode groups (1-20,
   * 21-40, ...) if the currently visible group has none. Clicking a locked
   * episode opens the paywall immediately — no need to watch it to the end.
   */
  async openFirstLockedEpisode() {
    const groupCount = await this.groupButtons.count();
    for (let group = 0; group < Math.max(groupCount, 1); group += 1) {
      if (await this.lockedEpisodes.count()) break;
      if (group < groupCount - 1) {
        const nextGroup = this.groupButtons.nth(group + 1);
        // Same bottom-sheet transform issue as the episode buttons below — use a raw DOM
        // click here too for consistency, since a real mouse click on group tabs hit the
        // same "outside of the viewport" actionability failure during manual verification.
        await nextGroup.dispatchEvent('click');
        // No distinct testid/state flips when a group tab switches, so there's nothing for
        // Playwright's auto-wait to key off before re-reading lockedEpisodes.count() below —
        // a short explicit wait is the pragmatic guard here, same as the existing repo's use
        // of time.sleep() where expect().to_be_visible() has nothing to attach to. This path
        // isn't exercised by the series used in the current tests (its first group already
        // has a locked episode), so it's a defensive best-effort, not something verified live.
        await this.page.waitForTimeout(300);
      }
    }
    const target = this.lockedEpisodes.first();
    await expect(target, 'No locked episode found in the episodes list').toBeVisible();
    await target.scrollIntoViewIfNeeded();
    // The episode drawer is a bottom sheet that keeps a transform applied even at rest,
    // which makes Playwright compute its buttons as outside the viewport and refuse to
    // click even with force. Verified manually that a raw DOM click works fine here, so
    // dispatch one directly instead of simulating a real mouse click at coordinates.
    await target.dispatchEvent('click');
  }

  /**
   * Opens the LAST unlocked episode (not episode 1, which is already playing by default) —
   * proves free content stays playable without the paywall regardless of position, not just
   * that the episode the player happens to start on does.
   */
  async openLastUnlockedEpisode() {
    const target = this.unlockedEpisodes.last();
    await expect(target, 'No unlocked episode found in the episodes list').toBeVisible();
    await target.scrollIntoViewIfNeeded();
    await target.dispatchEvent('click');
  }
}
