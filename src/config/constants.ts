/** Single source of truth — playwright.config.ts and global-setup.ts both import this. */
export const BASE_URL = process.env.BASE_URL ?? 'https://my-drama.com';

const VIDEO_UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const URL_PATTERNS = {
  // Anchored to the real UUID shape so it can't match a stray 36-char hex/dash run elsewhere.
  videoPage: new RegExp(`/video/${VIDEO_UUID}(?:[/?#]|$)`, 'i'),
};

/** Same shape as URL_PATTERNS.videoPage but capturing — pulls the UUID out of a URL. */
export const VIDEO_UUID_PATTERN = new RegExp(`/video/(${VIDEO_UUID})(?:[/?#]|$)`, 'i');

/** The video player page's iframe wrapper — see VideoPage.resolveScope(). */
export const HANDOFF_FRAME_SELECTOR = 'iframe#__cover-handoff__';

export const TIMEOUTS = {
  /** The handoff iframe needs a beat to attach after navigation. */
  frame: 15_000,
  /** Passwordless sign-in shows a spinner for a couple of seconds before it resolves. */
  auth: 15_000,
  /** Hero banner rotates every ~4-6s — see HomePage.waitForHeroCarouselToStabilize(). */
  heroCarouselStabilize: 8_000,
  /**
   * Episode drawer buttons attach to the DOM before their click handlers are wired up —
   * dispatchEvent('click') too early is a silent no-op (measured: <2s fails, 2-3s works).
   * See EpisodesList.checkIsOpen().
   */
  episodesListSettle: 2_500,
};

export const TEST_EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN ?? 'mailinator.com';

/**
 * Optional pin to one fixed email, e.g. to reproduce a bug tied to a specific account's
 * state. Unset by default — accounts here are never deleted, so a permanently-reused email
 * accumulates watch history/personalization forever. No password needed; sign-in here is
 * passwordless.
 */
export const TEST_USER_EMAIL_OVERRIDE = process.env.TEST_USER_EMAIL;

/**
 * Optional pin to a specific series, e.g. to reproduce a bug tied to one series. Unset by
 * default — App.openPlayerFromHome() discovers a real series at runtime instead, see
 * HomePage.openRegularSeriesFromGrid().
 */
export const KNOWN_SERIES_PATH_OVERRIDE = process.env.KNOWN_SERIES_PATH;
