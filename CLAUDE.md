# CLAUDE.md

Guidance for Claude Code (or any AI agent) working in this repository.

## What this is

Playwright + TypeScript e2e tests for the mobile web version of
https://my-drama.com — a real, external, third-party production site (not
something we own or control). Tests cover the path from landing on the site
to the subscription paywall.

## Project structure

```
src/
  config/        constants.ts (env-driven values), test-ids.ts, global-setup.ts
  pages/         Page Object Model — base.page.ts has the shared Scope type/helpers
    components/  sign-in modal, episode list drawer, paywall modal
    app.ts       page factory + composite flows (App.openPlayerFromHome() etc.)
  fixtures/      app.fixture.ts — testEmail, authStoragePath, app fixtures
tests/           one spec file per scenario, no shared setup beyond fixtures
docs/
  exploration-notes.md   the log of every verified fact about the live site —
                          read this before assuming anything new about it
```

## Environment variables

All optional, all read in `src/config/constants.ts`. See `.env.example`.

- `BASE_URL` — defaults to prod. Override to point the whole suite at
  another environment.
- `KNOWN_SERIES_PATH` — pins a specific series instead of the default
  runtime discovery (`HomePage.openRegularSeriesFromGrid()`). For
  reproducing a bug tied to one series.
- `TEST_USER_EMAIL` — pins every worker to one fixed email instead of
  generating a fresh one per worker. For reproducing a bug tied to a
  specific account's accumulated state. Not for routine use — this site
  never deletes accounts, so a permanently-reused email accumulates watch
  history/personalization indefinitely.
- `TEST_EMAIL_DOMAIN` — domain used for generated emails (default
  `mailinator.com`).

## Ground rules

- **Never invent a locator or a flow step.** If you don't have first-hand
  confirmation of a `data-testid`, attribute, or UI behavior, verify it with a
  live browser (or a throwaway Playwright script) before writing it into a
  page object. `docs/exploration-notes.md` documents everything already
  confirmed — read it before assuming something new about the site.
- **Never click "Get Full Access" or enter payment details.** Tests stop at
  paywall visibility. This is a hard boundary, not a style preference.
- **Site content changes over time.** Home page grid ordering, which series
  are "VIP", and specific episode counts can all drift. If a test starts
  failing, check whether the site's catalog changed before assuming the test
  code is wrong — but also don't assume the site changed without checking.
- Follow the existing POM conventions: locators declared in the constructor,
  methods named `open*` / `click*` / `check*` / composite verbs, no `return
this` / method chaining. See `src/pages/base.page.ts` and any existing page
  object before adding a new one.
- Priority for new locators: `data-testid` → ARIA role/text → CSS. Document
  in a comment when a testid doesn't exist and a fallback is used, same as
  `VideoPage.episodeCounterBadge`.
- This site duplicates several DOM nodes for responsive breakpoints, and at
  least one section is duplicated further down the page for engagement
  purposes (see `paywall.modal.ts`). When a `toHaveCount`/`toBeVisible`
  assertion is flaky or off by a multiple, suspect duplication before
  suspecting Playwright.
- **`storageState` reuse is deliberate, not universal.** `episode-boundary-and-paywall-content.spec.ts`
  and `free-episode-plays-without-paywall.spec.ts` reuse a signed-in session
  via `authStoragePath` (`test.use({ storageState: ... })`) because sign-in
  is only a precondition for them. `vip-series-instant-paywall.spec.ts`
  does a real, from-scratch UI sign-in every run on purpose — it's the
  suite's only coverage of that flow. Don't switch it to storageState reuse
  without adding sign-in coverage somewhere else first.
- **Prefer a guarded getter over `!` for state populated after construction**
  (see `VideoPage`'s private `state?` + `requireState()`), and `T | null`
  over a sentinel value like `-1` for "not found" (see
  `PaywallModal.getSelectedPlanIndex()`). Both fail loudly and specifically
  instead of silently misbehaving.

## No silent exceptions

Don't swallow an exception without either re-raising, failing the test
explicitly, or leaving a comment on why it's genuinely safe to ignore (e.g.
`VideoPage.resolveScope()`'s `catch { this.usedHandoffFrame = false }` — it
only triggers if BOTH the iframe attach and the top-level content wait miss
their timeout, meaning a genuinely broken page; `contentContainer`'s own
`toBeVisible()` right after has nothing to resolve against in either scope
and fails with a clear message). A bare `catch { return null }` with no
explanation is a bug, not a style choice — it turns a real failure into a
quietly-wrong pass.

## Comments — short by default

Inline comments are for the non-obvious "why" (a quirk, a race, a
measurement), 1-3 lines. Don't narrate what the next line does, and don't
re-tell the full investigation history inline — that belongs in
`docs/exploration-notes.md`; the code comment should just point there.
Long, multi-paragraph comments in page objects are a sign the explanation
belongs in the docs instead.

## Keep the docs current

Whenever you learn something new about the site, fix a flaky test, or root-
cause a known gap, update `docs/exploration-notes.md` (the raw evidence) and
`README.md`'s Known Limitations (the summary) in the same change — not as a
follow-up. A stale note that contradicts the actual code is worse than no
note at all.

## Running tests

```bash
npm test                 # both mobile projects
npm run test:iphone      # WebKit / iPhone 13 only
npm run test:pixel       # Chromium / Pixel 5 only
npm run test:smoke       # @smoke only
npm run test:regression  # @regression only
npm run test:headed      # visible browser
npm run test:ui          # Playwright UI mode
npm run report           # open the last HTML report
```

## Before committing

- `npx tsc --noEmit`
- `npm run lint`
- `npm test` against both mobile projects (or at least one, if iterating
  quickly) — this hits the real production site, so keep runs purposeful.
