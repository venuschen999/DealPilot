# DealPilot

DealPilot is an AI-powered shopping assistant that helps users find products from a photo or text description and compare deals across retailers by price, ratings, and overall value.

Specs live in `docs/`: [PRD](docs/PRD.md), [architecture](docs/architecture.md), [design](docs/design/DESIGN.md) and [plans](docs/plans/).

## Local setup

Requirements: Node 20+, Docker Desktop.

1. Install dependencies: `npm install`
2. Start PostgreSQL: `npm run db:up` (Docker container `db` on port 5432)
3. Create `.env` in the project root:

   ```bash
   DATABASE_URL="postgresql://dealpilot:dealpilot@localhost:5432/dealpilot"
   AUTH_SECRET="<output of: openssl rand -base64 32>"

   # Optional: Google sign-in. The Google button is hidden until both are set.
   # Redirect URI: http://localhost:3000/api/auth/callback/google
   AUTH_GOOGLE_ID=""
   AUTH_GOOGLE_SECRET=""

   # Production only: email delivery for magic links.
   AUTH_RESEND_KEY=""
   EMAIL_FROM="DealPilot <no-reply@dealpilot.app>"
   ```

4. Create the tables: `npx prisma migrate dev`
5. Run the app: `npm run dev`, then open http://localhost:3000

## Sign in (US-8)

Sign-in and sign-up are one step: the first sign-in creates the account. There are no passwords.

- **Email link:** on `/sign-in`, enter an email. In development no email is sent; the sign-in link is printed in the terminal running `npm run dev`. Open it to sign in. Links work once and expire after 24 hours.
- **Google:** works once `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set.
- **Admin:** every account starts as SHOPPER. To make one an admin, open `npx prisma studio`, set the user's `role` to `ADMIN`, and reload.

### Manual check

| Step | Expected |
| --- | --- |
| Open `/` signed out | Header shows **Sign in** |
| Open `/wishlist` signed out | Redirects to `/sign-in?callbackUrl=%2Fwishlist` with a "return to where you were" banner |
| Submit an email | "Check your email"; the link appears in the terminal |
| Open the link | Back on `/wishlist`, signed in; header shows Wishlist, initials avatar, Sign out |
| Open the same link again | "This link no longer works" with Send a new link |
| Open `/admin` as SHOPPER | 403 page |
| Set role ADMIN in Prisma Studio, reload | Header shows Admin; `/admin` loads |
| Sign out | Header shows Sign in; the Session row is gone in Prisma Studio |

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run lint` / `npm run typecheck` / `npm test` | Checks run before every commit |
| `npm run test:coverage` | Coverage (70% threshold) |
| `npm run db:up` | Start local PostgreSQL |
| `npx prisma studio` | Browse the database |
