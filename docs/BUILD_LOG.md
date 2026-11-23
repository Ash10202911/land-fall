# Build log

Written by Claude Code during `/build-core`.

## Plan
1. F1: Next.js 16 app, Tailwind, shadcn-style UI, Supabase clients, proxy for session refresh, bottom tab nav and top nav, PWA manifest and icons, npm scripts.
2. Schema in one migration: tables, RLS on every table, security definer helpers, RPCs (onboard, submit/update/withdraw quote, award_quote, get_award_contacts).
3. F2: magic link sign-in, /auth/callback, 3-field onboarding via onboard(), signed-out redirect.
4. F3: post-a-job form with port typeahead, Zod server validation, past deadline rejected.
5. F4: feed (hides own and closed jobs, filters) and job detail page.
6. F5: sealed quotes via RPCs, totals per currency, My Quotes; RLS tests for SEC-1 and SEC-4.
7. F6: compare and award, contact handoff with bank-details warning; RLS tests for SEC-2 and SEC-3.
8. F7: /admin (404 for non-admins), trust and suspend controls; RLS tests for SEC-5 and SEC-6.
9. F8: sendEmail() with Resend and console fallback, recipient unit tests.
10. Final: Playwright iPhone journey, security-reviewer, README, done table, push and PR.

## Features
| Feature | Status | Tests added | Notes |
|---|---|---|---|
| F1 Skeleton and mobile layout | done | utils unit test; build, lint, typecheck green | Schema, RLS and seed landed in the same commit; db:reset verified. shadcn-style components written by hand (no CLI). |
| F2 Sign-in and onboarding | done | auth.test.ts (email, onboarding, profile, safe redirect); manual run: magic link via Mailpit, onboarding, landed on feed, 375px no overflow, no console errors | Profile page and sign out added here (needed for contact details). |
| F3 Post a job | done | job.test.ts (FCL/LCL/Air rules, ports differ, past deadline), domain.test.ts; manual run at 375px: typeahead, past deadline rejected with inline error, valid job posted | Deadline entered as UTC date and time to avoid timezone ambiguity. |
| F4 Job feed and detail | done | manual run: feed hides own, closed and awarded jobs; mode filter; detail page | Closed state computed on read (deadline_at) with no cron. Empty state rendered by feed. |
| F5 Sealed quotes | done | quote.test.ts (3 unit); RLS: sec1-quotes-sealed (8 tests), sec4-quote-deadline (9 tests); manual run: 2-line multi-currency quote sent, totals per currency, appears in My Quotes | Quote writes go through submit_quote/update_quote/withdraw_quote (security invoker, atomic, RLS still applies). Fixed an ambiguous jobs/quotes embed found in the browser. |
| F6 Compare and award | done | RLS: sec3-award (9 tests), sec2-contacts (7 tests); mutation check (opened quotes policy, sec1 failed 6 tests, then restored); manual run: stacked cards, expand lines, two-step confirm, award, contacts and bank warning | Added a My jobs view on the Jobs tab (not in spec) so posters can reach their jobs and quotes. Award is allowed after the deadline and before it (poster decides). |
| F7 Admin | done | RLS: sec5-suspended (5 tests), sec6-own-company-admin (9 tests), rls-enabled (2 tests); manual run: /admin lists companies with verify and suspend at 375px | Non-admin 404 is covered by the Playwright journey. RLS tests leave their companies in the local DB; db:reset clears them. |
| F8 Email notifications | done | email.test.ts (9 tests: recipients per event, footer, console fallback, Resend path, failure does not throw, masked address, no amounts or contact details in email) | Recipient lookup uses the service role on the server only (src/lib/supabase/admin.ts). Console fallback masks the recipient address to keep personal data out of logs. Emails link to the job and never contain quote amounts or contact details. |

## Blocked or carried over
- Security review (independent, read-only): no blocking findings. Fixed in migration 20261119000200: award rejects a winner whose company is suspended, onboard cannot orphan a company, tighter search_path, no existence probe in award_quote, phone format check, magic link redirect uses NEXT_PUBLIC_APP_URL only.
- Not done (outside the spec, recommended next): app-level rate limiting and email debounce on quote withdraw and resubmit; an append-only audit log for admin trust and status changes; blocking an admin from verifying their own company; a DB check that valid_until is not in the past.
- Production note: Supabase auth rate limits in supabase/config.toml are local values; set them in the hosted project.

