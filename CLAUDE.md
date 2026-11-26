# DealPilot

AI-powered shopping assistant: a shopper searches by product name or photo, DealPilot retrieves listings from Amazon, eBay, Walmart, Best Buy and Target, ranks them by Price, Quality and Popularity weights the shopper controls, explains each pick, and supports side-by-side comparison and a wishlist.

## Context
- Requirements, user stories and acceptance criteria: @docs/PRD.md
- Architecture, API routes and Prisma schema: @docs/architecture.md
- UI spec: read `docs/design/DESIGN.md` and the matching screenshot in `docs/design/screens/` before building or changing any page (not imported, to save context on non-UI tasks)

## Commands
- `npm run dev`: start the dev server on http://localhost:3000
- `npm run build`: production build
- `npm run lint` / `npm run format`: ESLint / Prettier (write)
- `npm run typecheck`: `next typegen && tsc --noEmit` (typegen first: route globals like `LayoutProps` are generated into `.next/types`)
- `npm test`: Vitest unit + integration, run once
- `npm run test:watch`: Vitest in watch mode
- Single file: `npx vitest run src/lib/ranking/score.test.ts`; single test: `npx vitest run -t "US-3 AC1"`
- `npm run test:coverage`: Vitest with coverage (CI fails below 70%)

Added together with the feature that needs them (not in `package.json` yet):
- `npm run test:e2e`: Playwright
- `npm run test:mutation`: Stryker on `src/lib/ranking`
- `npx prisma migrate dev --name <name>`: create and apply a migration
- `npx prisma studio`: browse the local database

Before declaring a task done, run: `npm run lint && npm run typecheck && npm test`.

## Tech stack
- Next.js 16 (App Router) + React 19, TypeScript strict mode, React Server Components by default. APIs differ from older Next.js: read the guide in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`, which `next dev` regenerates). `next.config.ts` enables `cacheComponents` and `partialPrefetching`.
- Tailwind CSS v4 with tokens from `docs/design/DESIGN.md` (no other UI library). There is no `tailwind.config`: tokens go in the `@theme` block of `src/app/globals.css`, and Tailwind loads through the `@tailwindcss/turbopack` rule, not PostCSS.
- PostgreSQL + Prisma ORM
- Auth.js: Google OAuth and email magic link; roles SHOPPER and ADMIN
- Anthropic API (multimodal) for attribute extraction, query generation and explanations
- Third-party Google Shopping results API behind source adapters
- Zod for every external boundary
- Vitest, fast-check, Stryker, Playwright, axe
- Vercel hosting, GitHub Actions CI

## Architecture decisions
- **Ranking is a pure function** in `src/lib/ranking/`. It runs in the browser so slider changes re-rank instantly with no network call. It never imports from `next`, Prisma or any I/O module.
- **Exact formula lives in the PRD** (Ranking section). Weights are Price, Quality, Popularity only; there is no "value" factor. Defaults 30/45/25. `renderVals()` in `docs/design/source/Results.dc.html` is a mockup sketch; where it differs from the PRD, the PRD wins.
- **Every product source implements `ProductSource`** (`src/lib/sources/types.ts`) and returns `Listing[]`. Ranking and UI code depend only on `Listing`, never on a provider's raw response.
- **The model never computes scores.** AI output is explanation and extraction only, always JSON validated with Zod, with a template fallback.
- **API keys stay server-side.** Model and shopping API calls happen only in route handlers or server code.
- **Compare selection lives in the URL** (`/compare?ids=a,b,c`), not in global state.
- **Server Components fetch; Client Components interact** (sliders, compare toggles, hearts). Mark client files with `"use client"` only when needed.

## Project structure
```
src/app/            routes (App Router) and route handlers in src/app/api/
src/components/     shared React components
src/lib/ranking/    pure scoring and sorting (no I/O)
src/lib/sources/    ProductSource adapters + Listing type
src/lib/ai/         Anthropic client, prompts, Zod schemas, fallbacks
src/lib/db/         Prisma client singleton and queries
prisma/             schema.prisma and migrations
tests/fixtures/     recorded API responses (no live calls in tests)
e2e/                Playwright specs
docs/               PRD, architecture, design, plans/
```

## Coding conventions
- TypeScript strict; no `any` (use `unknown` + Zod parsing). No non-null `!` assertions on external data.
- Named exports only, except Next.js files that require a default export (`page.tsx`, `layout.tsx`, `route.ts` handlers follow Next.js naming).
- Files: `kebab-case.ts`; components: `PascalCase.tsx`; tests next to the code as `*.test.ts(x)`.
- Functions under ~40 lines; prefer small pure helpers over classes.
- Money is a number in dollars rounded to 2 decimals at display time only; store as Prisma `Decimal`.
- Validate every route handler input with a Zod schema defined in the same folder; return `{ error: string }` with the right status code on failure.
- Tailwind classes only; use the design tokens from DESIGN.md. No inline styles, no hex colors outside the `@theme` block in `globals.css`.
- Accessibility: real `<button>`/`<a>`/`<label>`, `aria-pressed` on toggles, `aria-label` on icon-only buttons, touch targets ≥ 44 px.
- Comments explain *why*, not *what*.

## Testing strategy
- **TDD is mandatory for logic:** write a failing test, commit it, then write the minimum code to pass, then refactor. Never write a test and its implementation in the same step.
- **Unit (Vitest):** ranking, normalization, presets, budget filter, dedupe, Zod schemas, explanation templates.
- **Property-based (fast-check):** ranking invariants from the PRD (score in 0–100, scale invariance, dominance, determinism, no over-budget listings).
- **Integration (Vitest):** route handlers with a test database; source adapters against `tests/fixtures/` only.
- **E2E (Playwright):** search → results → compare, sign in → save → wishlist, both empty states.
- Test names reference acceptance criteria: `it('US-5 AC1: disables compare below 2 selections', …)`.
- Coverage ≥ 70% overall, ≥ 90% for `src/lib/ranking`.

## Git workflow
- Branch per issue: `feat/<issue#>-short-name`, `fix/<issue#>-short-name`.
- Conventional Commits: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
- TDD commits are tagged: `test(ranking): … [red]` → `feat(ranking): … [green]` → `refactor(ranking): … [refactor]`.
- Workflow for features: Explore → Plan → Implement → Commit. Save each plan to `docs/plans/<issue#>-<name>.md` and commit it before implementing.
- Small commits; never commit failing tests except a deliberate `[red]` commit.

