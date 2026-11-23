# Southbound v2 plan

Status: phase 1 is in production; phase 2 is built on the `v2` branch (see docs/BUILD_LOG.md); phases 3 and 4 are not built. Decided 22/11/2026. Mockups:
https://claude.ai/artifact/4rDqhbZbzWpVpxGpTfHzSX (ocean + sky screens and the "v2" row).

Before building, the parts we keep move into docs/REQUIREMENTS.md (v1 says anything not in the spec is out
of scope). Every new table gets Row Level Security and tests, as in v1.

## 1. Principles

- **One company, two activities.** Any company can request quotes and send quotes. The agent or
  forwarder role is a profile label only and never limits what a company can do (the database already
  works this way).
- **Quotes stay sealed.** Nothing new may show one company's prices to another. Insights are counts and
  timings only. Competition is shown as bands, never counts.
- **Speed wins work.** Alerts and rate cards exist to cut the time from "job posted" to "quote sent".
- **A human sends every quote.** Rate cards fill the form; the forwarder checks it and taps Send.

## 2. Look and feel

Ocean + sky blue: ocean teal `#0891B2` for sea, sky blue `#0EA5E9` for air, navy `#0C4A6E` buttons,
off-white `#F2F9FC` background, red only for dangerous goods and deadlines under 24 hours.

Job card, top to bottom: route map with flags, NEW badge (jobs since last visit), countdown ring;
"what you price" headline from the Incoterm (Destination only, Freight + destination, Door to door);
repeat-business badge; five-leg scope strip (pickup, freight, destination, customs, delivery); delivery
suburb and postcode with unload type; cargo size (container pictures or weight); ready and needed-by
dates; warning chips; competition band; Send quote.

## 3. Menu

| Tab | Purpose |
|---|---|
| Jobs (home) | Other companies' open jobs to quote on. Own jobs are hidden here. |
| Request quote | Post a job. It appears on everyone else's board. |
| My requests | Jobs I posted: quotes in, compare, award, answer questions. |
| My quotes | Quotes I sent: open, won, lost, expiring; win rate and funnel at the top. |
| Insights | Market-wide trends for all signed-in users. |
| My lanes | Lane alerts and rate cards (from Profile on phones). |

The Dashboard tab is removed. Its parts move: needs-attention items become an alert strip on Jobs and
number badges on tabs; quote scorecard to My quotes; job scorecard to My requests; marketplace health to an
admin-only page.

## 4. Features

### 4.1 New job fields
- Delivery suburb + postcode (shown to all). The full street address is asked when the requester
  awards (not when posting) and is visible only to the requester and the winner, same rule as contact
  details.
- The request form stays quick: "repeat last job", Incoterm chips that pre-set the scope strip, a
  postcode that resolves the suburb, and close time / regular work / audience folded into one
  "Defaults" line.
- Unload type: forklift on site, tailgate truck, side-loader, dock live unload, customer unpacks.
- Repeat business: one-off, weekly, monthly, quarterly, plus expected volume text.
- Required delivery date (on or after the ready date).
- Dropped after review: customs complexity (HS codes, tariff lines, FTA), cargo value, pallet sizes,
  target budget.

### 4.2 Scope of work (no new data)
Worked out from Incoterm + services. Pickup only for EXW; freight for EXW, FCA, FAS, FOB; destination,
customs and delivery from the services the poster ticks.

