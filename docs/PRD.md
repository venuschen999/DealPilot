# DealPilot — Product Requirements Document

Nov 25, 2026 · Weisi Chen

## Overview

DealPilot is a web app that finds a product across Amazon, eBay, Walmart, Best Buy and Target, ranks the listings by the shopper's own priorities, and explains each pick.

**Problem.** Shoppers spend significant time comparing prices, reviews and quality across platforms, and the cheapest listing is often not the best deal.

**Solution.** The shopper enters a product (with optional features, budget, brand, size and color) or uploads a photo. AI extracts attributes and builds search queries; DealPilot retrieves listings, scores them with weights the shopper controls, and supports side-by-side comparison and a wishlist.

**Design.** The approved UI is specified in `docs/design/DESIGN.md`.

## Goals and success metrics

**Goals:** find identical or similar products from a photo or text; show multiple platforms in one ranked view; let shoppers control ranking with weights and a budget; explain every recommendation; keep a wishlist with links to original listings.

**Non-goals:** payments and checkout, native mobile apps, price history and price-drop alerts.

| Metric | Target |
| --- | --- |
| Search-to-results time (p95) | ≤ 10 s uncached, ≤ 2 s cached |
| Attribute extraction accuracy | ≥ 80% of attributes accepted without edits |
| Searches returning ≥ 2 platforms | ≥ 90% |
| Accessibility | 0 critical axe violations |

## Users and roles

DealPilot has three roles. Sign-in uses Auth.js (Google OAuth and email magic link); the admin role is set server-side only.

| Capability | Guest | Shopper | Admin |
| --- | --- | --- | --- |
| Search, rank and compare | Yes | Yes | Yes |
| Wishlist, search history, saved weights | No | Yes | Yes |
| Manage sources, view usage, review flagged matches | No | No | Yes |

## User stories and acceptance criteria

Each acceptance criterion maps to at least one automated test.

**US-1 · Search (P0).** As a shopper, I want to search by product name or photo, so that I find identical or similar products.

- A product name or an image is required; Features, Budget, Brand, Size and Color are optional.
- Images must be JPG, PNG or WEBP up to 10 MB; anything else shows an inline error.
- Extracted attributes and the generated query are shown and editable before results load.

**US-2 · Discover across platforms (P0).** As a shopper, I want listings from multiple platforms, so that I compare them in one place.

- Each listing shows title, platform, price, rating, reviews, shipping/returns and match type.
- A failed or slow (> 8 s) source never blocks the others; a notice names it.
- Identical queries within 30 minutes are served from cache.

**US-3 · Rank (P0).** As a shopper, I want listings ranked by price, quality and popularity, so that I find the best deal for my priorities.

- Each in-budget listing gets a 0–100 deal score (see Ranking); ties break by lower price, then more reviews.
- Badges mark BEST OVERALL, LOWEST PRICE and TOP RATED.

**US-4 · Customize (P0).** As a shopper, I want to set weights and a budget, so that recommendations fit me.

- Sliders and presets re-rank instantly, with no new API call.
- Over-budget listings move to an "Over your budget" list.
- Signed-in shoppers' weights persist as defaults.

**US-5 · Compare (P0).** As a shopper, I want to compare products side by side, so that I can weigh trade-offs.

- 2–4 listings can be selected; compare buttons are disabled below 2.
- `/compare?ids=` shows the selected listings with the best value per row marked; no ids shows the empty state.

**US-6 · Explain (P0).** As a shopper, I want to know why a product is recommended, so that I can decide with confidence.

- Each card names its top two factors and any trade-off.
- Compare shows 3 bullets: Best overall, Best price, Best quality.
- Explanations never contradict the listing data.

**US-7 · Wishlist (P1).** As a shopper, I want to save products and open their original links.

- The heart saves a listing; guests are prompted to sign in.
- Rows show current price, price when saved and an Open listing link in a new tab.
- Shoppers can access only their own wishlist.

**US-8 · Sign in (P1).** As a shopper, I want to sign in, so that my wishlist and preferences persist.

- Google OAuth and email magic link work; protected routes redirect to sign-in.

**US-9 · Admin (P1).** As an admin, I want to manage sources and monitor usage, so that I control cost and data quality.

- `/admin` requires the admin role; others get 403.
- Admins toggle sources, see usage and cost per source, and review flagged matches.

## Screens

