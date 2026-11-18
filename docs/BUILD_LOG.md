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

## Blocked or carried over

## Definition of done
| # | Item | Evidence | Pass |
|---|---|---|---|
| F1 Skeleton and mobile layout | done | utils unit test; build, lint, typecheck green | Schema, RLS and seed landed in the same commit; db:reset verified. shadcn-style components written by hand (no CLI). |
| F2 Sign-in and onboarding | done | auth.test.ts (email, onboarding, profile, safe redirect); manual run: magic link via Mailpit, onboarding, landed on feed, 375px no overflow, no console errors | Profile page and sign out added here (needed for contact details). |
| F3 Post a job | done | job.test.ts (FCL/LCL/Air rules, ports differ, past deadline), domain.test.ts; manual run at 375px: typeahead, past deadline rejected with inline error, valid job posted | Deadline entered as UTC date and time to avoid timezone ambiguity. |
| F4 Job feed and detail | done | manual run: feed hides own, closed and awarded jobs; mode filter; detail page | Closed state computed on read (deadline_at) with no cron. Empty state rendered by feed. |
| F5 Sealed quotes | done | quote.test.ts (3 unit); RLS: sec1-quotes-sealed (8 tests), sec4-quote-deadline (9 tests); manual run: 2-line multi-currency quote sent, totals per currency, appears in My Quotes | Quote writes go through submit_quote/update_quote/withdraw_quote (security invoker, atomic, RLS still applies). Fixed an ambiguous jobs/quotes embed found in the browser. |
