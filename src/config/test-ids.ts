/**
 * data-testid values captured by hand from the live site (mobile viewport 390x844),
 * see docs/exploration-notes.md for how each one was found.
 */
export const TestIds = {
  // Home page
  headerSignInButton: 'header-sign-in-button',
  headerAvatarLink: 'header-avatar-link',
  seriesSectionTitle: 'series-section-title',
  seriesSectionPlayButton: 'series-section-play-button',
  bannerTopPlayButton: 'banner-top-play-button',

  // Sign-in modal
  loginModalEmailInput: 'login-modal-email-input',
  loginModalSubmitButton: 'login-modal-submit-button',

  // Video player page — renders inside a same-origin handoff iframe only when reached via a
  // direct page.goto() (never when clicking through from the home page, by any route) — see
  // VideoPage.resolveScope().
  videoPageContent: 'video-page-content-container',
  episodeSelectorButton: 'video-player-episode-selector-button',

  // Episodes list drawer
  episodesContainer: 'episodes-list-container',
  episodesHeader: 'episodes-list-header',
  episodesCoverImage: 'episodes-list-cover-image',
  episodesTitleMobile: 'episodes-list-title-mobile',
  episodesDescription: 'episodes-list-description',
  episodesLikeButton: 'episodes-list-like-button',
  episodesGenreTags: 'episodes-list-genre-tags',
  episodesGroupNavigation: 'episodes-group-navigation',
  episodesGroupButton: 'episodes-group-button',
  episodesGrid: 'episodes-list-grid',
  episodeButton: 'episodes-list-episode-button',

  // Paywall modal
  modalContainer: 'modal-container',
  paywallContainer: 'paywall-long-dark',
  paywallTimer: 'new-paywall-timer',
  premiumModalButton: 'premium-modal-button',
  paywallPlansSection: 'paywall-plans-section',
  paywallPlansTitle: 'paywall-plans-section-title',
  paywallPlanCard: 'paywall-plan-card',
  paywallTermsCheckbox: 'paywall-terms-checkbox',
} as const;

/** Builds a CSS selector for a data-testid, optionally with an extra attribute filter. */
export const byTestId = (testId: string, extraSelector = ''): string => `[data-testid="${testId}"]${extraSelector}`;