Layout, copy and states follow `docs/design/DESIGN.md`; every page works at 390 px wide.

| Route | Screen | Stories |
| --- | --- | --- |
| `/` | Search | US-1 |
| `/results` | Ranked results with weights, budget and compare tray | US-2, 3, 4, 6 |
| `/compare?ids=` | Side-by-side comparison, plus empty state | US-5, 6 |
| `/wishlist` | Saved listings, plus empty state | US-7 |
| `/admin` | Sources, usage and flagged matches | US-9 |

## Ranking

Ranking is a pure, deterministic function of three factors, Price, Quality and Popularity, and runs client-side so slider changes re-rank instantly.

```
dealScore = round(100 × (wP·sP + wQ·sQ + wPop·sPop) / (wP + wQ + wPop))
```

| Factor | Score (0 to 1) |
| --- | --- |
| Price, sP | 1 − norm(price, min, max) across the result set |
| Quality, sQ | norm(rating, 4.0, 5.0) |
| Popularity, sPop | norm(log10(reviews), 3, 4), i.e. 1,000 to 10,000 reviews |

norm(v, lo, hi) = clamp((v − lo) / (hi − lo), 0, 1).

- Default weights 30/45/25; presets Balanced 35/35/30, Lowest price 70/20/10, Best quality 15/65/20, Most popular 15/25/60.
- Listings over budget are excluded; a missing rating or review count scores 0 and is flagged "Limited data".

## AI features

A multimodal model (Claude via the Anthropic API) handles understanding and explanation; it never computes scores.

| Feature | Output | Fallback |
| --- | --- | --- |
| Attribute extraction | Category, brand, color, size, features | Typed fields as entered |
| Query generation | 1–3 search queries | Product name |
| Explanations | "Why this rank" sentence; 3-bullet compare summary | Template text from scores |
| Match type | Exact match or Similar | Similar |

- Model output is JSON validated with Zod; one retry, then the fallback.
- Explanations may only cite numbers from the listing data.
- Listing text is untrusted and never followed as instructions.
- Model calls run server-side only.

## Data sources

V1 uses one third-party Google Shopping results API (such as SerpApi), which covers all five platforms and many brand-run stores.

- Every source implements a `ProductSource` adapter returning a normalized `Listing` (title, platform, price, rating, reviewCount, shipping, returnDays, url, imageUrl, gtin, brand, model).
- Listings are matched as the same product by GTIN/UPC, else brand + model; each platform's listing stays separate.
- Responses are cached 30 minutes; each source times out at 8 s; shoppers are limited to 20 searches per 10 minutes.
- Amazon's Creators API ([notice](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation)) is out of v1 because access depends on Associates eligibility.
- No direct scraping of retailer sites.

## Technical approach

Next.js (App Router) on Vercel with TypeScript, Tailwind CSS, PostgreSQL with Prisma, Auth.js and the Anthropic API. Ranking runs in the browser; all API keys stay on the server.

Architecture, API routes and data schema are specified in `docs/architecture.md`.

## Non-functional requirements

- **Performance:** re-ranking ≤ 100 ms after a slider change; Search page LCP ≤ 2.5 s.
- **Security (OWASP Top 10):** server-side access checks on wishlist and admin routes; Zod validation on all inputs; Prisma parameterized queries; secrets only in environment variables; security headers (CSP); dependency scanning; server fetches only allowlisted hosts.
- **Accessibility:** WCAG 2.1 AA, including keyboard access, labeled inputs and 4.5:1 text contrast.
- **Privacy:** store only email, name, wishlist, weights and the last 10 searches; uploaded images are not retained; users can delete their account.
- **Quality:** ≥ 70% test coverage; every acceptance criterion has an automated test.

## Risks and open questions

| Risk | Mitigation |
| --- | --- |
| Shopping API cost exceeds budget | Caching, rate limits, recorded fixtures for tests |
| Provider data is incomplete | "Limited data" flag; hide comparison rows no listing has |
| Image matches are wrong | Default to Similar; editable attributes; admin review of flagged matches |
| Explanations state wrong numbers | Numeric post-check plus template fallback |

- [ ] Which shopping API provider and plan fits the budget?
- [ ] Does it return GTIN/UPC for de-duplication?
- [ ] Should guests get a temporary session wishlist?

**Out of scope for v1:** payments, order fulfillment, native mobile apps, price history and price-drop alerts.
