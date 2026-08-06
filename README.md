# my-drama-e2e

Playwright (TypeScript) e2e tests for the **mobile web** version of
[my-drama.com](https://my-drama.com/) — a short vertical-drama streaming
site. Covers the main user flow: landing on the site → clicking the most
prominent CTA → browsing a series → hitting the subscription paywall.

Real mobile device emulation only (`devices['iPhone 13']` / `devices['Pixel 5']`
— viewport, UA, touch, `isMobile`) — no desktop project, per the task's
requirement to test mobile web specifically.

## Quick start

```bash
npm ci
npx playwright install
npm test              # both mobile projects
npm run test:iphone   # WebKit / iPhone 13 only
npm run test:pixel    # Chromium / Pixel 5 only
npm run test:smoke    # @smoke only
npm run report        # open the last HTML report
```

Runs against the live production site (`https://my-drama.com`) by default. No
credentials needed: tests sign in with a generated email where they need to
(one real account per worker, reused across that worker's tests — not one
per test, see "Known limitations").

### Running against a different environment

```bash
BASE_URL=https://stage.my-drama.com npm test
```

`BASE_URL` is enough on its own — every test discovers a series dynamically
from whatever's actually on that environment's home page, instead of
depending on a specific prod ID:

- `main-paywall-flow` / `vip-series-instant-paywall` click the hero banner /
  a "VIP Series" card respectively.
- `episode-boundary-and-paywall-content.spec.ts` and
  `free-episode-plays-without-paywall.spec.ts` each click the first card in
  a real catalog section (excluding "VIP Series" and "Continue Watching" —
  see `HomePage.openRegularSeriesFromGrid()`), read the UUID they land on,
  then re-navigate to it directly to exercise the iframe render path.

`KNOWN_SERIES_PATH=/video/<some-uuid>` is an optional override for those two
tests only — pin it to reproduce a failure tied to one specific series, or
on an environment where the dynamic discovery above isn't wanted. Unset by
default.

`TEST_USER_EMAIL=<email>` is a similar override for the account itself —
every worker generates its own fresh email by default (see "Account
creation" below), this pins them all to one fixed email instead, e.g. to
reproduce a bug tied to a specific account's accumulated state. Not the
default, for the same reason as `KNOWN_SERIES_PATH`-style pins generally:
this site never deletes accounts, so a reused-forever email accumulates
watch history/personalization indefinitely instead of resetting each run.

All three env vars can also go in a `.env` file instead of being passed
inline — see `.env.example`.

## Project structure

```
src/
  config/        BASE_URL, timeouts, every data-testid used — as constants
    global-setup.ts           fails the run fast if BASE_URL is unreachable
  pages/         Page Object Model
    base.page.ts             shared Scope type (Page | FrameLocator) + helpers
    home.page.ts              home page
    video.page.ts              video player — resolves iframe vs. top-level DOM
    components/                sign-in modal, episode list drawer, paywall modal
    app.ts                     page factory + App.openPlayerFromHome() composite
  fixtures/
    app.fixture.ts             `app` test fixture
tests/
  main-paywall-flow.spec.ts                        @smoke — home → hero CTA → locked episode → paywall (anonymous)
  vip-series-instant-paywall.spec.ts               @regression — sign in → a VIP series paywalls episode 1 immediately
  episode-boundary-and-paywall-content.spec.ts     @regression — episode lock boundary + full paywall content
  free-episode-plays-without-paywall.spec.ts       @regression — negative case: free episode never shows the paywall
docs/
  exploration-notes.md      raw facts about the site's DOM/flow, verified by hand
```

## Test scenarios

| Test                                                                  | Flow                                                                    | Checks                                                                                                                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main-paywall-flow` (`@smoke`)                                        | Home → click the hero banner CTA → episode list → open a locked episode | Anonymous, no sign-in. Episode 1 plays, episode list opens, paywall appears with an enabled "Get Full Access"                                                                  |
| `vip-series-instant-paywall` (`@regression`)                          | Home → sign in → open a **VIP Series** card                             | Episode 1 is already paywalled — no free preview, no episode-list interaction needed                                                                                           |
| `episode list boundary is consistent...` (`@regression`)              | Home → sign in → open a series with free episodes → episode list        | Unlocked episodes come before locked ones, exactly one "current" episode, then: open a locked episode → paywall shows a timer, 3 priced plans, terms checkbox, selectable plan |
| `a free episode plays without triggering the paywall` (`@regression`) | Same session → open the _last_ unlocked episode                         | The negative case — free content stays playable, paywall doesn't appear                                                                                                        |

Two real, independently-discovered routes to the paywall are used
deliberately (locked episode vs. instant VIP paywall) instead of one flow
copy-pasted twice.

### Why the main flow skips sign-in

Verified three ways — manually, and independently by two agents exploring
the site blind with no access to this repo — that **an anonymous visitor
reaches the same paywall without ever signing in.** So `main-paywall-flow`
does the literal thing the brief describes: land on the site, click the
biggest button on the page, hit the paywall. `vip-series-instant-paywall`
still signs in, since account creation is worth testing somewhere and its
entry point has no reason not to. See `docs/exploration-notes.md` for how
this was confirmed.

## Design decisions

- **`/video/{uuid}` renders inside a same-origin iframe**
  (`iframe#__cover-handoff__`) when reached via a direct `page.goto()`, and
  directly in the top-level document when reached by clicking through from
  the home page. `VideoPage.resolveScope()` detects which one happened per
  run rather than assuming — no test or page object needs to know the iframe
  exists. Both branches are exercised: `episode-boundary-and-paywall-content.spec.ts`
  and `free-episode-plays-without-paywall.spec.ts` go through the iframe
  (their `page.goto`), the other two tests don't.
- **Locator priority is `data-testid` → role/text → CSS.** The one previous
  exception here (hero banner CTA on role/text instead of `data-testid`) was
  actually solving the wrong problem — see `HomePage.getActiveHeroSlideIndex()`
  and `docs/exploration-notes.md` for the real fix: don't pick one fixed
  element by any locator strategy, re-resolve which of the 8 rotating slides
  is on-screen right before every click.
- **A locked episode is found via `[data-is-locked="true"]`**, not a lock
  icon or tile position — the actual signal the UI itself reads from.
- **Currency and discount % are never asserted** (vary by geo/A-B test); the
  tests check structure and format instead — e.g. a plan's price is checked
  against `\d+[.,]\d{2}` (a real decimal amount), not a bare `\d+` that a
  stray unrelated digit on the card could also satisfy.
- **`globalSetup` (`src/config/global-setup.ts`) checks `BASE_URL` is
  reachable before any test runs**, so a wrong/unreachable URL fails once
  with one clear message instead of every test independently timing out on
  its first navigation.
- **This site renders some nodes twice** (responsive breakpoint variants, and
  a duplicated paywall plans block further down the page). Every affected
  locator is filtered to `visible: true` or scoped under an already-resolved
  container — see `paywall.modal.ts` and `docs/exploration-notes.md`.
- **No `return this` / method chaining**, locators in constructors,
  `check*`/`open*`/`click*` naming — matches the author's existing
  Python/Playwright QA repo conventions.

## Safety boundary

Tests stop at **paywall visibility**. Nothing here ever clicks "Get Full
Access" or enters payment details — that would trigger a real charge on a
production site.

## AI usage

Claude Code was used for:

1. **Planning** — started as an open brainstorm (site, flow, repo setup)
   before narrowing into a concrete plan. Opus for planning/architecture
   decisions, Sonnet for writing the actual code.
2. **Live site exploration** — every `data-testid`, attribute, and flow step
   was found by driving a real browser and inspecting the live DOM, not
   generated from memory: both a desktop Chrome tab at a mobile viewport,
   and manual checks on a real iPhone 17 in Chrome and Safari, done early on.
   `docs/exploration-notes.md` records that process, including corrections
   when an assumption turned out wrong (e.g. an early read of the hero
   carousel as "unautomatable" turned out to be a timing issue, not a hard
   limit).
3. **Implementation** — page objects and tests, iterated against real test
   runs and real failures rather than guessed at.
4. **Review** — a BMAD party-mode multi-persona discussion, plus the BMAD
   code-review skill running an adversarial pass (one reviewer with zero
   project context, one doing exhaustive edge-case analysis) against the
   actual diff, which caught real issues (a race condition, an unguarded
   locator, dead code, missing tags) and a few false positives from an
   incomplete excerpt, corrected rather than acted on.
5. **Independent verification** — two agents with no access to this repo
   explored the live site cold and confirmed the anonymous-paywall and
   hero-carousel findings above; reconciling one thing they found that
   contradicted the checked-in code is what led to the hero-carousel fix.

Nothing here was invented without a corresponding line of evidence in
`exploration-notes.md` or a passing run against the live site.

**A note on my role vs. Claude's.** I directed this project end-to-end: set
the scope, decided what to build and what to skip, and reviewed every
change before accepting it. Claude Code wrote most of the code and ran the
investigation scripts against the live site. A few decisions were mine
specifically:

- `BASE_URL` should always be overridable (prod/stage), not hardcoded —
  and asked for a check for similar hardcoded assumptions elsewhere, which
  surfaced the same problem with a pinned series UUID.
- Splitting `paywall-and-episode-boundary.spec.ts` into two files once the
  name stopped signalling that it held both a positive and a negative case.
- A deeper typing pass beyond the initial check, which found two real
  issues (a `-1` sentinel instead of `null`, an unguarded field).
- Questioning whether tests were creating more real user accounts than
  necessary.
- Pushing back on locking tests to a specific series name/UUID as fragile —
  which led to runtime discovery instead, with `KNOWN_SERIES_PATH` kept as
  an explicit escape hatch for pinning one series when needed.
- Pushing back on `dispatchEvent('click')` as a possible reachability issue
  rather than just a workaround, which turned into a proper root-cause
  investigation (see `docs/exploration-notes.md`).
- Choosing what stayed a documented known gap vs. what got fixed now.

Everything here was verified against the live site or a passing test run —
nothing was accepted on trust.

## CI

`.github/workflows/playwright.yml`: `tsc --noEmit` + `eslint`, then the full
suite on both mobile projects in a matrix, HTML report uploaded as an
artifact.

## Known limitations

- Runs against live prod — content changes can break tests for reasons
  unrelated to the code. No test pins a specific series ID by default:
  `episode-boundary-and-paywall-content.spec.ts` and
  `free-episode-plays-without-paywall.spec.ts` discover a real catalog
  series at runtime (`HomePage.openRegularSeriesFromGrid()`, escape-hatched
  by `KNOWN_SERIES_PATH` — see "Running against a different environment"),
  and `main-paywall-flow` always reflects whatever the hero banner currently
  features. All depend on the discovered/featured series actually having
  free episodes, which held for most runs but isn't guaranteed by the site.
- **Known gap, root-caused**: `EpisodesList` clicks episode buttons and group
  tabs via `dispatchEvent('click')` instead of a real click. Confirmed this
  isn't a missed gesture or Playwright being overcautious — 4 different real
  drag/swipe simulations across Chromium and WebKit never moved the drawer,
  and a real-device check showed the drawer opens properly expanded there,
  unlike in Playwright's emulation. Root cause: Playwright's iPhone 13
  viewport doesn't match how this site sizes its video area on a real
  device, so the drawer's resting position ends up permanently below the
  emulated viewport — a testing-tool fidelity limit, not a real reachability
  bug. Full measurements in `docs/exploration-notes.md`.
- **Occasional slow response under concurrent load.** `episode-boundary-and-paywall-content.spec.ts`
  has intermittently timed out waiting for the paywall (~1 in 12 runs,
  observed during heavy repeat-testing). An earlier note here guessed this
  was a click landing on the wrong element ("burger menu open") — wrong: the
  failure screenshot itself shows a plain loading spinner, not any menu: the
  ARIA snapshot used for that earlier guess includes DOM elements regardless
  of visibility, so its presence never meant the menu was actually open.
  This is prod being slow to respond, not a code defect — two workers
  hitting the same live site at once is real concurrent load, consistent
  with occasional slow responses seen elsewhere too. CI's `retries: 2`
  absorbs this; a plain local rerun resolves it.
- **Account creation and `storageState` reuse.** `app.fixture.ts`'s
  `testEmail` is a worker-scoped fixture — one email generated per worker,
  reused by every test that worker runs, instead of a fresh signup per test.
  Safe because a worker's tests run sequentially (never a concurrent
  sign-in race) and each worker still gets its own distinct email (no
  cross-worker collision).
  - `vip-series-instant-paywall.spec.ts` does a real, from-scratch UI
    sign-in every time — it's the one test actually covering that
    mechanism (see "Why the main flow skips sign-in").
  - `episode-boundary-and-paywall-content.spec.ts` and
    `free-episode-plays-without-paywall.spec.ts` instead reuse a
    `storageState` captured once per worker (`authStoragePath` fixture —
    signs in via the same real UI flow, saves the resulting cookies to a
    temp file), loaded via `test.use({ storageState: ... })`, so they skip
    repeating the sign-in UI as pure setup for something else. Cuts real
    UI sign-ins per full run from up to "one per test" down to "one real
    sign-in per worker, reused by the rest."
  - Loading storageState reaches the episode list much faster than a full
    sign-in UI flow does, which exposed a real timing gap in the episode
    drawer's buttons (not wired up for click yet right when they become
    visible) — see `TIMEOUTS.episodesListSettle`.
  - `TEST_USER_EMAIL` can pin every worker to one fixed email instead of
    generating fresh ones — see "Running against a different environment".
- Each such account is real and never deleted (generated `@mailinator.com`
  email) — fine for occasional runs, would need cleanup for real CI frequency.
  `TEST_USER_EMAIL` makes this worse, not better, if left pinned permanently
  (see its own doc comment in `constants.ts`) — it's a debugging escape
  hatch, not a way to reduce account creation long-term.
- No API mocking — this is a black-box e2e suite by design.
