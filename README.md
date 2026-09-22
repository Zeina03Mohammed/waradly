# Wardly

A B2B procurement marketplace MVP: buyers post RFQs, approved suppliers submit competing
offers, buyers accept one and it becomes an order that Admin manually walks through payment,
production, hub receipt, QC, and delivery.

This is a **Lean MVP** built exactly to [`SPEC.md`](./SPEC.md) — the full developer
implementation spec. Read that file for the complete database schema, state machines,
permissions matrix, and API contract. This README only covers running the app.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript, for both the UI and the API (Route
  Handlers) — one app, no separate backend service.
- **Database:** PostgreSQL via Prisma (`prisma/schema.prisma`), versioned migrations under
  `prisma/migrations/`.
- **Auth:** Custom email/password, bcrypt password hashing, JWT access tokens (24h) + opaque
  refresh tokens (30d, revocable independently of the JWT's own expiry).
- **Styling:** Tailwind CSS, deliberately plain (internal-tool-grade, not a polished consumer
  product).
- **File storage:** A `StorageProvider` interface behind HMAC-signed, 5-minute-expiry URLs.
  `lib/storage/index.ts` picks the implementation automatically: local filesystem (`./storage/`,
  gitignored) when no R2 credentials are set, or Cloudflare R2 (S3-compatible, via
  `@aws-sdk/client-s3`) when they are — required for any hosting platform without a persistent
  disk (serverless/most PaaS).
- **Watermarking:** `sharp` (images) and `pdf-lib` (PDFs) generate a "Wardly Confidential"
  overlay once at upload time for identity-risk RFQ attachments.
- **Email:** A `NotificationChannel` interface. `lib/notifications/index.ts` picks Resend when
  `RESEND_API_KEY` is set, otherwise a console/dev channel that just logs. Every Section 14
  event is already wired to whichever one is active.
- **Scheduled jobs:** `scripts/expire-rfqs.ts`, a plain Node script (not a job queue) for the
  RFQ-expiry rule.
- **Testing:** Vitest, covering the RFQ/Offer/Order state machines (every invalid transition is
  asserted rejected, not just the valid ones), the identity-masking serializer layer, and the
  contact-info detection regexes.

## Prerequisites

- Node.js 20+
- A running PostgreSQL 14+ instance (local install or hosted) — create an empty database and
  user for the app to use.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and point DATABASE_URL at your Postgres instance
cp .env.example .env

# 3. Run migrations
npx prisma migrate deploy

# 4. Seed demo data (one admin, one active category, a verified demo buyer + supplier)
npm run seed

# 5. Start the app
npm run dev
```

The app is now running at http://localhost:3000.

### Demo accounts (created by `npm run seed`)

All three share the password `Password123`.

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@wardly.test` | Admin accounts are never self-registrable (Section 4) — this is how you get one in dev. |
| Buyer | `buyer@wardly.test` | Verified buyer, org "Acme Importing LLC". |
| Supplier | `supplier@wardly.test` | Already verified and approved for the seeded "Custom Packaging" category, so it can submit offers immediately. |

To skip re-logging-in between roles while testing manually, set `NEXT_PUBLIC_SKIP_AUTH=true` in
`.env` (see `.env.example`) — this adds quick-switch buttons to the nav bar that log in as the
three demo accounts above through the real `/auth/login` endpoint. It is **not** an auth
bypass and must never be enabled outside local development.

## Deploying (giving this to a client)

Local dev (above) runs on your own machine only. To put this on a real URL someone else can
reach, you need a host for the app and a host for the database, plus the two managed services
above configured (R2 for files, Resend for email) — without those, uploads and emails silently
break on most hosting platforms.

1. **Database — [Neon](https://neon.tech)** (or Supabase/Railway): create a project, copy its
   connection string into `DATABASE_URL`.
2. **File storage — [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2)**: create a
   bucket and an API token (R2 → Manage API Tokens), fill in `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
3. **Email — [Resend](https://resend.com/api-keys)**: create an API key, fill in
   `RESEND_API_KEY`. For real deliverability, verify your own sending domain in Resend and set
   `EMAIL_FROM` to an address on it; the sandbox `onboarding@resend.dev` address only delivers
   to your own Resend account email, fine for testing but not for a client's real users.
4. **App hosting — [Vercel](https://vercel.com)** (simplest for Next.js): import this repo,
   set all the env vars from `.env.example` (with real values, not the placeholders) in the
   project's Environment Variables settings, and deploy. Vercel builds and serves the app; no
   separate server process to manage.
5. Run migrations against the production database once, from your machine, before the first
   deploy is used:
   ```bash
   DATABASE_URL="<your production connection string>" npx prisma migrate deploy
   ```
6. Set `APP_BASE_URL` to your real deployed URL (used in email links) and leave
   `NEXT_PUBLIC_SKIP_AUTH` unset — that dev-only role switcher must never be enabled here.
7. Optionally run `npm run seed` once against production if you want a real admin account to
   start from (or create one directly via `psql`/your DB provider's SQL console — admin
   accounts are never self-registrable, per Section 4).
8. Schedule `npm run expire-rfqs` to run periodically (Vercel Cron, or any external scheduler
   hitting a small wrapper endpoint) — it isn't automatic.

## Running tests, lint, and type checks

```bash
npm run lint        # ESLint
npx tsc --noEmit    # TypeScript
npm test            # Vitest (state machines, masking layer, contact-info detection)
npm run build       # Production build
```

## The RFQ-expiry job

RFQs whose `offer_deadline_at` has passed with no accepted offer need to move to `EXPIRED`
(Section 8.1). This isn't automatic — run it via cron or manually:

```bash
npm run expire-rfqs
```

## Project structure

```
prisma/
  schema.prisma       # Full DB schema (Section 3), plus two tables the spec's API/screens
                       # require but Section 3 doesn't enumerate — see the comments in the
                       # schema file (RfqDistribution, Dispute).
  migrations/          # Versioned migrations (Prisma Migrate)
  seed.ts              # Demo data
scripts/
  expire-rfqs.ts       # Scheduled RFQ-expiry job
src/
  app/
    api/               # Route Handlers — the entire REST API (Section 16)
    (buyer|supplier|admin)/...  # Pages per role (Sections 5-7)
  components/          # Shared UI (Shell nav, RfqForm)
  lib/
    auth/              # password/JWT/session/RBAC helpers
    masking/           # identity-masking serializers (Section 11) — allowlist-built, tested
    stateMachines/     # RFQ/Offer/Order allowed-transition tables (Sections 8-10) — tested
    files/             # upload constraints, watermarking, signed-URL access control
    messages/          # contact-info regex detection (Section 11/13) — tested
    order/, offer/, rfq/  # domain serializers and business logic per resource
    client/            # frontend-only: fetch wrapper, auth context, route guard
storage/               # local file storage root (gitignored)
tests/                 # Vitest suites
SPEC.md                # the full developer implementation spec — source of truth
```

## Notes on two schema additions not in `SPEC.md` Section 3

Section 3 is described as the complete database schema, but two features that Section 16 (API)
and other sections explicitly require have no listed table:

- **`disputes`** — Sections 2, 7.13, and 10 all require opening/resolving disputes with
  specific fields (category, description, resolution outcome/notes), but no `disputes` table
  is enumerated in Section 3.
- **`rfq_distributions`** — Section 7.7 and the `PATCH /admin/rfqs/{id}/distribution` endpoint
  require Admin to override the default "all approved suppliers in category" RFQ visibility,
  which needs somewhere to store the override.

Both were added with the minimum fields their own API contracts already imply — see the
comments directly above each model in `prisma/schema.prisma` for the full reasoning.

A few other places where a literal reading of two sections of `SPEC.md` conflicted are resolved
in code with a comment at the point of the decision (e.g. `rfqs`' nullable fields vs. Section
3's "Req: Yes", and RFQ-cancellation eligibility) — search the codebase for `SPEC.md` comments
if you want the full list.

## What's deliberately not built (P1/P2)

Per `SPEC.md` Section 20 and the Open Decisions Register: no payment gateway (Admin manually
flips `PAYMENT_CONFIRMED` after verifying payment off-platform, OD-P-01), no live shipping/
tracking integration, no automated Supplier Score or Buyer Reputation, no OCR/AI-based contact
detection, no warehouse management system, no native mobile apps.
