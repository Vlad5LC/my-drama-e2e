import { Page } from '@playwright/test';
import { HomePage } from './home.page';
import { SignInModal } from './components/sign-in.modal';
import { VideoPage } from './video.page';
import { TEST_EMAIL_DOMAIN, KNOWN_SERIES_WITH_FREE_EPISODES_PATH } from '../config/constants';

/** Page factory bundling every page/component object for a single test. */
export class App {
  readonly page: Page;
  readonly home: HomePage;
  readonly signIn: SignInModal;
  readonly video: VideoPage;

  constructor(page: Page) {
    this.page = page;
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

  async signInWithNewEmail(): Promise<string> {
    const email = `my-drama-qa-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${TEST_EMAIL_DOMAIN}`;
    await this.home.clickSignIn();
    await this.signIn.signInWithEmail(email);
    return email;
  }

  /** home → assert signed-out → sign in → assert signed-in. Used by every test that needs a fresh session. */
  async signInFromHome(): Promise<string> {
    await this.home.open();
    await this.home.checkUserIsSignedOut();
    const email = await this.signInWithNewEmail();
    await this.home.checkUserIsSignedIn();
    return email;
  }

  /** sign in from home → open a series known to have free episodes → wait for the player to render. */
  async openPlayerFromHome() {
    await this.signInFromHome();
    await this.page.goto(KNOWN_SERIES_WITH_FREE_EPISODES_PATH);
    await this.video.waitUntilLoaded();
  }
}
