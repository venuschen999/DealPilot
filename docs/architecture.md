# DealPilot — Architecture and Data Schema

Nov 25, 2026 · Weisi Chen

## System architecture

DealPilot is one Next.js app on Vercel: the browser renders pages and re-ranks results locally, while server route handlers call the shopping API, the Anthropic API and PostgreSQL.

```mermaid
flowchart LR
  subgraph Browser
    Pages["Pages (React)"] --> Ranking["Ranking module<br/>runs client-side"]
  end
  subgraph Server["Next.js on Vercel"]
    Routes["Routes + Auth.js"]
    Adapters["Source adapters<br/>ProductSource interface"]
    AI["AI service<br/>Zod-validated JSON"]
    Prisma["Prisma client"]
    Routes --> Adapters
    Routes --> AI
    Routes --> Prisma
  end
  subgraph External["External services"]
    OAuth["Google OAuth"]
    Shop["Shopping API<br/>SerpApi or similar"]
    Claude["Anthropic API"]
    PG[("PostgreSQL")]
  end
  Pages -- JSON --> Routes
  Routes --> OAuth
  Adapters --> Shop
  AI --> Claude
  Prisma --> PG
```

Only the server holds API keys; the browser receives normalized listings as JSON and does all re-ranking itself.

**Key decisions**

- Ranking is a pure function in `lib/ranking`, shared by the client and tests, so weight changes need no network call.
- Every product source sits behind the `ProductSource` adapter interface and returns the same `Listing` shape.
- All API inputs and model outputs are validated with Zod at the boundary.
- Server Components fetch data; Client Components handle sliders, compare selection and hearts.
- Compare selection lives in the URL (`/compare?ids=`), so compare pages are shareable and testable.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router), TypeScript strict mode |
| UI | Tailwind CSS, tokens from `docs/design/DESIGN.md` |
| Database | PostgreSQL with Prisma ORM |
| Auth | Auth.js (Google OAuth, email magic link) |
| AI | Anthropic API (multimodal), Zod-validated JSON output |
| Product data | Third-party Google Shopping results API via adapters |
| Testing | Vitest, fast-check, Stryker, Playwright, axe |
| Hosting and CI/CD | Vercel (preview and production), GitHub Actions |

## API routes

All routes are Next.js route handlers; every input is validated with Zod and every protected route checks the session server-side.

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/extract` | Public, rate-limited | Image and text → attributes and search queries |
| `POST /api/search` | Public, rate-limited | Queries → normalized listings (cached 30 min, admin overrides applied) |
| `POST /api/explain` | Public | Scores and listings → explanations and compare summary |
| `GET /api/wishlist` · `POST` · `DELETE /api/wishlist/:id` | Shopper (own items only) | Read, add and remove wishlist items |
| `GET /api/history` | Shopper | Last 10 searches |
| `PATCH /api/me/weights` | Shopper | Save default weights |
| `POST /api/flags` | Shopper | Report a wrong match with a reason and optional note |
| `GET /api/admin/usage` · `PATCH /api/admin/sources/:platform` | Admin | Usage and source toggles |
| `GET /api/admin/flags` · `GET /api/admin/flags/:id` | Admin | Flagged matches list and one flag with its reports, search and listing |
| `PATCH /api/admin/flags/:id` | Admin | Resolve or reopen a flag; writes a ListingOverride unless dismissed |
| `/api/auth/*` | Public | Auth.js sign-in and session |

## Data schema

Eight application tables live in PostgreSQL alongside the standard Auth.js tables (Account, Session, VerificationToken). Listings themselves are not stored, except as snapshots in wishlist items and cached search payloads.

| Entity | Purpose | Key constraints |
| --- | --- | --- |
| User | Account, role and default weights | Unique email; role defaults to SHOPPER |
| WishlistItem | Saved listing snapshot with original URL | Unique (userId, url); cascade on user delete |
| SearchHistory | Recent searches per user | Trimmed to the last 10 per user |
| SearchCache | Cached search responses | Unique queryHash; expires after 30 minutes |
| SourceConfig | Platform on/off switch | One row per platform |
| ApiUsage | Daily calls and estimated cost per source | Unique (source, date) |
| MatchFlag | Shopper report of a wrong match, with the search it came from and the admin's decision | Status OPEN or RESOLVED; resolution set when resolved |
| ListingOverride | Admin decision applied whenever results are served, cached or fresh | Unique (listingUrl, queryHash); null queryHash = all searches |

```prisma
enum Role { SHOPPER ADMIN }
enum Platform { AMAZON EBAY WALMART BEST_BUY TARGET OTHER }
enum FlagStatus { OPEN RESOLVED }
enum FlagReason { DIFFERENT_PRODUCT WRONG_COLOR_OR_SIZE WRONG_PRICE OTHER }
enum Resolution { RELABEL_SIMILAR REMOVE_FROM_SEARCH BLOCK_EVERYWHERE DISMISSED }

model User {
  id             String          @id @default(cuid())
  email          String          @unique
  name           String?
  role           Role            @default(SHOPPER)
  defaultWeights Json?           // { price, quality, popularity }
  createdAt      DateTime        @default(now())
  accounts       Account[]
  sessions       Session[]
  wishlist       WishlistItem[]
  searches       SearchHistory[]
  flags          MatchFlag[]
}

model WishlistItem {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform    Platform
  url         String
  title       String
  imageUrl    String?
  priceAtSave Decimal  @db.Decimal(10, 2)
  priceNow    Decimal? @db.Decimal(10, 2)
  snapshot    Json     // normalized Listing at save time
  savedAt     DateTime @default(now())

  @@unique([userId, url])
}

model SearchHistory {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  query      String
  attributes Json
  createdAt  DateTime @default(now())

  @@index([userId, createdAt])
}

model SearchCache {
  queryHash String   @id
  payload   Json     // Listing[]
  expiresAt DateTime

  @@index([expiresAt])
}

model SourceConfig {
  platform  Platform @id
  enabled   Boolean  @default(true)
  updatedBy String?
  updatedAt DateTime @updatedAt
}

model ApiUsage {
  id         String   @id @default(cuid())
  source     String
  date       DateTime @db.Date
  calls      Int      @default(0)
  estCostUsd Decimal  @default(0) @db.Decimal(10, 4)

  @@unique([source, date])
}

model MatchFlag {
  id         String      @id @default(cuid())
  userId     String
  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  listingUrl String
  listing    Json        // listing snapshot as shown to the shopper
  query      String
  queryHash  String      // the search the listing appeared in
  attributes Json        // attributes extracted from that search
  reason     FlagReason
  note       String?
  status     FlagStatus  @default(OPEN)
  resolution Resolution?
  adminNote  String?
  resolvedBy String?
  resolvedAt DateTime?
  createdAt  DateTime    @default(now())

  @@index([status, createdAt])
  @@index([listingUrl])
}

model ListingOverride {
  id         String     @id @default(cuid())
  listingUrl String
  queryHash  String?    // null = applies to every search
  action     Resolution // never DISMISSED
  createdBy  String
  createdAt  DateTime   @default(now())

  @@unique([listingUrl, queryHash])
}

// Account, Session and VerificationToken follow the standard Auth.js Prisma adapter schema.
```
