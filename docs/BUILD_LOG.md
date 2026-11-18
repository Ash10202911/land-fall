# Build log

Written by Claude Code during `/build-core`.

## Plan

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

## Definition of done
| # | Item | Evidence | Pass |
|---|---|---|---|
| 1 | F1 to F8 built, each with its check passing | Features table above; each feature committed with its checks run | Pass |
| 2 | lint, typecheck, test, test:rls, build all pass | lint and typecheck clean; npm test 31 passed (6 files); npm run test:rls 52 passed (7 files, SEC-1 to SEC-6 plus RLS-on-every-table); npm run build compiled | Pass |
| 3 | Playwright journey passes | tests/e2e/journey.spec.ts on an iPhone 13 viewport: agent posts (past deadline rejected), two forwarders quote (sealed), Basic agent cannot award, admin verifies, agent awards, winner sees contacts, loser does not, non-admin gets 404 on /admin, no console errors. 1 passed | Pass |
| 4 | README updated | README.md: local setup, env vars, console email fallback, deploy steps | Pass |
| 5 | Branch core-build pushed, PR open to main | See PR link in the final report | Pending until push |
| F1 Skeleton and mobile layout | done | utils unit test; build, lint, typecheck green | Schema, RLS and seed landed in the same commit; db:reset verified. shadcn-style components written by hand (no CLI). |
| F2 Sign-in and onboarding | done | auth.test.ts (email, onboarding, profile, safe redirect); manual run: magic link via Mailpit, onboarding, landed on feed, 375px no overflow, no console errors | Profile page and sign out added here (needed for contact details). |
| F3 Post a job | done | job.test.ts (FCL/LCL/Air rules, ports differ, past deadline), domain.test.ts; manual run at 375px: typeahead, past deadline rejected with inline error, valid job posted | Deadline entered as UTC date and time to avoid timezone ambiguity. |
| F4 Job feed and detail | done | manual run: feed hides own, closed and awarded jobs; mode filter; detail page | Closed state computed on read (deadline_at) with no cron. Empty state rendered by feed. |
| F5 Sealed quotes | done | quote.test.ts (3 unit); RLS: sec1-quotes-sealed (8 tests), sec4-quote-deadline (9 tests); manual run: 2-line multi-currency quote sent, totals per currency, appears in My Quotes | Quote writes go through submit_quote/update_quote/withdraw_quote (security invoker, atomic, RLS still applies). Fixed an ambiguous jobs/quotes embed found in the browser. |
| F6 Compare and award | done | RLS: sec3-award (9 tests), sec2-contacts (7 tests); mutation check (opened quotes policy, sec1 failed 6 tests, then restored); manual run: stacked cards, expand lines, two-step confirm, award, contacts and bank warning | Added a My jobs view on the Jobs tab (not in spec) so posters can reach their jobs and quotes. Award is allowed after the deadline and before it (poster decides). |
| F7 Admin | done | RLS: sec5-suspended (5 tests), sec6-own-company-admin (9 tests), rls-enabled (2 tests); manual run: /admin lists companies with verify and suspend at 375px | Non-admin 404 is covered by the Playwright journey. RLS tests leave their companies in the local DB; db:reset clears them. |
| F8 Email notifications | done | email.test.ts (9 tests: recipients per event, footer, console fallback, Resend path, failure does not throw, masked address, no amounts or contact details in email) | Recipient lookup uses the service role on the server only (src/lib/supabase/admin.ts). Console fallback masks the recipient address to keep personal data out of logs. Emails link to the job and never contain quote amounts or contact details. |
