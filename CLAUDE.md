# CLAUDE.md

@AGENTS.md

## Claude Code
- Main command: `/build-core` builds everything in docs/SPEC.md in one run.
- Subagents in `.claude/agents/`: reviewer, security-reviewer.

## Commands (created during the build)
```bash
npm run dev        # local dev server
npm run build      # production build
npm run lint
npm run typecheck
npm test           # vitest
npm run test:rls   # RLS tests against local Supabase
npm run test:e2e   # Playwright, iPhone-size viewport
npm run db:reset   # reset local database, run migrations and seed
```
