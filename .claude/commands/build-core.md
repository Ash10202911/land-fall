---
description: Build Southbound Core (F1 to F8 in REQUIREMENTS.md) in one 1 to 2 hour run
---

Build Southbound Core in this session, following REQUIREMENTS.md. Follow PROCESS.md for the overall
process. I may not be watching, so work steadily and only stop for a hard blocker.

## Setup (5 minutes)
1. Read AGENTS.md, REQUIREMENTS.md and PROCESS.md.
2. `git checkout -b core-build` from main.
3. Scaffold the Next.js app in the current folder (keep the existing docs and config files).
4. Start local Supabase with `npx supabase start`. Use only the local stack. Never link or push to a remote Supabase project.
5. Write a 10-line plan into docs/BUILD_LOG.md. Do not wait for approval. Start building.

## Build loop
REQUIREMENTS.md has six phases. Phases 1 to 5 cover F1 to F8; do not start a phase until every
success criterion of the previous phase is demonstrably met. For each feature, in order:
1. Build it in small steps. Database changes only as new files in supabase/migrations/.
2. Write tests for the feature's success criteria and every SEC rule it touches.
3. Run `npm run lint && npm run typecheck && npm test`, plus `npm run test:rls` if the database changed. Fix until green.
4. Commit: `feat(F3): post a job`.
5. Add one line to docs/BUILD_LOG.md: feature, done or blocked, tests added, shortcuts.

If one failure survives 3 attempts, try a different approach. If it survives 5, log it as blocked and move on to the next feature that does not depend on it.

Time guide: F1 and F2 about 25 minutes, F3 and F4 about 25 minutes, F5 and F6 about 35 minutes, F7 and F8 about 20 minutes, final checks about 15 minutes. If you reach 1 hour 45 minutes, skip the stretch goals and go to the final checks.

## Final checks (Phase 6)
1. Run the full suite: lint, typecheck, test, test:rls, build, and the Playwright journey from REQUIREMENTS.md on an iPhone-size viewport.
2. Drive the running app in a real browser as an agent, a forwarder and an admin. Visually inspect every screen at phone and desktop sizes and confirm there are no console errors. Passing tests alone is not enough.
3. Use the security-reviewer subagent on the whole codebase. Fix any blocking finding, especially RLS gaps. Then use the reviewer subagent and fix blocking findings. Re-run the suite.
4. Update README.md and docs/SETUP.md: local setup, environment variables, how email falls back to the console, and the deploy steps for GitHub, Supabase and Vercel.
5. Finish docs/BUILD_LOG.md with a table of the "Definition of done" items from REQUIREMENTS.md, each with evidence (test names or command results) and pass or fail.
6. `git push -u origin core-build` and open a PR with `gh pr create --fill`.
7. Follow SELF_IMPROVE.md: update PROCESS.md with what you learned, and update SELF_IMPROVE.md itself. Commit and push to `core-build`.

## Report to me
- What was built and what was not
- The done table with evidence
- Migrations in the PR (these apply to production when I merge)
- Environment variables I need in Vercel
- 5 steps to test it on my phone after I merge

Never claim a check passed unless you ran it.
