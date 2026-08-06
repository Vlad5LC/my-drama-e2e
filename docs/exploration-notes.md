# Exploration notes

Raw facts about my-drama.com collected by hand (Claude Code driving a real
Chrome tab at a 390×844 mobile viewport, plus direct `document.querySelector`
calls) before any test code was written. Every locator in `src/pages` traces
back to something verified here — nothing was invented from memory. Kept in
the repo so the origin of each locator can be audited later.

## Sign-in is not a paywall gate

Verified after the initial pass, by clearing cookies/localStorage on a
previously signed-in tab and reloading (header reverts to showing "Sign In",
confirming a signed-out state) and then clicking a `data-is-locked="true"`
episode directly: **an anonymous, never-signed-in user reaches the exact same
paywall** — no sign-in prompt is interposed. Sign-in is therefore not a
prerequisite for hitting the paywall on this site. Independently confirmed
later by two agents exploring the site blind (see README, "AI usage",
point 4). `main-paywall-flow.spec.ts` reflects this and skips sign-in
entirely; `vip-series-instant-paywall.spec.ts` still signs in — see README,
"Why the main flow skips sign-in".

## Home page (`/`)

- Regular top-level document — ~844 `[data-testid]` elements directly in the
  DOM, no wrapping iframe for the main content (two unrelated iframes exist,
  most likely a chat widget).
- `Sign In` button in the header: `data-testid="header-sign-in-button"` (found later, surfaced in
  a Playwright failure log's resolved-locator dump rather than the initial manual DOM pass —
  corrected from an earlier, wrong note here claiming no testid existed).
- Signing in: click "Sign In" → email input (`getByPlaceholder('email@gmail.com')`)
  → "Continue with Email" button → in this environment this **logs the user in
  immediately**, no OTP-entry step to automate. ~2-3s spinner, then the header
  swaps to `[data-testid="header-avatar-link"]` and the "Sign In" button is
  removed.
- Header avatar link testid confirmed via `document.querySelectorAll('header
button, header a')` filtered to `top < 80px` bounding rect.
- Hero banner (`data-testid="banner-top-play-button"`, one per slide,
  `banner-top-slide-0..7`) is an **auto-rotating carousel** — the single most
  prominent element on the page (full-bleed, first thing visible; confirmed
  independently by two agents who explored the site blind). All 8 slide CTAs
  stay mounted in the DOM with real (non-zero, non-`aria-hidden`) layout, only
  one on-screen at a time. **Timing, not the carousel itself, is what breaks
  automation**: measured directly (10 headless runs, `locale: 'en-US'`,
  `Pixel 5` viewport) — clicking right after page load succeeds reliably,
  clicking after a ~6s delay (e.g. after a sign-in flow first) fails 100% of
  the time with "element is outside of the viewport", because the carousel
  has rotated past the target by then. An earlier note here claimed this
  element was simply unusable for automation — that was wrong; it's only
  unusable _after a delay_. `HomePage.openFeaturedSeriesFromHero()` is
  written to only be called immediately after `open()`, and IS used, by
  `main-paywall-flow.spec.ts`.
- Also measured, early on: `getByTestId('banner-top-play-button').first()`
  (DOM order) only succeeded 4/5 runs — DOM order doesn't reliably match
  which slide is actually current. `getByRole('link', { name: /start
watching/i })` (matches by accessible name/role) succeeded 8/8 across two
  batches at the time, and was used as a measured exception to this repo's
  usual data-testid-first rule. **This was later found to be a coincidence of
  timing, not a real fix** — see below.