## Next steps build (after the first release)
| Item | Status | Notes |
|---|---|---|
| Migration pipeline | done | db-migrate skips with a warning when secrets are missing; production history versions now match the file names |
| Cancel job, edit job | done | Migration 20261119000400: cancel_job and update_job (poster only; cargo and ready date lock once a live quote exists; deadline extend only). Live quotes become lost on cancel and quoters are emailed |
| Admin self-change guard | done | Trigger blocks an admin changing trust level or status of their own company (API users only) |
| Audit log | done | admin_audit_log written by trigger, readable by admins, shown on /admin |
| DB guards and limits | done | No past valid_until; max 5 quote attempts per company per job; max 20 jobs per company per 24h (non-admin) |
| Email debounce | done | Resubmitting after withdrawing does not email the poster again |
| S1 admin posts for a company, S2 repeat last job | done | jobs_insert policy allows admin for active companies |
| Error pages, skip link, admin search | done | |
| Playwright in CI, supabase start retry | done | CI runs the iPhone journeys |
| Backups, staging, monitoring, Supabase auth rate limits | not done | Dashboard settings; steps in README "Running it in production" |
| Sign-in rate limiting in the app | not done | Relies on Supabase Auth limits (set in the hosted project) |

## Dashboard build (analysis in docs/DASHBOARD.md)
| Rank | Feature | Status | Evidence |
|---|---|---|---|
| 1 | Needs-attention queue | done | buildActionQueue unit tests; e2e dashboard.spec.ts |
| 2 | Marketplace health and verification queue (admin) | done | Migration 20261119000500; RLS tests in sec8-dashboard-stats.test.ts (non-admins refused, no money or contact fields) |
| 3 | Quote scorecard (forwarders) | done | buildQuoteScorecard unit tests |
| 4 | Job scorecard (posters) | done | buildJobScorecard unit tests |
| 5 | Lane demand | done | buildLaneDemand unit tests |
| - | Decision: no cross-company price data | noted | Sealed quotes: price benchmarks need a minimum-contributors rule first |
| - | Decision: admin stats are counts and timings only | noted | Spec says admins have no access to quote contents |
| - | Nav: Dashboard added as a fifth tab | noted | Spec listed four tabs; the request added a dashboard |

## v2 phase 1: foundation (plan in docs/V2_PLAN.md, switch brief in docs/REQUESTER_QUOTER_VIEWS.md)
| Item | Status | Evidence |
|---|---|---|
| Migration 20261122000100: delivery suburb, postcode, unload type, regular work, needed-by date | done | RLS tests sec9-v2-job-details.test.ts (delivery needs a place, postcode format, needed-by after ready) |
| Street address released only at award (award_quote_with_address, job_delivery_addresses) | done | sec9: no direct writes, award rolls back without an address, Basic requester still blocked, only requester and winner can read it |
| Competition band (job_quote_bands): none / few / busy, never a count | done | sec9: only band and job_id columns, closed and awarded jobs excluded, signed-out refused |
| Ocean + sky theme | done | Tokens in globals.css; text colours meet AA |
| Requester / Quoter switch (sb_mode cookie, Zod-validated, defaults by role) | done | mode.test.ts; e2e modes.spec.ts (lands by role, switches, persists after reload) |
| Dashboard removed; parts moved | done | /dashboard redirects to /jobs (e2e); needs-attention and job scorecard on My requests, quote scorecard and lane demand on My quotes, marketplace health on /admin (e2e) |
| Map-first job cards: route map, flags, NEW since last visit, countdown ring, scope strip, containers, competition band | done | geo.test.ts (coordinates for every seeded port, framing, Pacific crossing), scope tests; e2e checks route map and competition band |
| Quick Request a quote form | done | job.test.ts (new fields, quote window presets); e2e journey and lifecycle post through it |
| Poster renamed Requester in screen text, code names and emails | done | email and lifecycle unit tests updated to the new wording; database function still returns 'poster', mapped in contacts.tsx |
| - Decision: menus have three items per mode | noted | Insights and My lanes arrive in later phases; Profile holds the admin link as before |
| - Decision: flags use emoji | noted | They show as letters (CN, AU) on Windows desktop browsers; phones show flags |
| - Decision: world outline is defined once per page | noted | Cards reference it with use; 62 cards went from 2.7 MB to 1.5 MB of HTML in development |
| Checks | pass | lint clean; typecheck clean; npm test 80 passed (11 files); test:rls 83 passed (10 files) after db reset; next build compiled; Playwright 5 passed on iPhone 13 (journey, lifecycle, 3 mode tests) |

