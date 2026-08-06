import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { URL_PATTERNS } from '../config/constants';
import { TestIds } from '../config/test-ids';

export class HomePage extends BasePage {
  readonly signInButton;
  readonly vipSeriesPlayButton;
  readonly heroPlayButton;
  readonly avatarLink;

  constructor(page: Page) {
    super(page);
    this.signInButton = this.scope.getByTestId(TestIds.headerSignInButton);
    // First card under the "VIP Series" section — verified to be a series whose episode 1
    // is itself paywalled (no free preview at all), unlike regular series. Scoped to the
    // section actually titled "VIP Series" (not just DOM order's first play button) so a
    // future reordering of home page sections can't silently swap this for a regular series.
    // .filter({visible: true}) same as everywhere else on this site's duplicated responsive
    // nodes — if "VIP Series" itself ever renders twice (desktop/mobile), this keeps the
    // match down to the one actually on-screen instead of an arbitrary DOM-order .first().
    const vipSection = this.scope
      .locator('section')
      .filter({ has: this.scope.getByTestId(TestIds.seriesSectionTitle).getByText('VIP Series', { exact: true }) })
      .filter({ visible: true });
    this.vipSeriesPlayButton = vipSection
      .getByTestId(TestIds.seriesSectionPlayButton)
      .filter({ visible: true })
      .first();
    // The hero carousel auto-rotates every few seconds via CSS transform, and every slide's
    // CTA (data-testid="banner-top-play-button" x8, one per slide) stays mounted with real
    // layout, not display:none — clicking several seconds after page load (e.g. after a
    // sign-in flow) reliably fails with "element is outside of the viewport" because the
    // carousel has since rotated. Measured directly, right after page load: role-based
    // `getByRole('link', {name: /start watching/i})` succeeded 8/8 runs; the seemingly more
    // idiomatic `getByTestId(bannerTopPlayButton).first()` only succeeded 4/5 — testid's DOM
    // order doesn't reliably line up with which slide is actually the current/clickable one,
    // while the accessible-name-based query does. A deliberate, measured exception to this
    // repo's usual data-testid-first rule. openFeaturedSeriesFromHero() below must be called
    // immediately after open(), before any other action — see its own comment.
    this.heroPlayButton = this.scope.getByRole('link', { name: /start watching/i }).first();
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
   * Clicks the home page's single most prominent element — the hero banner's "Start
   * watching" CTA, full-bleed at the top of the page. MUST be called right after open(),
   * before any other action (sign-in, scrolling, waiting) — see heroPlayButton's comment.
   */
  async openFeaturedSeriesFromHero() {
    await this.heroPlayButton.click();
    await this.verifyUrlContains(URL_PATTERNS.videoPage, 'Did not navigate to the video player page');
  }
}
