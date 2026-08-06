# CLAUDE.md

Guidance for Claude Code (or any AI agent) working in this repository.

## What this is

Playwright + TypeScript e2e tests for the mobile web version of
https://my-drama.com — a real, external, third-party production site (not
something we own or control). Tests cover the path from landing on the site
to the subscription paywall.

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

## Before committing

- `npx tsc --noEmit`
- `npm run lint`
- `npm test` against both mobile projects (or at least one, if iterating
  quickly) — this hits the real production site, so keep runs purposeful.
