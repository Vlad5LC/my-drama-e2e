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

Runs against the live production site (`https://my-drama.com`) by default —
override with `BASE_URL`. No credentials needed: each test signs in with a
freshly generated email where it needs to.

## Project structure

```
src/
  config/        BASE_URL, timeouts, every data-testid used — as constants
  pages/         Page Object Model
    base.page.ts             shared Scope type (Page | FrameLocator) + helpers
    home.page.ts              home page
    video.page.ts              video player — resolves iframe vs. top-level DOM
    components/                sign-in modal, episode list drawer, paywall modal
    app.ts                     page factory + App.openPlayerFromHome() composite
  fixtures/
    app.fixture.ts             `app` test fixture
tests/
  main-paywall-flow.spec.ts            @smoke — home → hero CTA → locked episode → paywall (anonymous)
  vip-series-instant-paywall.spec.ts   @regression — sign in → a VIP series paywalls episode 1 immediately
  paywall-and-episode-boundary.spec.ts @regression — episode boundary + free episode plays without paywall + paywall content
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
  exists. Both branches are exercised: `paywall-and-episode-boundary.spec.ts`
  goes through the iframe (its `page.goto`), the other two tests don't.
- **Locator priority is `data-testid` → role/text → CSS**, with one measured
  exception: the hero banner's CTA uses a role/text locator because it
  measured more reliable (8/8) than its own `data-testid` (4/5) — the
  carousel's DOM order doesn't reliably match which slide is current. See
  `HomePage.heroPlayButton`.
- **A locked episode is found via `[data-is-locked="true"]`**, not a lock
  icon or tile position — the actual signal the UI itself reads from.
- **Currency and discount % are never asserted** (vary by geo/A-B test); the
  tests check structure and format instead.
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

1. **Live site exploration** — every `data-testid`, attribute, and flow step
   was found by driving a real browser and inspecting the live DOM, not
   generated from memory. `docs/exploration-notes.md` records that process,
   including corrections when an assumption turned out wrong (e.g. an early
   read of the hero carousel as "unautomatable" turned out to be a timing
   issue, not a hard limit).
2. **Implementation** — page objects and tests, iterated against real test
   runs and real failures rather than guessed at.
3. **Review** — a multi-persona discussion plus an adversarial code review
   (one reviewer with zero project context, one doing exhaustive edge-case
   analysis) against the actual diff, which caught real issues (a race
   condition, an unguarded locator, dead code, missing tags) and a few false
   positives from an incomplete excerpt, corrected rather than acted on.
4. **Independent verification** — two agents with no access to this repo
   explored the live site cold and confirmed the anonymous-paywall and
   hero-carousel findings above; reconciling one thing they found that
   contradicted the checked-in code is what led to the hero-carousel fix.

Nothing here was invented without a corresponding line of evidence in
`exploration-notes.md` or a passing run against the live site.

## CI

`.github/workflows/playwright.yml`: `tsc --noEmit` + `eslint`, then the full
suite on both mobile projects in a matrix, HTML report uploaded as an
artifact.

## Known limitations

- Runs against live prod — content changes can break tests for reasons
  unrelated to the code. `paywall-and-episode-boundary.spec.ts` pins one
  series (`KNOWN_SERIES_WITH_FREE_EPISODES_PATH`) for determinism;
  `main-paywall-flow` deliberately doesn't, so it always reflects whatever
  the hero banner currently features — at the cost of depending on that
  slide having free episodes.
- Two workers hitting prod at once occasionally hits a slow response;
  confirmed not a code defect (three clean serial reruns). CI's `retries: 2`
  absorbs this.
- No `storageState` reuse — each test that needs a session signs in fresh.
- Each run creates a real, never-deleted account (generated `@mailinator.com`
  email) — fine for occasional runs, would need cleanup for real CI frequency.
- No API mocking — this is a black-box e2e suite by design.
