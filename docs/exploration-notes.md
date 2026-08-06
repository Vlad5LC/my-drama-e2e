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
- Also measured: `getByTestId('banner-top-play-button').first()` (DOM order)
  only succeeded 4/5 runs — DOM order doesn't reliably match which slide is
  actually current. `getByRole('link', { name: /start watching/i })` (matches
  by accessible name/role) succeeded 8/8 across two batches at the time, and
  is used as a deliberate, measured exception to this repo's usual
  data-testid-first rule — see the comment on `HomePage.heroPlayButton`.
  **Caveat, found later**: standalone scripts that click immediately after a
  bare `page.goto()` (no other wait) have since shown occasional failures
  too — the carousel's timing tolerance is narrower than "8/8" suggested, not
  fully solved. In the actual test suite, `HomePage.open()` waits for
  `checkHomePageIsLoaded()` (the series grid's visibility) before
  `openFeaturedSeriesFromHero()` ever clicks — that incidental buffer is the
  likely reason `main-paywall-flow.spec.ts` has passed reliably across every
  full-suite run so far, but this is a real, not fully eliminated, flakiness
  risk worth watching if the test starts failing intermittently.
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
repo's iframe branch is exercised by `paywall-and-episode-boundary.spec.ts`
(via `App.openPlayerFromHome()`'s direct `page.goto`), not by
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
the episode to the end.

Known quirk: the drawer is a bottom sheet that keeps a CSS transform applied
even at rest. Playwright's real mouse click computes the button as "outside
the viewport" and refuses even with `{ force: true }`. A raw DOM click
(`element.click()` — what `locator.dispatchEvent('click')` does under the
hood) works fine, matching the manual verification above, so
`EpisodesList.openFirstLockedEpisode()` uses `dispatchEvent('click')`.

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
