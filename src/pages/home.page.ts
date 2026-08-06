import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { TIMEOUTS, URL_PATTERNS } from '../config/constants';
import { TestIds } from '../config/test-ids';

export class HomePage extends BasePage {
  readonly signInButton;
  readonly vipSeriesPlayButton;
  readonly regularSeriesPlayButton;
  readonly heroPlayButtons;
  readonly avatarLink;

  constructor(page: Page) {
    super(page);
    this.signInButton = this.scope.getByTestId(TestIds.headerSignInButton);
    const sectionTitle = this.scope.getByTestId(TestIds.seriesSectionTitle);
    // "VIP Series" cards paywall episode 1 with no free preview, unlike regular series.
    // Scoped by section title, not DOM order — no more robust per-card signal exists
    // (checked for a lock icon/attribute; see docs/exploration-notes.md).
    const vipSection = this.scope
      .locator('section')
      .filter({ has: sectionTitle.getByText('VIP Series', { exact: true }) })
      .filter({ visible: true });
    this.vipSeriesPlayButton = vipSection
      .getByTestId(TestIds.seriesSectionPlayButton)
      .filter({ visible: true })
      .first();
    // Any section except "VIP Series" (fully paywalled) and "Continue Watching" (personalized
    // history — can appear once a worker's account has watch history). Dynamic instead of a
    // hardcoded series ID — see constants.ts's KNOWN_SERIES_PATH_OVERRIDE for the pin escape hatch.
    const regularSection = this.scope
      .locator('section')
      .filter({ has: sectionTitle })
      .filter({ hasNot: sectionTitle.getByText('VIP Series', { exact: true }) })
      .filter({ hasNot: sectionTitle.getByText('Continue Watching', { exact: true }) })
      .filter({ visible: true });
    this.regularSeriesPlayButton = regularSection
      .getByTestId(TestIds.seriesSectionPlayButton)
      .filter({ visible: true })
      .first();
    // All 8 hero slide CTAs stay mounted (real layout, not display:none) as the carousel
    // auto-rotates — kept as a set, not narrowed to one, since which slide is on-screen
    // changes over time. See getActiveHeroSlideIndex()/openFeaturedSeriesFromHero().
    this.heroPlayButtons = this.scope.getByTestId(TestIds.bannerTopPlayButton);
    // Header swaps the "Sign In" button for this avatar link once signed in.
    this.avatarLink = this.scope.getByTestId(TestIds.headerAvatarLink);
  }

  async open() {
    await super.open('/');
    await this.checkHomePageIsLoaded();
  }

  async checkHomePageIsLoaded() {
    await this.checkVisible(this.vipSeriesPlayButton, 'Home page series grid is not visible');
  }

  async checkUserIsSignedOut() {
    await this.checkVisible(this.signInButton, '"Sign In" button is not visible for a signed-out user');
  }

  async checkUserIsSignedIn() {
    await this.checkHidden(this.signInButton, '"Sign In" button is still visible after signing in');
    await this.checkVisible(this.avatarLink, 'Header avatar link is not visible after signing in');
  }

  async clickSignIn() {
    await this.checkVisible(this.signInButton, 'Cannot click "Sign In" — it is not visible');
    await this.signInButton.click();
  }

  async openVipSeriesFromGrid() {
    await this.vipSeriesPlayButton.scrollIntoViewIfNeeded();
    await this.vipSeriesPlayButton.click();
    await this.verifyUrlContains(URL_PATTERNS.videoPage, 'Did not navigate to the video player page');
  }

  /**
   * Opens a real catalog series and returns the URL it lands on (?from=home, top-level
   * document). Callers needing the iframe render path should re-navigate to the UUID
   * extracted from this URL instead — see App.openPlayerFromHome().
   *
   * The click causes two navigations in quick succession (bare URL, then a `?from=home`
   * redirect — see docs/exploration-notes.md), so we wait for the `from` param specifically
   * rather than any video URL match, or a caller's immediate goto() can race the second
   * navigation. App.gotoSeriesPage() retries for the remaining gap (seen on WebKit).
   */
  async openRegularSeriesFromGrid(): Promise<string> {
    await this.regularSeriesPlayButton.scrollIntoViewIfNeeded();
    await this.regularSeriesPlayButton.click();
    await this.page.waitForURL((url) => URL_PATTERNS.videoPage.test(url.href) && url.searchParams.has('from'), {
      timeout: 15_000,
    });
    return this.page.url();
  }

  /** Index (0-7) of the on-screen hero slide, or -1 mid-rotation. One DOM round trip for all 8. */
  private async getActiveHeroSlideIndex(): Promise<number> {
    return this.page.evaluate((testId) => {
      const candidates = Array.from(document.querySelectorAll(`[data-testid="${testId}"]`));
      return candidates.findIndex((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > 0 && rect.left < window.innerWidth;
      });
    }, TestIds.bannerTopPlayButton);
  }

  /**
   * Clicks the hero banner's "Start watching" CTA — the page's most prominent element.
   * Call right after open(), before anything else; the carousel keeps rotating (JS-driven
   * translateX, no CSS transition to await — see docs/exploration-notes.md) and delay just
   * gives it more time to move on. Re-resolves the on-screen slide and clicks it as one
   * retryable unit rather than two steps, so a rotation mid-click self-heals on retry
   * instead of retrying a now-stale slide.
   */
  async openFeaturedSeriesFromHero() {
    await expect(async () => {
      const activeIndex = await this.getActiveHeroSlideIndex();
      expect(activeIndex, 'No hero slide is currently on-screen').not.toBe(-1);
      await this.heroPlayButtons.nth(activeIndex).click({ timeout: 3_000 });
    }).toPass({ timeout: TIMEOUTS.heroCarouselStabilize, intervals: [150] });
    await this.verifyUrlContains(URL_PATTERNS.videoPage, 'Did not navigate to the video player page');
  }
}
