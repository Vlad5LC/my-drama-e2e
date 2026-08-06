import { Page, expect } from '@playwright/test';
import { HomePage } from './home.page';
import { SignInModal } from './components/sign-in.modal';
import { VideoPage } from './video.page';
import { KNOWN_SERIES_PATH_OVERRIDE, VIDEO_UUID_PATTERN } from '../config/constants';

/** Page factory bundling every page/component object for a single test. */
export class App {
  readonly page: Page;
  readonly home: HomePage;
  readonly signIn: SignInModal;
  readonly video: VideoPage;
  /** Shared for this whole worker — see app.fixture.ts's testEmail fixture. */
  private readonly testEmail: string;

  constructor(page: Page, testEmail: string) {
    this.page = page;
    this.testEmail = testEmail;
    this.home = new HomePage(page);
    this.signIn = new SignInModal(page);
    this.video = new VideoPage(page);
  }

  get episodes() {
    return this.video.episodes;
  }

  get paywall() {
    return this.video.paywall;
  }

  /** Reuses this worker's one test account rather than signing up fresh each call. */
  async signInAsTestUser(): Promise<string> {
    await this.home.clickSignIn();
    await this.signIn.signInWithEmail(this.testEmail);
    return this.testEmail;
  }

  /** home → assert signed-out → sign in → assert signed-in. Used by every test that needs a session. */
  async signInFromHome(): Promise<string> {
    await this.home.open();
    await this.home.checkUserIsSignedOut();
    const email = await this.signInAsTestUser();
    await this.home.checkUserIsSignedIn();
    return email;
  }

  /**
   * Real, from-scratch UI sign-in → discover a real catalog series (or KNOWN_SERIES_PATH_OVERRIDE)
   * → player loaded. For a test that only needs a signed-in session as a precondition, prefer
   * openPlayerAsAuthenticatedWorker() with `authStoragePath` instead — see app.fixture.ts.
   */
  async openPlayerFromHome() {
    await this.signInFromHome();
    await this.openDiscoveredSeriesPlayer();
  }

  /** Same as openPlayerFromHome(), but for a context already authenticated via storageState reuse. */
  async openPlayerAsAuthenticatedWorker() {
    await this.home.open();
    await this.home.checkUserIsSignedIn();
    await this.openDiscoveredSeriesPlayer();
  }

  private async openDiscoveredSeriesPlayer() {
    const seriesPath = KNOWN_SERIES_PATH_OVERRIDE ?? (await this.discoverSeriesPathFromGrid());
    await this.gotoSeriesPage(seriesPath);
    await this.video.waitUntilLoaded();
  }

  /** Clicks a real catalog card and extracts /video/{uuid} from wherever it navigated to. */
  private async discoverSeriesPathFromGrid(): Promise<string> {
    const landedUrl = await this.home.openRegularSeriesFromGrid();
    const match = landedUrl.match(VIDEO_UUID_PATTERN);
    if (!match) {
      throw new Error(`Could not extract a video UUID from discovered series URL: ${landedUrl}`);
    }
    return `/video/${match[1]}`;
  }

  /**
   * A direct goto() here can still race a leftover client redirect from the discovery click
   * (seen on WebKit) and get "interrupted by another navigation". Retried instead of chased
   * with another wait condition — a lost race just leaves the page wherever that redirect
   * landed, and trying again succeeds once it's done.
   */
  private async gotoSeriesPage(path: string): Promise<void> {
    await expect(async () => {
      await this.page.goto(path);
    }).toPass({ timeout: 15_000, intervals: [300] });
  }
}
