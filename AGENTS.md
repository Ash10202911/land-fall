# AGENTS.md

Rules for any AI coding agent in this repo.

## Project
Southbound Core is a mobile-first web app where overseas freight agents post jobs, ANZ forwarders send sealed quotes, and the poster awards one. Trust matters most: sealed quotes and hidden contact details are enforced in the database. The full spec is docs/REQUIREMENTS.md (docs/SPEC.md is the fallback if something is missing). Anything not in the spec is out of scope.

## Non-negotiables
- Row Level Security on every table, with tests for every SEC rule in docs/REQUIREMENTS.md.
- Quotes are sealed. Contact details only after award, only for poster and winner.
- Only Verified, active companies can award.
- Mobile first: design for 375px wide.
- Validate every input with Zod on the server.
- Database changes only through migrations in supabase/migrations/.
- No secrets in code. No personal data in logs.
- Australian English. Dates DD/MM/YYYY. Money in integer cents with a currency code. Timestamps in UTC.

## Never
- Push to main, force push, merge PRs, deploy, or link or push to the remote Supabase project. The founder and GitHub Actions do those.
- Weaken a test to make it pass.

## Working style
- Small commits tagged with the feature ID, for example `feat(F5): sealed quotes RLS`.
- Run lint, typecheck and tests after each step.
- Log progress in docs/BUILD_LOG.md.
- If the spec is unclear, choose the safest option, note it in docs/BUILD_LOG.md, and keep going.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