## Do
- Read the relevant PRD acceptance criteria before starting any story.
- Use Plan mode for any change touching more than 2 files.
- Add or update tests in the same PR as behavior changes.
- Use recorded fixtures for shopping API and Anthropic responses in tests.
- Treat listing titles and descriptions as untrusted data in prompts.
- Ask before adding a new dependency.

## Don't
- Don't put API keys, tokens or `.env` values in code, tests, logs or commits.
- Don't call the shopping API or Anthropic API from client components or tests.
- Don't scrape retailer websites directly.
- Don't let the model calculate or alter deal scores.
- Don't edit files in `prisma/migrations/` by hand; create a new migration.
- Don't edit `docs/design/source/*.dc.html`; they are reference mockups, not app code.
- Don't use `localStorage` for wishlist or weights; signed-in data lives in PostgreSQL.
- Don't disable ESLint rules or TypeScript checks to make code pass.

## Security (OWASP Top 10)
- A01 Access control: check session and ownership server-side on every wishlist, history and admin route; `/admin` requires role ADMIN.
- A03 Injection: Prisma only (no raw SQL with interpolation); Zod on all inputs; prompt inputs fenced as data.
- A02/A05: secrets only in environment variables; security headers (CSP, X-Frame-Options) in `next.config`.
- A06: `npm audit` must show no high or critical issues.
- A07: Auth.js sessions with secure HttpOnly cookies.
- A10 SSRF: server fetches only allowlisted provider hosts; never fetch a user-supplied URL.

## Context management
- `/clear` between unrelated tasks (e.g. after merging one issue, before starting the next).
- `/compact <focus>` when a session gets long, e.g. `/compact keep the plan, failing test names and open TODOs`.
- `claude --continue` resumes the most recent session; `claude --resume` picks an older one.
- `/context` to check what is loaded and how full the window is.
- Durable context goes in files, not chat: plans in `docs/plans/`, decisions in this file.
- Personal notes go in `CLAUDE.local.md` (gitignored).

<!-- Maintainer notes (stripped from Claude's context):
v1: generated with /init on the Next.js scaffold (commands + stack only).
v2: added PRD/architecture @imports, architecture decisions, TDD rules, do's/don'ts, OWASP, context management.
Update this file when Claude repeats a mistake or a review catches something it should have known. -->