## v2 phase 2: speed (lane alerts, rate cards, pre-filled quotes), on branch v2
| Item | Status | Evidence |
|---|---|---|
| Migration 20261123000100: lane_alerts, lane_alert_deliveries, rate_cards, rate_card_charges, save_rate_card | done | sec10-lanes-and-rate-cards.test.ts: 17 tests |
| Lane alerts and rate cards are private to the company (not even admins can read them) | done | sec10: other company, admin and signed-out callers read, edit and delete nothing; cannot plant rows on another company's card; suspended companies refused |
| Atomic card save (card and all rows, or nothing) | done | sec10: a bad row rolls the whole save back; limits of 20 alerts and 10 cards per company |
| Delivery log is server-only | done | Explicit deny-all policy (the existing "every table has a policy" test stays strict); sec10 checks no signed-in user can read or write it |
| Pre-filled quotes from a rate card | done | rate-cards.test.ts (container basis, 20ft or 40ft, per cbm and kg, zone by postcode, unload rule, service filter, warnings, 20-line cap); e2e builds a card in the app and checks the quote lines and total |
| Rate card in-app editor | done | e2e lanes.spec.ts (mistake shown on the field, nothing saved until valid) |
| Rate card upload | done as CSV | parseRateSheet tests (template round trip, quotes, BOM, semicolon files with decimal commas, row-numbered errors, size and row limits); e2e uploads good and bad files |
| Lane alerts: instant and daily | done | planRun tests (matching, no repeats, grouping, own jobs excluded); e2e: posting a matching job records the delivery; the daily route refuses callers without the secret, sends once and never repeats |
| Daily summary at 7am Sydney | done | Two cron times (20:00 and 21:00 UTC) cover daylight saving; sydneyHour tests; the route acts only when it is 7am in Sydney |
| Menu: My lanes added to Quoter mode | done | mode.test.ts |
| - Decision: rate cards upload as CSV, not .xlsx | noted | Excel opens and saves CSV; reading .xlsx needs a third-party library, which is a supply-chain and security trade-off to decide on separately |
| - Decision: rate card amounts are stricter than quote amounts | noted | Commas must be real thousands separators (1,250.50). Semicolon files use a decimal comma. Anything ambiguous is rejected rather than guessed |
| - Decision: a human always sends the quote | noted | Pre-fill only; lines changed by the forwarder are marked "edited" |
| - Decision: alert emails carry public job details only | noted | No street address, no quotes, no price except the recipient's own rate card total |
| - Needs for production | open | RESEND_API_KEY and a sending domain (otherwise emails go to the server log); CRON_SECRET in Vercel (16+ characters); SUPABASE_SERVICE_ROLE_KEY already set |
| Found while testing | fixed | A form submitted with a React action cleared the name and port after a rejected upload; the upload and add-lane forms now keep what was typed |
| Checks | pass | lint clean; typecheck clean; npm test 120 passed (13 files); test:rls 100 passed (11 files) after db reset; next build compiled; Playwright 10 passed on iPhone 13 |

## Definition of done
| # | Item | Evidence | Pass |
|---|---|---|---|
| 1 | F1 to F8 built, each with its check passing | Features table above; each feature committed with its checks run | Pass |
| 2 | lint, typecheck, test, test:rls, build all pass | lint and typecheck clean; npm test 31 passed (6 files); npm run test:rls 52 passed (7 files, SEC-1 to SEC-6 plus RLS-on-every-table); npm run build compiled | Pass |
| 3 | Playwright journey passes | tests/e2e/journey.spec.ts on an iPhone 13 viewport: agent posts (past deadline rejected), two forwarders quote (sealed), Basic agent cannot award, admin verifies, agent awards, winner sees contacts, loser does not, non-admin gets 404 on /admin, no console errors. 1 passed | Pass |
| 4 | README updated | README.md: local setup, env vars, console email fallback, deploy steps | Pass |
| 5 | Branch core-build pushed, PR open to main | See PR link in the final report | Pending until push |
