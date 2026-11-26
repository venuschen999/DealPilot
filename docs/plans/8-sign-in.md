# Plan: US-8 sign-in / sign-up (core)

Branch `feat/8-sign-in`, stacked on `chore/claude-setup-auth` (the Part 1 iteration). This plan is saved as `docs/plans/8-sign-in.md` and committed before any code.

## Context

HW4 Part 2 is being redone on a visible feature. The user updated the PRD and design with a full sign-in spec (US-8, DESIGN 4.8, `screens/00-sign-in.png`, `00b-sign-in-flow.png`). The agreed scope is **core sign-in**:
- the `/sign-in` page: Google or email link, "check your email", expired-link error;
- a header showing Sign in, or an avatar and Sign out;
- returning to the page the user came from;
- redirecting guests away from protected routes;
- a server-side ADMIN check returning 403.

Agreed choices: **local Docker PostgreSQL**, and **magic links printed to the server console in development**. The guest sign-in dialog, pending actions and original-tab polling move to US-7.

## Explore findings
- **Starting code:** `src/` has only the scaffold (`layout.tsx`, starter `page.tsx`, a `globals.css` with no design tokens) plus `src/lib/sources/`. There's no database, auth or UI components yet. The only existing patterns to follow are the Zod-at-boundaries style and the co-located Vitest tests in `src/lib/sources/`.
- **Next 16** (`node_modules/next/dist/docs`):
  - middleware is now **`proxy.ts`**, and the docs say proxy is for *optimistic* checks only;
  - `forbidden()` renders a 403 but needs `experimental.authInterrupts`;
  - `cacheComponents: true` is on, so reading the session in the shared header must sit inside `<Suspense>`.
- **Auth.js:** `next-auth@5.0.0-beta.32` supports Next 16 and React 19. Its peer dependencies don't include Prisma 7, and Prisma 7 changes the client setup, so we use **Prisma 6.19** with `@auth/prisma-adapter`. The Resend provider takes a custom `sendVerificationRequest`, so development can log the link without installing nodemailer.
- **PRD US-8 rules:**
  - sign-in and sign-up are one step, so the first sign-in creates the account;
  - links work once and expire after 24 h (Auth.js deletes the token on use; `maxAge` set to 24 h);
  - expired or used links show "This link no longer works";
  - ADMIN is checked server-side;
  - sign-out clears the session (database sessions delete the row).
- **Design:**
  - **Header:** guests see Search · Results · Compare plus a primary **Sign in** button; signed-in users get a wishlist link and an initials avatar; admins also get a shield **Admin** link.
  - **Card:** 440 px wide. Tokens and fonts (Inter and Space Grotesk) are in DESIGN §2.
- **Permissions:** `.env` is unreadable and uneditable for Claude, so the user creates `.env` from `.env.example`.

## Design

**Database**
- `docker-compose.yml`: `db` service (postgres:16, port 5432, named volume).
- `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY` (optional), `EMAIL_FROM`.
- `prisma/schema.prisma`: `Role` enum, plus `User` as in architecture.md with the adapter's required `emailVerified` and `image` fields, plus the standard `Account`, `Session` and `VerificationToken`. Other app tables arrive with their features.
- First migration: `init_auth`.
- `src/lib/db/prisma.ts`: PrismaClient singleton (one global in dev).

**Auth (`src/lib/auth/`)**
- `callback-url.ts` (pure): `safeCallbackUrl(value: unknown): string` returns the value only if it's a same-origin relative path. It rejects `//evil`, `/\evil`, absolute URLs and `javascript:`, and falls back to `/`.
- `initials.ts` (pure): `initialsFor(name, email)` for the avatar.
- `magic-link-email.ts` (pure): `buildMagicLinkEmail(url)` returns `{ subject, text, html }` using the DESIGN copy. `sendMagicLink` logs the link in development; in production it POSTs to `api.resend.com` (allowlisted host).
- `guards.ts`:
  - `requireUser(path)` redirects to `/sign-in?callbackUrl=<path>`;
  - `requireAdmin(path)` runs `requireUser` and then `forbidden()` unless the role is ADMIN.
  - The role is read from the database session, never from the request.