### 4.3 Lane alerts
- A lane = origin (port or whole country) → destination port, plus modes and scope filter.
- Email per lane: instantly, daily summary at 7am (company's time zone), or off.
- Email shows the job summary and, when a rate card matches, the pre-filled total with a
  "Review and send quote" link. Never other companies' quotes.
- Reuses the existing email sender (Resend, console fallback).

### 4.4 Rate cards and pre-filled quotes
- A rate card belongs to a company and a destination port: fixed charges (per job or per container
  type), cartage by postcode zone (postcode ranges, price per container type or per cbm/kg), extras
  (side-loader, tailgate, waiting time), currency, valid-to date.
- Two ways in: a guided in-app editor and a spreadsheet template upload (validated with Zod; every
  rejected row reported with its row number).
- Opening Send quote on a matching job fills the line items, each tagged with its source ("Rate card",
  "Zone 2 · postcode 2164"). The forwarder can untick or edit lines. Nothing is sent automatically.
- Expiring rate cards are flagged 14 days ahead.
- Rate cards are private to their company (RLS), never visible to other companies or admins' insights.

### 4.5 Like-for-like comparison (poster)
- Coverage grid: which quotes include destination charges, customs, delivery.
- Warnings: missing legs, validity shorter than the ready date, foreign currency (with an AUD estimate
  labelled as an estimate).
- "Lowest complete quote" badge; filter "only quotes that cover everything".

### 4.6 Preferred partners first
Poster can pick favourite companies who see a new job for the first 12 hours before it goes public.
Alerts to others are held until then.

### 4.7 Public questions on a job
Quoters ask; the poster answers; every quoter sees the answer. The asker's name is not shown.

### 4.8 Ratings and reliability
- After delivery both sides rate: price matched quote, on time, communication (1–5).
- Shown as average and job count; "New" until 3 ratings.
- Response badges: "Usually quotes within X h" (quoter), "Awards N% of jobs" (poster).

### 4.9 Shipment progress
Winner updates milestones: booked, sailed or departed, arrived, cleared, delivered. Poster sees them and
gets an email at arrived and delivered. Delivered unlocks ratings.

### 4.10 Auto-extend quiet jobs
If a job has no quotes 12 hours before closing, offer the poster a one-tap extension (24 or 48 h) and
re-alert matching lanes.

### 4.11 Market insights
For all signed-in users, 30 or 90 days: quote requests and trend, median time to first quote, share of
jobs awarded, active quoters; busiest lanes map and table with trend and sea/air mix; requests per week;
mode mix; scope mix; speed to first quote; busiest destination ports. Counts only, served by a security
definer function that returns no amounts, names or contact details, and hides any lane with fewer than
3 jobs in the window so single companies can't be identified.

### 4.12 Competition band
Security definer function returns per open job only a band: none, a few (1–3), busy (4+).

## 4.13 Requester / Quoter switch (locked in, 22/11/2026)

The founder locked in the brief in docs/REQUESTER_QUOTER_VIEWS.md as part of the final build. It is
built after this design is finalised, not before. What it adds on top of this plan:

- One segmented **Requester / Quoter** switch in the top bar on every screen; the choice is kept in the
  `sb_mode` cookie (Zod-validated, no personal data). Default: agents start as Requester, forwarders as
  Quoter.
- The switch only changes which screens and lists are shown. Access still comes only from RLS and
  ownership; job detail always follows ownership, never the cookie.
- "Poster" is renamed "Requester" in screen text and code names only. No database, RLS or migration
  changes.
- Its security rules, tests and definition of done apply in full.

When building, the brief's navigation is adapted to this plan (the brief was written before these
decisions). Proposed mapping, to confirm when the design is final:

| Brief says | v2 plan | Proposed in the final build |
|---|---|---|
| Dashboard in both modes | Dashboard tab removed | No Dashboard. Requester: needs-attention strip + job scorecard at the top of My requests. Quoter: needs-attention strip + quote scorecard at the top of My quotes; lane demand on Insights. |
| Requester: My jobs, Post, Dashboard, Profile | My requests, Request quote | Requester: My requests, Request quote, Insights, Profile |
| Quoter: Job board, My quotes, Dashboard, Profile | Jobs, My quotes, My lanes | Quoter: Job board, My quotes, My lanes, Insights (Profile from the header) |
| Admin Marketplace health on Dashboard | Admin-only page | Admin page, reachable in both modes |

Everything else in the brief (cookie, defaults, ownership rule, rename, tests) is used as written.

## 5. Build phases

1. **Foundation**: theme, Requester / Quoter switch with the new menus (section 4.13), remove
   dashboard, job card redesign, new job fields, scope strip, competition band, port coordinates for maps.
2. **Speed**: lane alerts (instant + daily), rate cards (in-app + upload), pre-filled quotes.
3. **Decide**: like-for-like comparison, public questions, auto-extend.
4. **Trust and insight**: insights page, ratings, response badges, shipment progress, preferred partners.

Each phase: migrations in supabase/migrations, RLS tests for every new rule, Playwright on an
iPhone viewport, small commits tagged with the feature, a PR per phase.

## 6. Later, not in v2
Paid Verified subscription, success fee or paid alerts; documents exchange; live exchange rates feed
(v2 uses a daily rate with a clear "estimate" label).
