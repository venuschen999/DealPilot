# Plan: US-2 source adapters (Listing, ProductSource, Google Shopping adapter)

Branch: `feat/2-source-adapters` (from `chore/claude-code-setup`). Saved to `docs/plans/2-source-adapters.md` and committed before any code.

## Context

HW4 Part 2 needs a real P3 feature built Explore → Plan → Implement → Commit, with at least 3 commits. Every other DealPilot feature (search route, ranking, compare, wishlist snapshots, cache payloads) consumes a normalized `Listing`, and none exists yet. This builds that data layer for US-2 ("Discover across platforms"). It deliberately leaves ranking for Part 3's TDD exercise.

**Explore findings**
- `src/` is only the create-next-app scaffold: no `lib/`, no tests, no fixtures. There is nothing to reuse except Zod 4 (installed) and the `@/*` alias.
- PRD (Data sources): the `Listing` fields are title, platform, price, rating, reviewCount, shipping, returnDays, url, imageUrl, gtin, brand, model. The v1 provider is a Google Shopping results API such as SerpApi. No scraping.
- architecture.md: `enum Platform { AMAZON EBAY WALMART BEST_BUY TARGET OTHER }`. `WishlistItem.snapshot` and `SearchCache.payload` store `Listing` as JSON, so the schema has to survive a JSON round trip (no Dates or class instances).
- PRD US-2 AC1: each card also shows **match type**. PRD Ranking: a missing rating or review count is flagged "Limited data", so those fields must be nullable, not 0.
- CLAUDE.md: `ProductSource` lives in `src/lib/sources/types.ts`. Zod at every boundary. Tests use `tests/fixtures/` only, with no live calls. API keys stay server-side. Only allowlisted hosts (A10 SSRF). TDD with `[red]`/`[green]` commits applies to logic.
- `docs/design/source/Results.dc.html` sample data shows shipping and returns combined as display text ("Free shipping · 30-day returns"). We store `shipping` as text and `returnDays` as a number so the Compare page can mark the best return window.

## Design

### `src/lib/sources/types.ts`
- `PLATFORMS` const tuple matching the Prisma enum; `Platform` type.
- `listingSchema` (Zod) with inferred `Listing` type, a single source of truth:
  - `id: string`: stable, `${source}:${providerProductId ?? url}`, used in `/compare?ids=`
  - `source: string` (e.g. `"google-shopping"`), `platform: Platform`, `storeName: string` (raw store label, for display when `OTHER`)
  - `title: string`, `price: number` (≥ 0, dollars), `url: string` (https URL)
  - `rating: number | null` (0–5), `reviewCount: number | null` (int ≥ 0)
  - `shipping: string | null`, `returnDays: number | null`, `imageUrl: string | null`
  - `gtin`, `brand`, `model: string | null`
  - `matchType: "EXACT" | "SIMILAR"`, defaults to `SIMILAR` (PRD fallback; the AI step upgrades it later)
- `SearchQuery = { q: string }` and `ProductSource = { id: string; search(query, opts?: { signal?: AbortSignal }): Promise<Listing[]> }`

### `src/lib/sources/platform.ts`
- `toPlatform(storeName: string): Platform`. Case-insensitive match on known labels ("Amazon", "Amazon.com", "eBay", "Walmart", "Best Buy", "Target", …). Anything else is `OTHER`. Brand stores stay OTHER (the PRD says the API covers "many brand-run stores").

### `src/lib/sources/google-shopping/`
- `raw-schema.ts`: lenient Zod schema for a SerpApi-style response, `{ shopping_results?: Item[] }`. Item fields are all optional except title: `product_id`, `title`, `product_link`/`link`, `source`, `price`, `extracted_price`, `rating`, `reviews`, `delivery`, `extensions[]`, `thumbnail`. Unknown keys are ignored.
- `normalize.ts`: `normalizeShoppingResults(raw: unknown): Listing[]`
  - Throws a typed `SourceResponseError` if the top-level shape is invalid. Individual bad items are **skipped**, not fatal: no URL, no parseable price, or a non-https link.
  - Price: `extracted_price`, otherwise parse `price` ("$1,299.99").
  - `returnDays`: parsed from `"30-day returns"` style text in `delivery`/`extensions`, otherwise null.
  - Every output goes through `listingSchema.parse`, so the adapter can never emit an invalid `Listing`.
- `google-shopping-source.ts`: `createGoogleShoppingSource({ apiKey, fetchFn = fetch }): ProductSource`
  - Builds `https://serpapi.com/search.json?engine=google_shopping&q=…&api_key=…`. The host is a module constant (`ALLOWED_HOST`), so no user-supplied URL is ever fetched.
  - Passes `signal` through. A non-2xx response throws `SourceResponseError` with the status but never echoes the key.
  - `fetchFn` is injected so tests never hit the network. The function is server-only (no `"use client"`, never imported by components).

### Fixture
- `tests/fixtures/google-shopping/headphones.json`: a SerpApi-shaped response with 8 items covering all five platforms plus one brand store. It includes edge cases: a missing rating, missing reviews, a string-only price, an item without a link, and "60-day returns".
- **Note:** there's no SerpApi key in the project and `curl` is denied, so this fixture is hand-written to the documented response shape, not recorded. Its `search_metadata` will say so. Replace it with a real recorded response once a key exists.

## Out of scope (follow-up issue)
8 s per-source timeout and the "source failed" notice (US-2 AC2), 30-minute cache (AC3), dedupe by GTIN or brand+model, the `/api/search` route, match-type AI. The `signal` parameter is the hook the search route will use for the timeout.

## Commits (TDD per CLAUDE.md for logic)
1. `docs(plans): add plan for US-2 source adapters`
2. `test(sources): Listing schema and platform mapping [red]`
3. `feat(sources): add Listing schema, Platform mapping and ProductSource interface [green]`
4. `test(sources): Google Shopping normalization against fixture [red]` (includes the fixture)
5. `feat(sources): normalize Google Shopping results into Listing [green]`
6. `test(sources): Google Shopping source fetch and error handling [red]`
7. `feat(sources): add Google Shopping ProductSource adapter [green]`
8. `refactor(sources): …` only if a real cleanup shows up. No empty refactor commits.

Test names reference ACs, e.g. `it('US-2 AC1: maps each result to title, platform, price, rating, reviews, shipping/returns and match type', …)`.

## Files
- New: `src/lib/sources/types.ts`, `platform.ts`, `google-shopping/{raw-schema,normalize,google-shopping-source}.ts`, a co-located `*.test.ts` for each logic file, `tests/fixtures/google-shopping/headphones.json`, `docs/plans/2-source-adapters.md`
- No dependency changes. No edits to existing files (except maybe one CLAUDE.md line if we learn something).

## Verification
- Every commit: `npm run lint && npm run typecheck && npm test` (expected failures only on `[red]` commits, confirmed by output).
- `npm run test:coverage` shows `src/lib/sources/**` ≥ 70%.
- `grep -rn "serpapi.com" src` shows the host only in the adapter constant. `grep -rn "use client" src/lib/sources` is empty.
- `git log --oneline feat/2-source-adapters` shows plan → red → green sequence for the HW4 write-up.
