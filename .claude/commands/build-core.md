---
description: Build Southbound Core (F1 to F8 in docs/SPEC.md) in one 1 to 2 hour run
---

Build Southbound Core in this session, following docs/SPEC.md. I may not be watching, so work steadily and only stop for a hard blocker.

## Setup (5 minutes)
1. Read AGENTS.md and docs/SPEC.md.
2. `git checkout -b core-build` from main.
3. Scaffold the Next.js app in the current folder (keep the existing docs and config files).
4. Start local Supabase with `npx supabase start`. Use only the local stack. Never link or push to a remote Supabase project.
5. Write a 10-line plan into docs/BUILD_LOG.md. Do not wait for approval. Start building.

## Build loop
For each feature F1 to F8, in order:
1. Build it in small steps. Database changes only as new files in supabase/migrations/.
2. Write tests for the feature's check and every SEC rule it touches.
3. Run `npm run lint && npm run typecheck && npm test`, plus `npm run test:rls` if the database changed. Fix until green.
4. Commit: `feat(F3): post a job`.
5. Add one line to docs/BUILD_LOG.md: feature, done or blocked, tests added, shortcuts.

If one failure survives 3 attempts, try a different approach. If it survives 5, log it as blocked and move on to the next feature that does not depend on it.

Time guide: F1 and F2 about 25 minutes, F3 and F4 about 25 minutes, F5 and F6 about 35 minutes, F7 and F8 about 20 minutes, final checks about 15 minutes. If you reach 1 hour 45 minutes, skip the stretch goals and go to the final checks.

## Final checks
1. Run the full suite: lint, typecheck, test, test:rls, build, and the Playwright journey from the spec on an iPhone-size viewport.
2. Use the security-reviewer subagent on the whole codebase. Fix any blocking finding, especially RLS gaps. Re-run the suite.
3. Update README.md: local setup, environment variables, how email falls back to the console, and the deploy steps for GitHub, Supabase and Vercel.
4. Finish docs/BUILD_LOG.md with a table of the 5 "Definition of done" items, each with evidence (test names or command results) and pass or fail.
5. `git push -u origin core-build` and open a PR with `gh pr create --fill`.

## Report to me
- What was built and what was not
- The done table with evidence
- Migrations in the PR (these apply to production when I merge)
- Environment variables I need in Vercel
- 5 steps to test it on my phone after I merge

Never claim a check passed unless you ran it.
