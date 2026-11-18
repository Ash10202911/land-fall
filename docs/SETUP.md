# Southbound Core

A quote board where overseas agents and ANZ freight forwarders post jobs, send quotes and win business, fast.

This is the core build: sign-in, post a job, sealed quotes, award, contact handoff, admin verification and email notifications. The full requirements are in [REQUIREMENTS.md](../REQUIREMENTS.md) and the build process is in [PROCESS.md](../PROCESS.md).

## Before the build (about 30 minutes, once)

### 1. Install
Node.js 20+, Git, Docker Desktop (running), GitHub CLI (`gh`), Claude Code.

### 2. GitHub
The code lives in `Ash10202911/land-fall`.
```bash
gh auth login
git clone https://github.com/Ash10202911/land-fall
cd land-fall
```
Then in the repo on GitHub: Settings, Branches, protect `main` (require a pull request).

### 3. Supabase
1. Create a project in the Sydney region. Save the database password.
2. Note the Project URL, anon key, service_role key and project ref.
3. Authentication: turn on Email (magic link).
4. Create a personal access token (Account, Access Tokens).

### 4. GitHub secrets (for applying migrations on merge)
Repo Settings, Secrets and variables, Actions:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

### 5. Vercel
1. Sign in with GitHub, Add New Project, import `land-fall`.
2. Environment Variables (Production and Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (your Vercel URL). Add `RESEND_API_KEY` and `EMAIL_FROM` later for real emails.
   Or use the Supabase integration in the Vercel Marketplace to copy the Supabase keys across.
3. Copy the Vercel production URL into Supabase, Authentication, URL configuration: Site URL and a redirect URL. Add `http://localhost:3000` as a redirect URL too.

## Run the build
```bash
claude
```
Then type:
```
/build-core
```
It runs for about 1 to 2 hours, builds and tests everything locally, pushes branch `core-build` and opens a PR. Progress is written to docs/BUILD_LOG.md.

## After the build
1. Read Claude's report and docs/BUILD_LOG.md.
2. Check the PR on GitHub: CI should be green.
3. Merge the PR. GitHub Actions applies the database migrations to Supabase, and Vercel deploys to production.
4. Make yourself admin: in Supabase, Table Editor, `profiles`, set `is_admin` to true on your row.
5. Test on your phone with the steps from Claude's report.

## Local development
```bash
cp .env.example .env.local   # fill from `npx supabase status`
npm install
npx supabase start
npm run db:reset
npm run dev
```
