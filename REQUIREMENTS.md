# Southbound Core — Requirements

## Summary

Southbound is a quote board where overseas freight agents post jobs, Australian and New Zealand
freight forwarders send sealed quotes, and the poster awards one. When a job is awarded, the poster
and the winning forwarder see each other's contact details and each get an email. Nobody else ever
sees them.

This is the smallest version that proves the idea. It is mobile first, built to be used on a phone,
and trust is the product: quotes are sealed and contact details are hidden, and both are enforced
in the database (Row Level Security), not just in the UI.

Everything not in this file is out of scope for v1.

## Users

- **Agent** (overseas) and **Forwarder** (Australia or NZ). Both roles can post jobs and send quotes.
- **Admin** (the founder), marked by `is_admin` on their profile row. Admins verify and suspend companies.

## Platform

Eight capabilities, in this build order (F1 to F8). Mobile navigation is a bottom tab bar
(Jobs, Post, My Quotes, Profile); desktop uses a simple top nav.

- **F1 Skeleton and mobile layout** — Next.js app, Supabase clients, mobile-first layout, PWA
  manifest and icons (no service worker), standard npm scripts.
- **F2 Sign-in and onboarding** — magic link sign-in. First login asks for 3 fields (company name,
  country, role). Creates the company at trust level `basic` and the user as its owner. Signed-out
  users are sent to sign-in.
- **F3 Post a job** — direction (import or export), incoterm, mode (FCL, LCL, Air), origin and
  destination port, container type and quantity (FCL) or weight kg and volume cbm (LCL, Air), cargo
  description, ready date, services needed (destination charges, customs clearance, delivery), quote
  deadline and notes. Cargo flags: dangerous goods, reefer, BMSB-risk goods. Ports come from a seeded
  list of about 40 major ports (all main AU and NZ ports plus top China, SE Asia, India, Europe and
  US ports) with typeahead search. A deadline in the past is rejected.
- **F4 Job feed and detail** — open jobs from other companies, newest first, filterable by
  destination port and mode, with an empty state. A job detail page. Jobs past their deadline show
  as closed and cannot be quoted (checked on read, no cron).
- **F5 Sealed quotes** — a quote is line items (charge name, amount, currency, GST included yes or
  no) plus a validity date and notes. A total is shown per currency (no conversion). The quoter can
  edit or withdraw until the deadline. **My Quotes** lists the user's quotes with status (sent, won,
  lost, withdrawn).
- **F6 Compare and award** — the poster sees all quotes as stacked cards (total, validity, company
  name, trust badge) and can expand each to see its lines. Awarding one makes the job `awarded`, that
  quote `won` and the others `lost`. Only Verified companies can award; Basic companies see
  "Get verified to award" and their quotes carry an "Unverified" label. After award, the poster and
  winner see each other's contact name, email and phone, with the warning: "Never change bank details
  based on a message. Always confirm by phone using a number you already trust."
- **F7 Admin** — `/admin` for admins only (everyone else gets a 404). Lists companies with trust
  level, lets the admin set Basic or Verified, and suspend or unsuspend. Suspended companies cannot
  post, quote or award.
- **F8 Email notifications** — new quote on my job (to poster), quote won (to winner), quote lost
  (to the other quoters). One `sendEmail()` helper: uses Resend when `RESEND_API_KEY` is set,
  otherwise logs the email to the console. Every email has a footer with the sender name and a
  "reply STOP" line.

**Stretch** (only when F1 to F8 are done and every check passes): S1 admin can post a job on behalf of
any company; S2 "Repeat last job" on the post form.

## What the app keeps track of

| Record | Key fields |
|---|---|
| **companies** | id, name, country, role (agent, forwarder), trust_level (basic, verified), status (active, suspended), created_at |
| **profiles** | id (= auth.users.id), company_id, full_name, email, phone, is_admin, created_at |
| **ports** | id, code, name, country |
| **jobs** | id, company_id, created_by, direction, incoterm, mode, origin_port_id, destination_port_id, container_type, container_qty, weight_kg, volume_cbm, cargo_description, ready_date, services text[], flag_dg, flag_reefer, flag_bmsb, deadline_at, notes, status (open, awarded, cancelled), awarded_quote_id, created_at |
| **quotes** | id, job_id, company_id, created_by, valid_until, notes, status (sent, withdrawn, won, lost), created_at, updated_at |
| **quote_lines** | id, quote_id, charge_name, amount_minor bigint, currency char(3), gst_included bool |