- **Root cause, found later while adding a stabilization wait**: any locator
  built with `.first()` — role-based or testid-based, doesn't matter —
  always resolves to **slide 0's specific DOM element**, permanently. That
  element only happens to be on-screen right after page load, because
  rotation always starts at slide 0. Adding literally any wait before the
  click (a stabilization check, a sign-in flow, anything) gives the carousel
  time to rotate away from slide 0 — at which point `.first()` still resolves
  successfully to slide 0's link (still mounted, still "stable", just
  off-screen) and Playwright's actionability check correctly reports
  "element is outside of the viewport" forever, since the element and the
  viewport genuinely never intersect again until the rotation loops back.
  Confirmed by measurement: a first attempt at a stabilization wait (poll a
  fixed `.first()` locator's bounding box until motionless, then click)
  turned a rare (~1/4) flake into a **5/5 failure** — proof the original
  "click immediately" version worked by accident (a lucky, narrow timing
  window), not because slide 0 was in any way special.
- **Fix**: `HomePage.getActiveHeroSlideIndex()` re-resolves which of the 8
  `banner-top-play-button` elements is actually on-screen (via
  `getBoundingClientRect()` vs `window.innerWidth`) fresh on every attempt,
  and `openFeaturedSeriesFromHero()` wraps "find the on-screen slide, click
  it" as a single retryable unit (`expect(...).toPass()`), not two separate
  steps — a click that fails because the carousel started rotating mid-click
  just causes the next attempt to re-resolve the (by-then-current) on-screen
  slide instead of retrying a stale one. Measured 15/16 clean runs after this
  change, with zero "outside of the viewport" failures (previously
  reproducible every run once any wait preceded the click). No CSS
  transition/animation-finish event exists to await instead — confirmed via
  a throwaway Playwright script under this repo's own iPhone 13 emulation:
  the carousel's rotation is a JS-driven `transform: translateX(...)` on the
  slides' shared parent, applied directly per animation frame — the parent's
  `getComputedStyle().transitionDuration` reads `"0s"` and
  `element.getAnimations()` returns empty even mid-rotation.
- **Locale matters for text-based locators.** Without an explicit
  `locale: 'en-US'` in the browser context, the site renders in Ukrainian
  (confirmed: default context on this network showed "Увійти", "Почніть
  дивитися", "Продовжити" instead of "Sign In", "Start watching", "Continue")
  — apparently geo-IP-based. `playwright.config.ts` already sets
  `locale: 'en-US'` globally, which is why every English-text-based locator
  in this repo works; a standalone script without it will silently fail to
  match anything text-based (not a click/actionability failure — the locator
  finds zero elements).
- Static series grids (`data-testid="series-section-play-button"`, 292
  instances across sections) are **not** animated and click reliably.
- The very first `series-section-play-button` in DOM order belongs to the
  **"VIP Series"** section (confirmed via
  `element.closest('section').querySelector('[data-testid="series-section-title"]')`
  → `"VIP Series"`). Clicking it opens `/video/{uuid}?from=home` where episode
  1 is _already_ paywalled — no free preview at all.
- **Regular (non-VIP) grid cards are `<button>` elements with no `href`**
  (client-side routing) — unlike VIP cards, which are real `<a href>`
  elements. A dynamic-discovery approach therefore has to click first and
  read `page.url()` after, not extract a URL statically beforehand. Verified
  by inspecting `outerHTML` for cards in both the "VIP Series" and a regular
  section side by side.
- **"Continue Watching" is a trap for "pick the first non-VIP section".** It's
  a personalized, per-account history section — never present for a
  signed-out user, but it can appear once an account has watch history, which
  is now possible since `app.fixture.ts` reuses one account across a
  worker's tests. Its cards aren't verified to behave like catalog cards
  (untested content, unknown lock state), so `HomePage.regularSeriesPlayButton`
  explicitly excludes it in addition to "VIP Series" (`.filter({hasNot: ...})`
  twice). Found live: a test tab with prior sign-in history had this section
  render first, ahead of real catalog sections like "New Releases".
- **"Top Picks In Ukraine" has no play buttons at all** — a different,
  numbered-ranking-list structure with no `series-section-play-button`
  elements. Harmless for `regularSeriesPlayButton`: `getByTestId()` across
  the multi-section locator just finds zero matches there and picks up the
  next eligible section's buttons instead — no special-case exclusion needed.
- **Clicking a regular grid card causes two real navigations, not one**: first
  to the bare `/video/{uuid}`, then a client redirect to `/video/{uuid}?from=home`.
  Waiting on a URL pattern that matches both (like `URL_PATTERNS.videoPage`
  alone) can resolve on the first, still-transient one — a caller that
  immediately does its own `page.goto()` right after races the second
  navigation and gets killed by Playwright ("interrupted by another
  navigation"). Confirmed by reproducing the race, then fixing
  `HomePage.openRegularSeriesFromGrid()` to wait specifically for the
  `?from=home` param (the actually-stable end state) before returning.
- **A direct `page.goto()` to a dynamically-discovered UUID (bare path, no
  query string) still triggers the iframe render path** (`hasIframe: true`),
  same as a hardcoded one — confirmed with a real discovered series
  ("Pregnant with Billionaire's Secret",
  `4448f01b-5ffe-4964-a644-96f53168c8ac` at time of writing, itself confirmed
  to have both free and locked episodes). So re-navigating to a
  runtime-discovered UUID preserves the same iframe-path coverage the old
  hardcoded UUID gave — see `App.openPlayerFromHome()`.
- **Checked whether a home-page card carries a more robust "instant paywall"
  signal than the section title** (e.g. a lock icon or a `data-is-locked`-style
  attribute, mirroring the episode buttons). It doesn't: a VIP card's `<a>`
  only has `data-testid`/`class`/`href` — no lock/premium attribute. Searched
  every `data-testid` on the page for `lock|premium|exclusive|vip|badge` —
  found only `main-page-premium-banner-*` (an unrelated promo banner). The
  "EXCLUSIVE" ribbon shown on many cards is plain visual text, not tied to a
  testid, and appears on cards outside "VIP Series" too, so it isn't a usable
  signal either. The section title is the most reliable thing available —
  `HomePage.vipSeriesPlayButton` scopes to it rather than DOM-order `.first()`.

## Video player page (`/video/{uuid}`)

Two different rendering paths exist, both verified with real navigations:

| Entry point                         | Resulting URL              | Player rendered...                                                 |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| Direct `page.goto('/video/{uuid}')` | redirects to `?from=cover` | inside `iframe#__cover-handoff__` (`class="handoff"`, same-origin) |
| Home page hero carousel click       | no `?from=` param          | directly in the top-level document                                 |
| Home page series grid click         | `?from=home`               | directly in the top-level document                                 |

An earlier version of this note claimed the hero carousel also went through
the iframe — wrong, corrected after re-measuring (4/4 clean runs showed no
iframe). Only a **direct** `page.goto()` to a video URL hits the iframe path;
clicking through from the home page, by either route, does not. This
repo's iframe branch is exercised by the two tests that call
`App.openPlayerFromHome()` (its direct `page.goto`) —
`episode-boundary-and-paywall-content.spec.ts` and
`free-episode-plays-without-paywall.spec.ts` — not by
`main-paywall-flow.spec.ts` (hero click) as an earlier note assumed.

The `?from=cover` iframe is **not** a transient loading state — it was still
present after 5s of waiting, and the top-level document had 0
`data-testid` elements the whole time (`document.querySelectorAll('[data-testid]').length === 0`
outside the iframe). `VideoPage.resolveScope()` detects which one actually
happened for the current run and points every locator at the right place —
this is why the detection is per-run, not hardcoded to an entry point.

The two rendering paths also expose **different DOM for the same UI**:

- `?from=home` (top-level document): episode counter badge has a real
  `data-testid="video-player-episode-selector-button"` (confirmed text: `"Ep. 1/73"`).
- `?from=cover` (handoff iframe): the same badge has **no** data-testid in
  this bundle — matched by its `"Ep. X/Y"` text instead
  (`VideoPage.episodeCounterBadge` tries both).

### Episode list drawer

Opens by clicking the episode counter badge. `data-testid`s confirmed via
`iframe.contentDocument.querySelectorAll('[data-testid]')`:

```
episodes-list-overlay, episodes-list-container, episodes-list-swipe-handle,
episodes-list-header, episodes-list-cover-image, episodes-list-title-mobile,
episodes-list-description, episodes-list-action-buttons, episodes-list-like-button,
episodes-list-genre-tags, episodes-group-navigation, episodes-group-button (xN),
episodes-list-grid, episodes-list-episode-button (xN), episodes-list-episode-lock
```

Each episode button carries real state as attributes (inspected via
`outerHTML`), e.g. for "Make Me Yours" (88 episodes total):

```html
<button
  data-testid="episodes-list-episode-button"
  data-episode-index="10"
  data-is-current="false"
  data-is-locked="false"
>
  11
</button>
<button
  data-testid="episodes-list-episode-button"
  data-episode-index="11"
  data-is-current="false"
  data-is-locked="true"
>
  12
</button>
```

Confirmed for this series: episodes at index 0-10 (displayed 1-11) are
`data-is-locked="false"`, index 11+ (displayed 12+) are `"true"`. This is the
free/paid boundary and the basis for `[data-testid="episodes-list-episode-button"][data-is-locked="true"]`
being the most robust way to find a locked episode — far more robust than a
lock icon or counting tiles.

Clicking a locked episode button opens the paywall **immediately** — verified
via a direct `element.click()` call in the browser console, no need to watch
the episode to the end. **This console verification is itself a synthetic
click, same as `dispatchEvent('click')` below — see the gap this leaves,
next.**

**KNOWN GAP, now root-caused — `dispatchEvent('click')` isn't hiding a bad
test, it's compensating for a Playwright mobile-emulation limitation.**
Re-investigated properly (not taken at face value) across several rounds:

- `lockedEpisodeButton.boundingBox()` reports `{ x: 163, y: 1089, width: 64,
height: 60 }` in a `390×664` viewport — genuinely below the fold, not a
  Playwright false positive.
- `scrollIntoViewIfNeeded()` doesn't help — no ancestor (`episodes-list-grid`
  → `-container` → `-overlay` → `body` → `html`) has `scrollHeight >
clientHeight`; nothing is actually scrollable. It even moves the button
  **further** off-screen (1089 → 1121).
- A real `page.mouse.click()` at that exact coordinate does nothing.
- Tried 4 different real drag/swipe simulations to expand the sheet — mouse
  drag on the handle, CDP `Input.dispatchTouchEvent` on the handle, on the
  header, and a horizontal swipe on the grid itself (per a live suggestion
  that swiping sideways or tapping group tabs reveals more episodes on a
  real device) — across both Chromium and WebKit, headless and headed. None
  moved `episodes-list-container`'s `transform: translateY(541px)` by a
  single pixel. One swipe even landed on the video player's own subtitle
  button underneath — proof there's nothing to touch there at all, not just
  an unresponsive touch target.
- **Real-device check settled it**: on an actual phone (Safari and Chrome),
  tapping the episode counter opens the drawer already mostly expanded,
  filling most of the screen below a short video preview strip — nothing
  like the Playwright screenshot, where the video fills the entire 664px
  viewport and the drawer never becomes visible at all.

**Conclusion**: this isn't a missed gesture or a flaky test — Playwright's
`devices['iPhone 13']` viewport (`390×664`, sized to leave room for Safari's
address bar) doesn't match how the site actually sizes its video area on a
real device, so the drawer computes a resting position that's permanently
below the emulated viewport. Likely a `100vh`-style mobile viewport-height
calculation that behaves differently under real dynamic browser chrome vs.
Playwright's static emulation — a testing-tool fidelity limit, not a bug in
this repo's test code. `dispatchEvent('click')` remains the correct choice:
`EpisodesList.openFirstLockedEpisode()` (and its group-tab fallback, and
`openLastUnlockedEpisode()`) call the click handler directly, bypassing
this gap rather than fighting it. It still means these tests can't tell you
whether a real user could reach the button through the UI (they don't need
to — a real user's browser sizes the page correctly) — see README's Known
Limitations.

### Paywall modal

`data-testid`s confirmed the same way:

```
modal-container, modal-overlay, modal-content, paywall-long-dark,
new-paywall-timer, premium-modal-button, paywall-plans-section,
paywall-plans-section-title, paywall-plans-section-subtitle,
paywall-plans-list, paywall-plan-card, paywall-terms-checkbox
```

Content, confirmed on screen:

- Pink banner: `"67% DISCOUNT RESERVED FOR: 07:59"` (counts down) + a sticky
  "Get Full Access" button.
- `"Your introductory discount is ready"` panel with a `mm:ss` timer.
- `"Choose your plan"` — three plan cards (1-week / 2-week "Most Popular" /
  4-week), each with an intro price and a struck-through renewal price in
  UAH (`ГРН`), e.g. `"2-WEEK PLAN: ГРН 55.00 now, then auto-renews ГРН 165.00
every 2 weeks"`. Currency/discount % are not asserted in tests — they can
  vary by geo or A/B test.
- Terms checkbox: `"I agree to the Terms and Conditions, Privacy Policy, and
Subscription Terms"`.

Each plan card carries state as attributes:

```html
<div
  data-testid="paywall-plan-card"
  data-plan-index="1"
  data-plan-selected="true"
  data-product-id="01JAT733O2647L7PA033AHTRYB"
></div>
```

**DOM duplication, measured with `getBoundingClientRect()`**:

- `premium-modal-button` and most single-instance testids: 4 copies in the
  DOM, but only one passes `.filter({ visible: true })` — a normal
  responsive breakpoint show/hide.
- `paywall-plan-card`: 6 copies (2× the 3 real plans). **Both** sets pass
  `.filter({ visible: true })` — CSS visibility alone doesn't disambiguate
  them. Measured bounding boxes: the real, on-screen set sits at `top ≈ 733px`;
  the duplicate set sits at `top ≈ 3431px` — a second, fully-styled "choose
  your plan" block further down the same page, not a responsive variant. Fixed
  by scoping `planCards` as a descendant of the already-disambiguated
  `plansSection` locator instead of filtering globally.

## How this was used

Every fact above came from either watching real Playwright test runs fail (and
reading the actual `data-is-locked`/`data-plan-selected` attributes, bounding
boxes, or DOM structure in the failure output) or from manual
`document.querySelector` calls in a live browser tab — not from guessing
based on how a similar site "probably" works. See the root `README.md`,
section "AI usage", for how this exploration process fits into the rest of
the workflow.
