# Southbound Core Build Process

The single process for building this project, whichever tool runs it (Claude Code with
`/build-core`, or OpenCode with the `build_and_improve` agent in `opencode.json`).

The product requirements live in REQUIREMENTS.md. Rules for any coding agent live in AGENTS.md.
Do not duplicate requirements here.

## Steps

1. Read AGENTS.md and REQUIREMENTS.md. Create a `core-build` branch from `main`.
2. Build the project in the phases defined in REQUIREMENTS.md (F1 to F8, in order). Do not start a
   phase until every success criterion of the previous one is demonstrably met.
3. Ensure the Definition of done and Final success criteria in REQUIREMENTS.md are all met.
4. Review the final product: run the security-reviewer and reviewer subagents (`.claude/agents/`),
   or the `product_review` subagent when running under OpenCode. Validate in a real browser as an
   agent, a forwarder and an admin.
5. Incorporate any blocking findings and re-run the full suite.
6. Push `core-build` and open a pull request. Never push to `main`, merge, deploy, or link a remote
   Supabase project.
7. IMPORTANT: follow SELF_IMPROVE.md to improve this process.

You must complete step 7 (self-improvement) before you stop.

## Logging

Record progress, shortcuts and blockers in docs/BUILD_LOG.md as you go. Never claim a check passed
unless you ran it.

## Lessons learned

_None yet. Add entries here during the self-improvement step: what went wrong, what to do instead._