Conventions: money is stored as integer minor units (cents) with a 3-letter currency code;
timestamps are UTC; dates display as DD/MM/YYYY; Australian English throughout.

### Clarified rules (where the original spec was silent)

These are the safe defaults. Change them deliberately, not by accident.

- A company can have at most one live (non-withdrawn) quote per job. It edits that quote rather than
  adding another.
- A company cannot quote its own job. Its own jobs are hidden from its feed.
- Quotes cannot be edited or withdrawn after the deadline or after the job is awarded.
- `cancelled` is a reserved job status with no UI in v1.
- Admins can see companies and profiles to do their work but have no special access to quote
  contents.
- After award the winning quoter can see the poster's contact details too (the handoff is mutual).
- Withdrawn quotes are not shown to the poster and do not count as "lost" for emails.

## Security rules

Enforced with Row Level Security and each covered by an automated test. Application checks are not
a substitute.

| ID | Rule |
|---|---|
| SEC-1 | Only the job poster's company can read quotes and quote lines on its job. A quoter reads only its own. |
| SEC-2 | Profile email and phone are readable only by the same company, by admins, and by the other party after award (poster and winner). Use a security definer function or view for the contact lookup. |
| SEC-3 | Only Verified, active companies can award, and only on their own open jobs. |
| SEC-4 | Quotes cannot be created or changed after the job deadline or once the job is awarded. |
| SEC-5 | Suspended companies cannot insert or update jobs or quotes. |
| SEC-6 | Users can only act for their own company. Admin actions require `is_admin`. |

Also required: Row Level Security on every table; every input validated with Zod on the server; no
secrets in code; no personal data in logs.

## High-level technical guidance

- **Next.js (App Router, TypeScript), Tailwind and shadcn/ui.** Prefer these well-supported
  libraries over hand-rolled UI.
- **Supabase** for Postgres, Auth (magic link) and RLS. Local development uses `npx supabase start`.
  Database changes happen only as migration files in `supabase/migrations/`.
- **Resend** for email, with console fallback when no key is set so the app runs with no accounts.
- **Vitest** for unit tests, a dedicated RLS test suite against local Supabase, and **Playwright**
  for end-to-end.
