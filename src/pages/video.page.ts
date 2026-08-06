import { Page, Locator, expect } from '@playwright/test';
import { BasePage, Scope } from './base.page';
import { EpisodesList } from './components/episodes-list.component';
import { PaywallModal } from './components/paywall.modal';
import { TestIds } from '../config/test-ids';
import { URL_PATTERNS, TIMEOUTS, HANDOFF_FRAME_SELECTOR } from '../config/constants';

interface LoadedState {
  contentContainer: Locator;
  episodeCounterBadge: Locator;
  episodes: EpisodesList;
  paywall: PaywallModal;
}

/**
 * The /video/{uuid} route sometimes renders inside a same-origin iframe
 * (id="__cover-handoff__", ?from=cover) instead of the top-level document — not tied to a
 * specific entry point in a way that's safe to hardcode. waitUntilLoaded() detects which
 * happened per run and points `scope` (and child components) at the right place.
 */
export class VideoPage extends BasePage {
  readonly handoffFrameElement: Locator;
  /** Which branch resolveScope() picked — only used to word the load-check message. */
  private usedHandoffFrame = false;
  // Optional (not `!`) so using the page before waitUntilLoaded() fails with a named error
  // via requireState() instead of a bare "Cannot read properties of undefined".
  private state?: LoadedState;

  constructor(page: Page) {
    super(page, page);
    this.handoffFrameElement = page.locator(HANDOFF_FRAME_SELECTOR);
  }

  private requireState(): LoadedState {
    if (!this.state) {
      throw new Error(
        'VideoPage used before waitUntilLoaded() completed — call it (or a composite like App.openPlayerFromHome()) first.',
      );
    }
    return this.state;
  }

  get contentContainer(): Locator {
    return this.requireState().contentContainer;
  }

  get episodeCounterBadge(): Locator {
    return this.requireState().episodeCounterBadge;
  }

  get episodes(): EpisodesList {
    return this.requireState().episodes;
  }

  get paywall(): PaywallModal {
    return this.requireState().paywall;
  }

  private async resolveScope(): Promise<Scope> {
    // A timeout here just means the page rendered top-level with no iframe — the expected
    // majority case, not a failure. A genuinely broken page still fails right after, when
    // contentContainer's own toBeVisible() has nothing to resolve against in either scope.
    this.usedHandoffFrame = await this.handoffFrameElement
      .waitFor({ state: 'attached', timeout: TIMEOUTS.frame })
      .then(() => true)
      .catch(() => false);
    return this.usedHandoffFrame ? this.page.frameLocator(HANDOFF_FRAME_SELECTOR) : this.page;
  }

  async waitUntilLoaded() {
    await this.verifyUrlContains(URL_PATTERNS.videoPage, 'Not on a video player page');
    this.scope = await this.resolveScope();
    const contentContainer = this.scope.getByTestId(TestIds.videoPageContent);
    // The handoff iframe runs an older bundle with no testid on the badge — fall back to its
    // "Ep. X/Y" text. Both filtered to visible: off-screen responsive duplicates exist here too.
    const episodeCounterBadge = this.scope
      .getByTestId(TestIds.episodeSelectorButton)
      .or(this.scope.getByText(/Ep\.\s*\d+\s*\/\s*\d+/))
      .filter({ visible: true })
      .first();
    this.state = {
      contentContainer,
      episodeCounterBadge,
      episodes: new EpisodesList(this.page, this.scope),
      paywall: new PaywallModal(this.page, this.scope),
    };
    await expect(
      contentContainer,
      `Player content did not render inside the ${this.usedHandoffFrame ? 'handoff iframe' : 'top-level document'}`,
    ).toBeVisible();
    // For playing content, player controls (incl. the badge) don't exist until the video area
    // is tapped once. Series that paywall instantly show the badge without a tap — only tap
    // when it's not already there, or tapping a paywall overlay could click through it instead.
    const badgeAlreadyVisible = await episodeCounterBadge.isVisible().catch(() => false);
    if (!badgeAlreadyVisible) {
      await contentContainer.click();
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
