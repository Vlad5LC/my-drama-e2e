export const URL_PATTERNS = {
  // Anchored to the real UUID shape (8-4-4-4-12 hex groups) followed by a path/query/hash
  // boundary or end-of-string, so it can't false-positive on a 36-char run of hex/dashes
  // embedded in something else.
  videoPage: /\/video\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:[/?#]|$)/i,
};

/** The video player page's iframe wrapper — see VideoPage.resolveScope() for why it exists. */
export const HANDOFF_FRAME_SELECTOR = 'iframe#__cover-handoff__';

export const TIMEOUTS = {
  /** The handoff iframe on the video page needs a beat to attach after navigation. */
  frame: 15_000,
  /** Passwordless sign-in shows a spinner for a couple of seconds before it resolves. */
  auth: 15_000,
};

export const TEST_EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN ?? 'mailinator.com';

/**
 * "Make Me Yours" — verified by hand to have 11 free episodes (index 0-10)
 * followed by locked ones (data-is-locked="true" from index 11 on), out of 88
 * total. Used as a stable, deterministic entry point for the free→locked flow
 * instead of picking a home page grid card, whose section order/content
 * changes as the catalog is updated (a random card could turn out to be a
 * VIP-only series with zero free episodes, like the ones under "VIP Series").
 */
export const KNOWN_SERIES_WITH_FREE_EPISODES_PATH = '/video/a0deec29-8abc-4b1c-be77-4d4107019877';