- **Vercel** for hosting; GitHub Actions apply migrations on merge to `main`.
- Required npm scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:rls`, `test:e2e`, `db:reset`.
- Seed data: the ports list, plus a small set of demo companies, jobs and quotes so every screen is
  populated on first local run.
- Keep it simple and conventional; library and structure choices are the builder's call as long as
  the requirements and success criteria are met.

## Not in scope (v1)

- No payments, escrow, invoicing or bank details of any kind.
- No in-app messaging or chat; contact happens off-platform after award.
- No currency conversion (totals shown per currency).
- No document or file uploads, and no company verification documents (admin sets trust by hand).
- No ratings, reviews, questions on jobs, invite-only or network-only jobs.
- No cron jobs or background workers; deadlines are checked on read.
- No service worker or offline mode (manifest and icons only).
- No data import or export, and no analytics beyond what the app needs to run.

## Look and feel

- **Mobile first.** Design for a 375px viewport; tap targets at least 44px; no horizontal scroll;
  no wide tables on mobile (use stacked cards).
- Clean, professional and trustworthy. Freight is a serious business; avoid novelty.
- Use shadcn/ui defaults as the base with one restrained accent colour and grays.
- Avoid generic "AI-generated" tells: background gradients, gradient buttons, and cards with a single
  accent border line down one side. Avoid unnecessary emojis; use icons for navigation and actions.
- Every list has an empty state; every form shows clear validation errors.

## Phases and success criteria

Build in order. Do not start a phase until every success criterion of the previous phase is
demonstrably met. Each criterion must be something you can show working, not just assert. Commit
after each feature with a message tagged by feature ID (for example `feat(F5): sealed quotes`).

### Phase 1 — Skeleton and sign-in (F1, F2)

1. `npm run build` passes and the app shows the bottom tab nav on a phone-width screen and the top
   nav on desktop, with no horizontal scroll at 375px.
2. All required npm scripts exist and run; `npm run db:reset` produces a seeded local database.
3. A new user signs in by magic link, completes the 3-field onboarding, and lands on the job feed.
   A signed-out user is redirected to sign-in.

### Phase 2 — Jobs (F3, F4)

1. A job can be posted on a 375px screen using the port typeahead, and a past deadline is rejected
   with a clear error.
2. The feed shows other companies' open jobs newest first, filters by destination port and mode, and
   shows an empty state when nothing matches.
3. The feed hides the user's own jobs and closed jobs; a closed job's detail page cannot be quoted.

### Phase 3 — Sealed quotes (F5)

1. A forwarder can send a quote with several line items and see a total per currency.
2. The quote can be edited or withdrawn before the deadline and not after; it shows in My Quotes with
   the right status.
3. RLS tests for SEC-1 and SEC-4 pass: a second quoter cannot read the first quoter's quote, and a
   write after the deadline is rejected by the database.

### Phase 4 — Compare and award (F6)

1. The poster sees every quote as a stacked card and can expand its lines.
2. A Verified poster awards one quote: job `awarded`, that quote `won`, the rest `lost`. A Basic
   poster sees "Get verified to award" and cannot award, including by calling the database directly.
3. After award, only the poster and the winner can see each other's contact details, alongside the
   bank-details warning. Losing quoters and everyone else cannot.
4. RLS tests for SEC-2 and SEC-3 pass.

### Phase 5 — Admin and email (F7, F8)

1. An admin can list companies, set Basic or Verified, and suspend or unsuspend; a non-admin gets a
   404 on `/admin`.
2. A suspended company cannot post, quote or award. RLS tests for SEC-5 and SEC-6 pass.
3. A unit test confirms the right recipients for each email event (new quote, won, lost), every email
   carries the footer, and with no `RESEND_API_KEY` the email is logged to the console.

### Phase 6 — End-to-end validation and release

1. One Playwright test on an iPhone-size viewport covers the full journey: an agent posts a job, a
   forwarder quotes, an admin verifies the agent, the agent awards, the winner sees contacts and the
   loser does not.
2. The builder has driven the running app in a real browser, visually inspecting every screen on a
   phone-sized and a desktop-sized viewport, with no errors in the browser console.
3. An independent security review of the whole codebase finds no blocking issues, in particular no RLS
   gaps and no path that leaks quotes or contact details.
4. README documents local setup, environment variables, the email console fallback and deploy steps.

## Definition of done

1. F1 to F8 built, each with its check passing.
2. `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:rls` and `npm run build` all pass.
3. The Playwright journey above passes.
4. README updated with local setup and deploy steps.
5. Work is on a feature branch, pushed, with a pull request open to `main`. The builder never pushes
   to `main`, merges, deploys, or links to a remote Supabase project; the founder and GitHub Actions do.

## Final success criteria

The build is complete, and the builder may stop, when **all** of the following are true:

- A non-technical person can start the app locally from the documented steps and sign in.
- All eight features work and every SEC rule has a passing test.
- Quotes are sealed and contact details are hidden from everyone except as the rules allow, verified
  at the database level, not just the UI.
- Only Verified, active companies can award; suspended companies are blocked from posting, quoting
  and awarding.
- The app works well at 375px and looks professional on desktop.
- All unit, RLS and end-to-end tests pass, and no check is reported as passing unless it was run.
- **Most importantly: the product has been validated by actually using it end to end in a real
  browser, as an agent, a forwarder and an admin, with each screen visually inspected. Passing tests is
  necessary but NOT sufficient.**
