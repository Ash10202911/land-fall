# Southbound

A quote board for freight. Overseas agents post jobs, Australian and New Zealand forwarders send **sealed quotes**, and the poster awards one. After an award the poster and the winner see each other's contact details and each get an email. Nobody else ever does.

Trust is the product: quotes are sealed and contact details are hidden, and both are enforced in the database with Row Level Security, not only in the UI.

- Full spec: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Build log and definition-of-done evidence: [docs/BUILD_LOG.md](docs/BUILD_LOG.md)
- One-off account setup (GitHub, Supabase, Vercel): [docs/SETUP.md](docs/SETUP.md)

## What is in the app

| | |
|---|---|
| F1 | Next.js 16 app, mobile-first layout (bottom tabs on phones, top nav on desktop), PWA manifest and icons |
| F2 | Magic link sign-in and 3-field onboarding |
| F3 | Post a job (port typeahead, FCL / LCL / Air, cargo flags, quote deadline) |
| F4 | Job feed (hides your own and closed jobs; filter by destination and mode), job detail, "My jobs" view |
| F5 | Sealed quotes with line items, totals per currency, edit or withdraw until the deadline, My Quotes |
| F6 | Compare quotes as stacked cards, award (Verified companies only), contact handoff with a bank-details warning |
| F7 | `/admin` (admins only, others get a 404): verify and suspend companies |
| F8 | Email on new quote, quote won, quote lost; console fallback when no email key is set |

## Local setup

You need Node.js 20+, Git and Docker Desktop (running).

```bash
npm install
npx supabase start          # local Postgres, Auth and Mailpit (uses Docker)
npm run db:reset            # runs migrations and loads seed data
cp .env.example .env.local  # then fill the three Supabase values from: npx supabase status
npm run dev                 # http://localhost:3000
```

Fill `.env.local` with the values `npx supabase status` prints: `API_URL` goes in `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SERVICE_ROLE_KEY` in `SUPABASE_SERVICE_ROLE_KEY`.

### Signing in locally

Magic link emails go to **Mailpit** at http://127.0.0.1:54324. Enter an email on the sign-in page, open Mailpit, and click the link.

The seed data includes demo accounts (sign in with any of these emails):

| Email | Who |
|---|---|
| `admin@southbound.test` | Admin (founder) |
| `agent@demo.test` | Shenzhen Star Logistics, Verified agent |
| `agent2@demo.test` | Mumbai Cargo Link, Basic agent |
| `fwd1@demo.test` | Harbour Freight, Verified forwarder |
| `fwd2@demo.test` | Kiwi Sea and Air, Basic forwarder |

To skip the email step while developing: `node scripts/dev-login-link.mjs fwd1@demo.test` prints a one-time sign-in link. It refuses to run unless `.env.local` points at a local Supabase.

### Commands

```bash
npm run dev        # local dev server
npm run build      # production build
npm run lint
npm run typecheck
npm test           # unit tests (Vitest)
npm run test:rls   # Row Level Security tests against local Supabase
npm run test:e2e   # Playwright journey on an iPhone-size viewport (needs the local stack and `npx playwright install chromium` once)
npm run db:reset   # reset the local database, run migrations, load seed data
```

The RLS and end-to-end tests only ever run against the **local** Supabase stack and refuse any other host.

## Environment variables

| Variable | Needed | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key (safe in the browser; RLS protects the data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes, for email | **Secret.** Server only. Used to look up email recipients. Without it, notification emails are skipped. |
| `NEXT_PUBLIC_APP_URL` | Yes | The site URL, used in links inside emails and for sign-in redirects |
| `RESEND_API_KEY` | No | When set, emails go out through Resend |
| `EMAIL_FROM` | No | Sender, for example `Southbound <no-reply@yourdomain.com.au>`. Must be a domain verified in Resend. |

Never commit `.env.local`. Only `.env.example` (no values) is tracked.

## Email and the console fallback

All email goes through one helper, `sendEmail()` in `src/lib/email.ts`.

- **With `RESEND_API_KEY` set**, it sends through Resend.
- **Without it**, nothing is sent. The email is printed to the server console instead, with the subject and body, and the recipient address masked (for example `p***@example.com`) so personal data stays out of logs. This means the app runs fully with no email account.

Every email ends with the sender name and a "reply STOP" line. Emails link to the job; they never contain quote amounts or contact details. A failed email never fails the quote or award that triggered it.

## Deploy

The founder and GitHub Actions deploy; development agents do not.

1. **GitHub**: push the branch, open a pull request to `main`. CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, RLS tests against a local Supabase, and the build.
2. **Supabase**: create a project (Sydney region), turn on Email (magic link) auth, and add three repository secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`. On merge to `main`, `.github/workflows/db-migrate.yml` runs `supabase db push`, which applies anything new in `supabase/migrations/`. Seed data is **not** applied to production.
3. **Vercel**: import the GitHub repo and set the environment variables above for Production and Preview. Vercel deploys `main` automatically.
4. **Supabase URL configuration**: set the Site URL to your Vercel URL and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for local use) to the redirect URLs.
5. **Make yourself admin**: in Supabase, Table Editor, `profiles`, set `is_admin` to true on your row. Admins verify companies at `/admin`.

## How the trust rules are enforced

All six rules live in `supabase/migrations/` and each has an automated test in `tests/rls/`.

| Rule | Enforced by |
|---|---|
| SEC-1 Sealed quotes | `quotes` and `quote_lines` policies: poster's company or the quoting company only |
| SEC-2 Contact details | `profiles` is private; the other party reads contacts only through `get_award_contacts()` after an award |
| SEC-3 Only Verified, active companies award | `award_quote()`; there is no direct update access to `jobs` or award status |
| SEC-4 No quote changes after deadline or award | quote and quote line policies check the job's status and deadline |
| SEC-5 Suspended companies are blocked | policies and `award_quote()` check company status |
| SEC-6 Own company and admin only | policies pin `company_id` and `created_by`; column grants stop users changing trust, status, `is_admin` or company |

## Notes and assumptions

- Money is stored as integer minor units (cents) with a 3-letter currency code, and every currency is treated as having 2 decimal places. Totals are per currency with no conversion.
- Dates display as DD/MM/YYYY. Deadlines are entered and shown in UTC.
- The spec lists four tabs; a **My jobs** view on the Jobs tab was added so posters can reach their jobs and compare quotes.
- Rules the spec left open are listed under "Clarified rules" in `docs/REQUIREMENTS.md` and decisions made during the build are in `docs/BUILD_LOG.md`.