- `proxy-rules.ts` (pure): `needsSignIn(pathname, hasSessionCookie)` for `/wishlist` and `/admin`.
- `src/auth.ts`: `NextAuth({ adapter: PrismaAdapter(prisma), session: { strategy: "database" }, … })`
  - providers: `[Google (only when configured), Resend({ maxAge: 86400, sendVerificationRequest })]`
  - pages: sign-in and errors both go to `/sign-in`; verify-request goes to `/sign-in?sent=1`
  - the session callback adds `id` and `role`
  - exports `handlers`, `auth`, `signIn`, `signOut`
- `src/app/api/auth/[...nextauth]/route.ts`: re-exports `handlers`.
- `src/proxy.ts`: an optimistic redirect when the session cookie is missing (no database call).

**UI**
- `globals.css` `@theme`: DESIGN §2 color tokens and radii. `layout.tsx` loads Inter and Space Grotesk via `next/font`.
- `src/components/Header.tsx` (Server Component inside `<Suspense>`; shows the guest header while loading). Logo and nav, then either:
  - guest: **Sign in** button;
  - signed in: wishlist link (count comes with US-7), initials avatar, **Sign out** (form plus server action), and **Admin** for admins only.
- `src/app/sign-in/page.tsx`, with states from search params:
  - default form: context banner when `callbackUrl` is set, Continue with Google, "or", Email, Email me a sign-in link, helper text, Continue as guest, Terms line;
  - `?sent=1`: "Check your email" plus Use a different email;
  - `?error=Verification`: "This link no longer works" plus Send a new link plus Other sign-in options;
  - other errors: a generic message.
  - Forms post to server actions that call `signIn(...)` with a safe `callbackUrl`.
- `src/app/wishlist/page.tsx` and `src/app/admin/page.tsx`: minimal stubs guarded by `requireUser` / `requireAdmin`, so the redirect and the 403 are demonstrable. US-7 and US-9 replace them.
- `src/app/forbidden.tsx`: 403 page.
- `next.config.ts`: `experimental.authInterrupts: true`.
- `page.tsx`: replace the starter content with a minimal placeholder hero (the real search page is US-1).

**Dependencies (ask before install):** `next-auth@5.0.0-beta.32`, `@auth/prisma-adapter`, `@prisma/client@6`, `prisma@6` (dev).

## Out of scope
- the guest sign-in dialog and pending actions (US-7);
- original-tab polling;
- the shopper-specific context banner text such as "save {product}";
- the wishlist count;
- real email sending in production (one-file swap: add a Resend key);
- Terms and Privacy pages;
- Playwright E2E (added later per CLAUDE.md).

## Commits
1. `docs(plans): add plan for US-8 sign-in`
2. `chore(db): add Docker PostgreSQL, Prisma schema for User and Auth.js tables` (schema, migration, client singleton, `.env.example`)
3. `test(auth): callback URL guard and initials [red]` → `feat(auth): … [green]`
4. `test(auth): magic link email content [red]` → `feat(auth): … [green]`
5. `test(auth): requireUser/requireAdmin and proxy rules [red]` → `feat(auth): … [green]`
6. `feat(auth): configure Auth.js with Google and email link, database sessions`
7. `feat(ui): design tokens, fonts and header with sign-in state`
8. `feat(auth): sign-in page with check-email and expired-link states`
9. `feat(auth): protect wishlist and admin, add 403 page`
10. `docs: local setup for sign-in in README`

Test names cite ACs, e.g. `US-8 AC: rejects an absolute callback URL`.

## Verification
- Every commit: `npm run lint && npm run typecheck && npm test`. Red commits fail for the expected reason.
- Manual run, after the user creates `.env`:
  1. `docker compose up -d db` and `npx prisma migrate dev`, then `npm run dev`.
  2. Guest header shows **Sign in**, which opens `/sign-in`.
  3. Submit an email. The page shows "Check your email" and the terminal prints the link.
  4. Open the link: it creates the account and returns to `callbackUrl`. The header shows the avatar. `npx prisma studio` shows the User and Session rows.
  5. Reuse the same link: "This link no longer works".
  6. Signed out, `/wishlist` redirects to `/sign-in?callbackUrl=/wishlist`. Signed in as SHOPPER, `/admin` returns 403.
  7. Set role ADMIN in Studio: the Admin link appears and `/admin` loads.
  8. Sign out: the Session row is deleted and the header returns to the guest state.
- Google is verified only once the user adds OAuth credentials. Without them the button is hidden.
