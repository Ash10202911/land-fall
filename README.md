# Southbound Core

A quote board where overseas freight agents post jobs, Australian and New Zealand forwarders send
sealed quotes, and the poster awards one. Mobile first, with quotes and contact details protected by
Row Level Security.

- **What to build:** [REQUIREMENTS.md](REQUIREMENTS.md) (the single source of truth)
- **How it is built:** [PROCESS.md](PROCESS.md), with agent rules in [AGENTS.md](AGENTS.md)
- **Setup and deploy:** [docs/SETUP.md](docs/SETUP.md)
- **Build progress:** [docs/BUILD_LOG.md](docs/BUILD_LOG.md)

## Run the build

With Claude Code, from the repository root:

```
claude
/build-core
```

With OpenCode, run the `build_and_improve` agent defined in `opencode.json`.

Either way, the build runs on a `core-build` branch and opens a pull request. It never pushes to `main`.
