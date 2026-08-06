import { Page, Locator, expect } from '@playwright/test';
import { BasePage, Scope } from './base.page';
import { EpisodesList } from './components/episodes-list.component';
import { PaywallModal } from './components/paywall.modal';
import { TestIds } from '../config/test-ids';
import { URL_PATTERNS, TIMEOUTS, HANDOFF_FRAME_SELECTOR } from '../config/constants';

/**
 * The /video/{uuid} route sometimes renders its UI inside a same-origin iframe
 * (id="__cover-handoff__", used with ?from=cover) instead of the top-level
 * document — observed when navigating directly to a video URL. Which one
 * happens isn't tied to a specific entry point in a way that's safe to hardcode
 * (measured: the hero banner click currently lands in the top-level document
 * too, not the iframe, contrary to an earlier note here). waitUntilLoaded()
 * detects whichever happened for the current run and points `scope` (and the
 * child components) at the right place — nothing outside this class needs to
 * know the iframe exists at all.
 */
export class VideoPage extends BasePage {
  readonly handoffFrameElement: Locator;
  contentContainer!: Locator;
  episodeCounterBadge!: Locator;
  episodes!: EpisodesList;
  paywall!: PaywallModal;
  /** Which branch resolveScope() picked for this run — only used to word the load-check message accurately. */
  private usedHandoffFrame = false;

  constructor(page: Page) {
    super(page, page);
    this.handoffFrameElement = page.locator(HANDOFF_FRAME_SELECTOR);
  }

  private async resolveScope(): Promise<Scope> {
    // waitFor rejects on a plain timeout in the (expected, majority) case where the page
    // rendered straight into the top-level document and the iframe never shows up at all —
    // that's a normal outcome of this branch, not a real failure, so it's read as "no
    // iframe" rather than re-thrown. A genuinely broken page still fails right after this,
    // when contentContainer's own toBeVisible() check in waitUntilLoaded() has nothing to
    // resolve against in either scope.
    this.usedHandoffFrame = await this.handoffFrameElement
      .waitFor({ state: 'attached', timeout: TIMEOUTS.frame })
      .then(() => true)
      .catch(() => false);
    return this.usedHandoffFrame ? this.page.frameLocator(HANDOFF_FRAME_SELECTOR) : this.page;
  }

  async waitUntilLoaded() {
    await this.verifyUrlContains(URL_PATTERNS.videoPage, 'Not on a video player page');
    this.scope = await this.resolveScope();
    this.contentContainer = this.scope.getByTestId(TestIds.videoPageContent);
    // The badge has a stable data-testid when rendered in the top-level document,
    // but the handoff iframe (?from=cover) runs an older bundle without it —
    // verified manually — so fall back to matching its "Ep. X/Y" text there.
    // Both alternatives are filtered to visible: this page duplicates several nodes for
    // desktop/mobile breakpoints, and an off-screen duplicate's innerText() reads back
    // empty even though the locator itself resolves.
    this.episodeCounterBadge = this.scope
      .getByTestId(TestIds.episodeSelectorButton)
      .or(this.scope.getByText(/Ep\.\s*\d+\s*\/\s*\d+/))
      .filter({ visible: true })
      .first();
    this.episodes = new EpisodesList(this.page, this.scope);
    this.paywall = new PaywallModal(this.page, this.scope);
    await expect(
      this.contentContainer,
      `Player content did not render inside the ${this.usedHandoffFrame ? 'handoff iframe' : 'top-level document'}`,
    ).toBeVisible();
    // For content that's actually playing (a free episode), the episode counter badge and
    // the rest of the player controls don't exist in the DOM at all until the video area is
    // tapped once — verified: badge locator count is 0 before a tap, 1 after. Series that
    // paywall instantly (nothing ever plays) show the badge without this, so only tap when
    // it's not already there — tapping contentContainer while a paywall overlay already
    // covers it risks clicking through to the paywall instead of revealing anything.
    const badgeAlreadyVisible = await this.episodeCounterBadge.isVisible().catch(() => false);
    if (!badgeAlreadyVisible) {
      await this.contentContainer.click();
    }
  }

  async getEpisodeCounter(): Promise<{ current: number; total: number }> {
    const text = await this.episodeCounterBadge.innerText();
    const match = text.match(/Ep\.\s*(\d+)\s*\/\s*(\d+)/);
    if (!match) throw new Error(`Could not parse episode counter from "${text}"`);
    return { current: Number(match[1]), total: Number(match[2]) };
  }

  async openEpisodesList() {
    await this.episodeCounterBadge.click();
    await this.episodes.checkIsOpen();
  }
}
