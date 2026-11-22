# Requester / Quoter views: build brief

Hand this file to a session and say: "Build everything in docs/REQUESTER_QUOTER_VIEWS.md. Follow AGENTS.md. Open a PR, do not merge."

## Goal

One company can both post jobs and quote on other companies' jobs. Today the app shows both at once, split across tabs. Add a **global Requester / Quoter switch** so the user picks which side they are working on, and the screens show only that side's data.

No new database permissions are needed. The sides already come from row ownership and RLS: your company owns the job (Requester) or owns the quote (Quoter). Do not touch RLS, migrations or contact-detail rules.

## Decisions already made (do not re-ask)

1. **Names:** the two sides are **Requester** (posts the job, awards it) and **Quoter** (sends a sealed quote). "Poster" is retired in screen text and code names.
2. **Switch location:** one segmented switch in the top bar on every screen size. It remembers the choice and drives Dashboard, Jobs and the quotes list. "My Quotes" is part of Quoter mode.
3. **View content:**
   - **Requester:** jobs my company posted, quotes received on them, award actions, job scorecard.
   - **Quoter:** the open job board to quote on, my sent quotes, quote scorecard, lane demand.
4. **Rename scope:** screen text and code names only. The database is unchanged. The contact handoff function still returns `'poster'`; map it to "Requester" in the interface only. No migration.

## Design

### Mode storage
- Cookie `sb_mode` with value `requester` or `quoter`. One year, `SameSite=Lax`, `Secure` in production, path `/`. It holds no personal data.
- Validate the value with Zod on the server. Anything else is treated as unset.
- **Default when unset:** `agent` companies start as Requester, `forwarder` companies start as Quoter (from `companies.role`). The default is not written to the cookie until the user switches.

### Files to add
- `src/lib/mode.ts` (pure, unit-testable): `ViewMode` type, `MODE_COOKIE`, `parseMode(value)`, `defaultModeFor(role)`, `resolveMode(cookieValue, role)`, `navItemsFor(mode)`.
- `src/lib/view-mode.ts` (server only): `getViewMode(me)` reads the cookie via `cookies()` and calls `resolveMode`.
- `src/app/(app)/mode-actions.ts`: server action `setViewMode(mode)`. Zod-validate, set the cookie, `revalidatePath("/", "layout")`. No redirect, so the user stays on the current page.
- `src/components/mode-switch.tsx` (client): two-button segmented control, `role="radiogroup"` with `aria-checked`, calls the server action inside `useTransition`, shows the pending state, minimum 44px touch targets.

### Navigation
`TopNav` and `BottomNav` take a `mode` prop from `src/app/(app)/layout.tsx`.

| Mode | Items |
|---|---|
| Requester | My jobs (`/jobs`), Post (`/post`), Dashboard (`/dashboard`), Profile (`/profile`) |
| Quoter | Job board (`/jobs`), My quotes (`/quotes`), Dashboard (`/dashboard`), Profile (`/profile`) |

- Four items per mode, so the bottom bar becomes `grid-cols-4`.
- Place the switch in the header next to the logo. At 375px it must fit without horizontal scroll: shorten or hide the "Southbound" wordmark on very small widths if needed, keep the logo mark.
- Show the active mode in the switch with the accent colour, and expose it to screen readers.

### Pages
- **`/jobs`**
  - Requester: the current "My jobs" view (company's jobs with quote counts).
  - Quoter: the current open board with the destination and mode filters.
  - Remove `ViewTabs`. Keep the heading text "Jobs" (the e2e journey asserts it). Add a short subtitle that names the mode.
  - Ignore `?view=mine` (do not error). Keep filter query params working in Quoter mode.
  - Empty states are written for each side.
- **`/quotes`:** unchanged data. It is only linked in Quoter mode. If someone visits it in Requester mode, still render it (no redirect loops).
- **`/post`:** unchanged. Only linked in Requester mode.
- **`/dashboard`:**
  - Add a `side` to action items (`"requester" | "quoter"`), set where each item is built in `src/lib/dashboard.ts`. Existing item ids and ordering must not change.
  - Requester: Needs attention (requester items only), "Your jobs" scorecard.
  - Quoter: Needs attention (quoter items only), "Your quotes" scorecard, "Where the demand is".
  - Admin "Marketplace health" shows in both modes.
  - Subtitle names the mode.
- **`/jobs/[id]`:** keep deciding by ownership (`job.company_id === me.company.id`), never by the switch. A company must never see the wrong side of a job because of a cookie.

### Rename Poster to Requester
Screen text and code names only. Rename `poster-section.tsx` to `requester-section.tsx` (`RequesterSection`), `isPoster` to `isRequester`, and update copy in: `jobs/[id]/page.tsx`, `my-quote.tsx`, `quoter-section.tsx`, `contacts.tsx` ("Job poster" becomes "Requester"; keep the `"poster"` value coming from the database function and map it), and `dashboard.ts` strings ("awaiting the requester", "The requester's contact details"). Update email wording in `notification-plan.ts` and `notifications.ts` the same way, and keep `email.test.ts` and `lifecycle.test.ts` passing by updating expected text, not by weakening assertions. Do not rename database columns, function names or the RPC return value.

## Security rules (must hold)
- The cookie only changes which screen is shown. It never grants access. All access still comes from RLS and the ownership checks.
- Validate the cookie and the action input with Zod on the server.
- No personal data in the cookie or in logs.
- Sealed quotes and contact-detail rules are untouched. Add no new queries that read other companies' quotes.

## Tests
- Unit (`src/lib/mode.test.ts`): `parseMode` rejects bad values; defaults per company role; the cookie value wins over the default; `navItemsFor` returns the right four items for each mode.
- Unit: every action item from `buildActionQueue` has a `side`, and the filter returns the right subset for each mode. Existing dashboard tests stay green unchanged.
- E2E (Playwright, iPhone viewport, extend the existing specs):
  - An agent company lands in Requester mode, sees Post, switches to Quoter, sees the board and My quotes, reloads, and the mode persists.
  - A forwarder company lands in Quoter mode, switches to Requester, sees only its own jobs.
  - A company that has both posted and quoted sees different data in each mode.
  - No horizontal overflow at 375px with the switch in the header.
- Run: `npm run lint && npm run typecheck && npm test`, then `npm run test:e2e`. Do not weaken any existing test.

## Definition of done
1. Switch visible in the header at 375px and desktop, keyboard and screen-reader usable.
2. Mode persists across reloads and sessions; defaults follow company role.
3. Jobs, Quotes link, Post link and Dashboard follow the mode as in the tables above.
4. Job detail still follows ownership, not the cookie.
5. No "Poster" text left in the interface; no database or migration changes.
6. Lint, typecheck, unit and e2e all green, each run and reported with its result.
7. PR opened (small commits, for example `feat(views): requester/quoter switch`), not merged. Log it in `docs/BUILD_LOG.md`.

## Out of scope
Staff roles inside a company (Owner / Member / Viewer), one user in several companies, restricting a company to one side, and any RLS or migration work. These are separate future features.

## Notes for the builder
- Base the branch on `feat/wider-layout` if PR #10 is not merged yet (the job and quote lists and header width changed there), otherwise on `main`.
- Next.js 16 differs from older versions: read the relevant guide in `node_modules/next/dist/docs/` before using `cookies()`, server actions and `revalidatePath`.
- Australian English, DD/MM/YYYY dates.
