# Dashboard: analysis and ranking

The spec lists "no analytics beyond what the app needs to run" as out of scope for v1. This dashboard is a
deliberate, founder-requested addition for the release after v1. It follows the same trust rules.

## The rule that shapes everything

Quotes are sealed. So every figure on the dashboard comes from data the signed-in user may already read:

- their own jobs and the quotes on them (the poster's view),
- their own quotes (the quoter's view),
- the public job board (jobs are visible to every signed-in user),
- for admins only, counts and timings from two security definer functions that return no amounts, notes or
  contact details.

Anything that would compare other companies' prices (lane price benchmarks, "how did the winner price it")
is **not built**, because it would turn sealed quotes into a leak. See "Candidates not built".

## Candidates, scored

Score is value to the business and the user (1 to 5), effort (1 low to 5 high) and trust risk (low, medium, high).

| # | Candidate | Who | Value | Effort | Trust risk | Built |
|---|---|---|---|---|---|---|
| 1 | Needs-attention queue: quotes waiting to compare, blocked by verification, jobs closing with no quotes, quotes about to expire, jobs won, open jobs closing that I have not quoted | Everyone | 5 | 2 | Low | Yes |
| 2 | Marketplace health: jobs that get a quote, quoted jobs awarded, quotes per job, time to first quote, verified share, plus a verification queue | Admin | 5 | 3 | Low (counts only) | Yes |
| 3 | Quote scorecard: win rate, quotes sent and open, value won, time to quote, win rate by mode | Forwarders | 4 | 2 | Low | Yes |
| 4 | Job scorecard: award rate, quotes per job, time to first quote, price spread, did I pick the lowest | Posters | 4 | 2 | Low | Yes |
| 5 | Lane demand: busiest lanes in 30 days with trend, mode mix, special-cargo share | Everyone | 3 | 2 | Low (jobs are public) | Yes |

### Why this order

1. **Needs attention** drives the core loop (post, quote, award). Every item is one tap from an action, so it
   directly raises quote and award conversion. It also surfaces the biggest known blocker: a Basic poster with
   quotes waiting cannot award.
2. **Marketplace health** is the founder's north star: liquidity (do jobs get quotes?) and conversion (do
   quotes become awards?). The verification queue lists exactly which Basic companies are stuck on awarding,
   so verifying them first unblocks real jobs.
3. **Quote scorecard** gives forwarders a reason to come back and a way to see which modes they win.
4. **Job scorecard** shows posters whether their jobs attract quotes and how much price competition they get.
5. **Lane demand** helps forwarders choose where to focus. It ranks last because it is useful but does not
   move a specific job forward.

### Candidates not built

| Candidate | Why not now |
|---|---|
| Lane price benchmarks (average quote per lane) | Would reveal other companies' sealed prices. Needs a minimum-contributors rule (for example at least 5 companies) and a product decision first. |
| Winner's price after award | Same leak. The spec says quoters only see their own quote. |
| Revenue, GMV or take rate | Out of scope: no payments or invoicing in v1, and admins have no access to quote amounts. |
| Time to award | There is no `awarded_at` column. Needs a migration to record it. |
| Cargo mix by commodity | Cargo is free text, so it cannot be grouped reliably. |
| Email open and click rates | Needs the email provider's analytics, which are not wired in. |
| Charts over time (daily series) | Useful once there is more data. Current numbers are totals and medians. |

## Where the code is

- `src/lib/dashboard.ts`: pure calculations (unit tested in `src/lib/dashboard.test.ts`).
- `src/lib/dashboard-data.ts`: server-only loaders. They use the user's session, so Row Level Security applies.
- `supabase/migrations/20261119000500_dashboard_stats.sql`: `admin_marketplace_stats(p_days)` and
  `admin_verification_queue()`. Both refuse non-admins.
- `src/app/(app)/dashboard/page.tsx`: the page, a new "Dashboard" tab.
- `tests/rls/sec8-dashboard-stats.test.ts`: non-admins are refused, results carry no money or contact
  fields, and the dashboard's embedded queries cannot return another company's quotes.
- `tests/e2e/dashboard.spec.ts`: iPhone journey for a member and for the admin.

## Definitions

- **Win rate** = won / (won + lost). Withdrawn and still-open quotes are not counted.
- **Award rate** (poster) = awarded / (awarded + closed without an award).
- **Time to first quote** is a median, from the job being posted to the first quote on it.
- **Price spread**: only quotes in a single currency are compared, and never across currencies.
- **Quotes per job** counts live quotes (withdrawn quotes excluded).
- Windows: own activity 90 days; marketplace health 30 days; lane demand 30 days against the 30 before.
- Limits: the loaders read up to 500 jobs, 500 quotes and 1,000 board jobs. Beyond that the figures are for the
  most recent rows.
