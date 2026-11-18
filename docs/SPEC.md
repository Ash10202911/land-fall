# Southbound Core: build spec

The smallest version of Southbound that proves the idea: an overseas agent posts a job, ANZ forwarders send sealed quotes, the agent awards one, and both sides get each other's contact details and an email. Sized for one 1 to 2 hour Claude Code run.

Everything not in this file is out of scope for this run.

## Users
- Agent (overseas) and Forwarder (Australia or NZ). Both can post and quote.
- Admin (the founder), marked with `is_admin` on their user row.

## Stack
Next.js (App Router, TypeScript), Tailwind, shadcn/ui, Supabase (Postgres, Auth, RLS), Resend for email (console fallback when no key), Vitest, Playwright, Vercel.

## Features

Build in this order. Each feature ends with its checks passing and a commit.

### F1: Skeleton and mobile layout
- Next.js app with Tailwind and shadcn/ui
- Supabase server and browser clients, local Supabase via `npx supabase start`
- Mobile-first layout: bottom tab nav on phones (Jobs, Post, My Quotes, Profile), simple top nav on desktop
- PWA manifest and icons (no service worker in this run)
- npm scripts: dev, build, lint, typecheck, test, test:rls, test:e2e, db:reset

Check: build passes, no horizontal scroll at 375px.

### F2: Sign-in and onboarding
- Magic link sign-in (Supabase Auth)
- First login: 3 fields (company name, country, role: agent or forwarder). Creates the company at trust level `basic` and the user as owner.
- Signed-out users are sent to sign-in.

Check: new user signs in and lands on the job feed after onboarding.

### F3: Post a job
- Fields: direction (import or export), incoterm, mode (FCL, LCL, Air), origin port, destination port, container type and quantity (FCL) or weight kg and volume cbm (LCL, Air), cargo description, ready date, services needed (destination charges, customs clearance, delivery), quote deadline, notes
- Cargo flags: dangerous goods, reefer, BMSB-risk goods
- Ports: seed a short list of about 40 major ports (all main AU and NZ ports, plus top China, SE Asia, India, Europe and US ports). Typeahead search.
- Deadline in the past is rejected.

Check: a job can be posted on a 375px screen.

### F4: Job feed and job detail
- Feed shows open jobs from other companies, newest first, with filters for destination port and mode
- Empty state when nothing matches
- Job detail page
- Jobs past their deadline show as closed and cannot be quoted (check on read, no cron needed)

Check: feed hides own jobs and closed jobs.

### F5: Sealed quotes
- Quote = line items (charge name, amount, currency, GST included yes or no) + validity date + notes
- Show a total per currency (no currency conversion in this run)
- Quoter can edit or withdraw before the deadline
- My Quotes tab lists the user's quotes and their status (sent, won, lost, withdrawn)
- Only the job poster's company can see the quotes on a job. Quoters see only their own.

Check: RLS tests for SEC-1 and SEC-4 pass.

### F6: Compare and award
- Poster sees all quotes as stacked cards on mobile (total, validity, company name, trust badge), tap to expand lines
- Poster awards one quote: job becomes awarded, that quote won, others lost
- Only Verified companies can award. Basic companies see "Get verified to award" instead of the button, and their quotes show an "Unverified" label.
- After award, poster and winner can see each other's contact name, email and phone. Nobody else can, ever.
- Warning on the contact screen: "Never change bank details based on a message. Always confirm by phone using a number you already trust."

Check: RLS tests for SEC-2 and SEC-3 pass.

### F7: Admin
- `/admin` only for users with `is_admin`
- List companies with trust level, set Basic or Verified, suspend or unsuspend
- Suspended companies cannot post, quote or award

Check: RLS test for SEC-5 passes, non-admin gets 404 on /admin.

### F8: Email notifications
- Emails for: new quote on my job (to poster), quote won (to winner), quote lost (to others)
- One `sendEmail()` helper. Uses Resend when `RESEND_API_KEY` is set, otherwise logs the email to the console.
- Footer in every email: sender name and a line saying how to stop emails (a simple "reply STOP" is fine for this run)

Check: unit test confirms the right recipients for each event.

### Stretch (only if F1 to F8 are done and all checks pass)
- S1: Admin can post a job on behalf of any company (concierge mode)
- S2: "Repeat last job" button on the post form

## Data model
| Table | Columns |
|---|---|
| companies | id, name, country, role (agent, forwarder), trust_level (basic, verified), status (active, suspended), created_at |
| profiles | id (= auth.users.id), company_id, full_name, email, phone, is_admin, created_at |
| ports | id, code, name, country |
| jobs | id, company_id, created_by, direction, incoterm, mode, origin_port_id, destination_port_id, container_type, container_qty, weight_kg, volume_cbm, cargo_description, ready_date, services text[], flag_dg, flag_reefer, flag_bmsb, deadline_at, notes, status (open, awarded, cancelled), awarded_quote_id, created_at |
| quotes | id, job_id, company_id, created_by, valid_until, notes, status (sent, withdrawn, won, lost), created_at, updated_at |
| quote_lines | id, quote_id, charge_name, amount_minor bigint, currency char(3), gst_included bool |

Money is stored as integer cents with a currency code. Timestamps in UTC. Show dates as DD/MM/YYYY.

## Security rules (enforced with RLS and tested)
| ID | Rule |
|---|---|
| SEC-1 | Only the job poster's company can read quotes and quote lines on its job. A quoter reads only its own. |
| SEC-2 | Profile email and phone are readable only by the same company, by admins, and by the other party after award (poster and winner). Use a security definer function or view for the contact lookup. |
| SEC-3 | Only Verified, active companies can award, and only on their own open jobs. |
| SEC-4 | Quotes cannot be created or changed after the job deadline or once the job is awarded. |
| SEC-5 | Suspended companies cannot insert or update jobs or quotes. |
| SEC-6 | Users can only act for their own company. Admin actions require is_admin. |

## Definition of done for the run
1. F1 to F8 built, each with its check passing.
2. `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:rls`, `npm run build` all pass.
3. One Playwright test on an iPhone-size viewport: agent posts a job, forwarder quotes, admin verifies the agent, agent awards, winner sees contacts, loser does not.
4. README updated with local setup and deploy steps.
5. All work on branch `core-build`, pushed, with a PR open to main.
