# Plan: US-3 ranking engine (deal score, budget, tie-breaks, badges)

Branch `feat/3-ranking`, from `main` @ `54ccb85` (PRs #1–#4 merged). This plan is saved as `docs/plans/3-ranking.md` and committed before any test or code.

## Context

HW4 Part 3 requires strict TDD: a failing test first, the minimum code to pass, then a refactor that keeps behavior. This repeats for every acceptance criterion, with separate `[red]`, `[green]` and `[refactor]` commits. Ranking (US-3 Rank and US-4 AC2, the over-budget list) is core P0 logic that is not built yet. `docs/plans/2-source-adapters.md` left it for this exercise on purpose. It is a pure function, so every criterion becomes a deterministic assertion, with no database, network or AI involved.

## Explore findings

- `src/lib/ranking/` does not exist. Inputs come from `Listing` (`src/lib/sources/types.ts`): `price: number` (≥ 0), `rating: number | null` (0–5), `reviewCount: number | null` (integer ≥ 0).
- CLAUDE.md rules for ranking:
  - It is a pure function that never imports `next`, Prisma or any I/O module, and it runs in the browser.
  - Tests sit next to the code, and their names cite acceptance criteria.
  - Coverage must be ≥ 90 % for `src/lib/ranking`.
  - No new dependencies without asking.
- PRD §Ranking and DESIGN §6 give the exact formula. DESIGN adds two rules: `norm` returns 1 when `hi == lo`, and when all weights are 0 the total uses 1. Where the mockup `renderVals()` in `docs/design/source/Results.dc.html` differs from the PRD, the PRD wins.
- `tests/fixtures/google-shopping/headphones.json` normalizes to 6 listings, including:
  - two with no rating and no reviews;
  - one rated 3.9;
  - one priced $1,139.50.
- Baseline at `54ccb85`:
  - 10 test files and 130 tests pass.
  - Lint and typecheck are clean.
  - Coverage of `src/lib`: statements 92.85 %, branches 93.25 %, functions 95.65 %, lines 94.05 %.

## Human decisions

| Topic                           | Decision                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Price min/max                   | Taken over **all** listings, before the budget filter (PRD "across the result set"; DESIGN "over all listings in the result set"; the mockup works the same way)          |
| Tie-break input                 | The **rounded** deal score                                                                                                                                                |
| TOP RATED                       | Never given to a listing with a null rating                                                                                                                               |
| Over-budget listings            | Keep their deal score and `limitedData` flag; get no rank and no badge; stay in input order                                                                               |
| Null review count in tie-breaks | Counts as 0                                                                                                                                                               |
| Badge ties                      | Go to the higher-ranked listing                                                                                                                                           |
| Complete ranking ties           | Keep input order (stable sort)                                                                                                                                            |
| Badge non-reassignment          | Follows the mockup (see below)                                                                                                                                            |
| Presets                         | Out of scope (US-4 AC1)                                                                                                                                                   |
| Dependencies                    | None added (no fast-check)                                                                                                                                                |
| Refactoring                     | A real refactoring review every cycle; a `[refactor]` commit only when there is a meaningful behavior-preserving improvement; a cycle with none is documented, not padded |

### Review findings

1. **Equal prices give a price score of 0, not 1.**
   - What the specs say: `norm` returns 1 when `hi == lo` (DESIGN §6, mockup line 275), and `priceScore = 1 − norm(price, min, max)` (PRD, DESIGN, mockup line 282). Neither the PRD, DESIGN nor the mockup has a separate rule for equal prices.
   - Consequence: when every listing has the same price (including a single listing), every price score is **0**. Price then adds nothing to any score, so the ranking falls back to quality, popularity and the tie-breaks.
   - Correction: the earlier draft expected 1. The tests follow the documented formula and expect 0.
2. **Badge non-reassignment.**
   - What DESIGN §6 says: "#1 → BEST OVERALL; otherwise the cheapest in-budget item → LOWEST PRICE; otherwise the highest-rated → TOP RATED."
   - What the mockup does (lines 295–300): it picks the single cheapest listing and the single highest-rated listing. It shows a badge only if that listing has no higher-priority badge.
   - Decision: if the cheapest listing is #1, **no listing** gets LOWEST PRICE. If the highest-rated listing is #1 or is the LOWEST PRICE listing, **no listing** gets TOP RATED. The badge is never passed on to the next candidate.
   - Conflict check: this does not contradict the PRD, which only says "Badges mark BEST OVERALL, LOWEST PRICE and TOP RATED", or the DESIGN wording. No conflict remains.

## Input contract

The ranking engine trusts its inputs and does **not** re-validate them. Each value is guarded upstream:

| Input                               | Domain                                                      | Guarded by                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Listing.price`                     | finite, ≥ 0                                                 | `listingSchema` (Zod 4 rejects NaN and ±Infinity; `.nonnegative()`)                                                  |
| `Listing.rating`                    | finite 0–5, or `null`                                       | `listingSchema`                                                                                                      |
| `Listing.reviewCount`               | integer ≥ 0, or `null`                                      | `listingSchema`                                                                                                      |
| `Weights`                           | finite numbers ≥ 0 (sliders 0–100, step 5, per DESIGN §4.2) | Slider bounds in the UI. Saved weights go through the Zod schema of `PATCH /api/me/weights` (US-4 AC3, future work). |
| `budget`                            | finite ≥ 0, or `undefined` (no budget)                      | Search form and budget slider ($50–$300)                                                                             |
| Factor scores passed to `dealScore` | 0–1                                                         | Produced only by `norm`, which always returns a value in 0–1                                                         |

Negative, NaN or infinite weights and out-of-range factor scores are outside the contract. The engine does not test or handle them. `reviewCount = 0` _is_ inside the contract: `log10(0) = −Infinity` and the clamp turns it into 0.

## Acceptance criteria

| ID  | Requirement                                                                                                                                                                                                                                 | Source                            | Cycle |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----- |
| R1  | `norm(v, lo, hi) = clamp((v − lo)/(hi − lo), 0, 1)`; returns 1 when `hi == lo`                                                                                                                                                              | PRD §Ranking; DESIGN §6           | 1     |
| R2  | `sP = 1 − norm(price, min, max)`, so equal prices score 0                                                                                                                                                                                   | PRD §Ranking; DESIGN §6           | 1     |
| R3  | `sQ = norm(rating, 4.0, 5.0)`                                                                                                                                                                                                               | PRD §Ranking                      | 1     |
| R4  | `sPop = norm(log10(reviews), 3, 4)`, i.e. 1,000–10,000 reviews                                                                                                                                                                              | PRD §Ranking                      | 1     |
| R5  | `dealScore = round(100 × Σ w·s / Σ w)`, always 0–100                                                                                                                                                                                        | US-3 AC1; PRD §Ranking            | 2     |
| R6  | Default weights 30/45/25                                                                                                                                                                                                                    | PRD §Ranking                      | 2     |
| R7  | When all weights are 0, the total uses 1                                                                                                                                                                                                    | DESIGN §6                         | 2     |
| R8  | A missing rating or review count scores 0                                                                                                                                                                                                   | PRD §Ranking                      | 3     |
| R9  | …and is flagged "Limited data"                                                                                                                                                                                                              | PRD §Ranking                      | 3     |
| R10 | Listings with `price > budget` are excluded from the ranked list and returned as over budget (score kept, no rank or badge, input order)                                                                                                    | US-4 AC2; PRD §Ranking; DESIGN §6 | 4     |
| R11 | In-budget listings are sorted by deal score, highest first, and ranked 1..n                                                                                                                                                                 | US-3 AC1; DESIGN §6               | 4     |
| R12 | Ties go to the lower price, then more reviews (null = 0), then input order                                                                                                                                                                  | US-3 AC1                          | 4     |
| R13 | Badges: #1 gets BEST OVERALL; the cheapest in-budget listing gets LOWEST PRICE unless it is #1; the highest-rated in-budget listing (non-null rating) gets TOP RATED unless it already has a badge; no reassignment; at most one badge each | US-3 AC2; DESIGN §6; mockup       | 5     |

Every requirement has at least one test. Test names start with the story and criterion (`US-3 AC1: …`, `US-3 AC2: …`, `US-4 AC2: …`) or with `Ranking: …` for rules that only the PRD Ranking section and DESIGN §6 define.

## Design

### `src/lib/ranking/score.ts`

- `norm(v, lo, hi)`, `priceScore(price, min, max)`, `qualityScore(rating)`, `popularityScore(reviewCount)`
- `type Weights = { price: number; quality: number; popularity: number }`; `DEFAULT_WEIGHTS = { price: 30, quality: 45, popularity: 25 }`
- `dealScore(factors, weights = DEFAULT_WEIGHTS): number`
- `factorScores(listing, { min, max })` returns `{ price, quality, popularity, limitedData }`

### `src/lib/ranking/rank.ts`

- `rankListings(listings, { weights?, budget? })` returns `{ ranked, overBudget }`
  - Price min/max come from all listings.
  - `ranked` entries carry `dealScore`, `factors`, `limitedData`, `rank` and `badge`.
  - `overBudget` entries carry `dealScore`, `factors` and `limitedData`, in input order.
  - The input is never mutated, and the same input always gives the same output.

### `src/lib/ranking/badges.ts`

- Badge selection per R13, called by `rankListings`. `badge` is `"BEST OVERALL" | "LOWEST PRICE" | "TOP RATED" | null`.

## TDD cycles

| Cycle                             | Requirements                | Test file       | Expected RED                                                      | Minimum GREEN                                           | Refactoring to consider                                             |
| --------------------------------- | --------------------------- | --------------- | ----------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| 1 Normalization and factor scores | R1–R4                       | `score.test.ts` | `./score` module not found                                        | `norm`, `priceScore`, `qualityScore`, `popularityScore` | Pull out a clamp helper; name the 4–5 and 3–4 ranges                |
| 2 Weighted deal score             | R5–R7                       | `score.test.ts` | `dealScore` / `DEFAULT_WEIGHTS` missing; cycle 1 tests still pass | `dealScore`, `DEFAULT_WEIGHTS`                          | One factor-key list for the weighted sum; a zero-total guard helper |
| 3 Missing data                    | R8–R9                       | `score.test.ts` | `factorScores` missing                                            | `factorScores`                                          | Share one null check between the score and the flag                 |
| 4 Budget, sort, ties              | R10–R12 (R5 on the fixture) | `rank.test.ts`  | `./rank` module not found                                         | `rankListings`                                          | Comparator, over-budget predicate, price-range helper               |
| 5 Badges                          | R13                         | `rank.test.ts`  | Assertion failure: `badge` is undefined                           | `badges.ts` + wiring                                    | Shared "pick best by key" helper                                    |

Cycle 5 tests:

- #1 is BEST OVERALL.
- The cheapest listing gets LOWEST PRICE when it is not #1.
- **No** LOWEST PRICE when the cheapest listing is #1.
- The highest-rated listing gets TOP RATED when it has no other badge.
- **No** TOP RATED when the highest-rated listing is #1.
- **No** TOP RATED when the highest-rated listing is LOWEST PRICE.
- A null rating never gets TOP RATED.
- Over-budget listings are ignored when choosing badges.
- Badge ties go to the higher rank.
- A single listing gets only BEST OVERALL.
- Each listing has at most one badge.

## Out of scope

- Presets and the pressed-preset state (US-4 AC1)
- Sliders and the Results page
- Saving weights (US-4 AC3)
- "Why this rank" (US-6)
- Compare best-per-row (US-5)
- Search route, cache and dedupe
- fast-check property tests (no new dependency; the invariants are covered by example tests)
- Stryker

## TDD commit sequence

0. `docs(plans): add plan for US-3 ranking engine`
1. `test(ranking): norm and factor scores [red]` → `feat(ranking): … [green]` → `refactor(ranking): … [refactor]` (if warranted)
2. `test(ranking): weighted deal score [red]` → `[green]` → `[refactor]` (if warranted)
3. `test(ranking): missing rating and reviews score 0 and flag Limited data [red]` → `[green]` → `[refactor]` (if warranted)
4. `test(ranking): budget filter, sort and tie-breaks [red]` → `[green]` → `[refactor]` (if warranted)
5. `test(ranking): BEST OVERALL, LOWEST PRICE and TOP RATED badges [red]` → `[green]` → `[refactor]` (if warranted)

Commit rules:

- RED commits contain tests only.
- GREEN commits change only source files.
- REFACTOR commits leave every `*.test.ts` file unchanged.
- No commit is squashed. A cycle without a meaningful refactor records that decision instead of adding a cosmetic commit.

## Verification

- **RED:** `npx vitest run src/lib/ranking` must fail for the expected reason, and `npm test` must show the 130 baseline tests still passing. Raw output is saved outside the repo.
- **GREEN and REFACTOR:** `npx vitest run src/lib/ranking`, then `npm test`, `npm run lint` and `npm run typecheck`. Typecheck is expected to fail on RED commits, because the exports don't exist yet.
- **Refactor check:** `git diff --stat HEAD~1 -- '*.test.ts'` is empty, and the pass count is unchanged.
- **End:** `npm run test:coverage` shows `src/lib/ranking` ≥ 90 % for statements, branches, functions and lines.
- **Isolation:** `git diff --name-only main...` lists only `src/lib/ranking/**` and this plan.

## Definition of done

- All five cycles are complete. Each RED failed for the expected reason; each GREEN and REFACTOR passes in full.
- Lint, typecheck and `npm test` are clean.
- `src/lib/ranking` coverage is ≥ 90 % on all four metrics.
- No dependencies changed (`package.json` and the lockfile hashes are unchanged), and no files outside `src/lib/ranking/` and this plan changed.
- The Part 3 annotated log records every command, output, decision and commit hash.
- Push and PR happen only after the owner approves.
