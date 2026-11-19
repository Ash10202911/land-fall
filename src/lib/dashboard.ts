/**
 * Dashboard calculations. Pure functions: rows in, numbers out, with `now` passed in so tests are exact.
 *
 * Every input here is data the signed-in user may already read under Row Level Security:
 * their own jobs (with the quotes on them), their own quotes, and the public job board.
 * Nothing here reads another company's quotes, so sealed quotes stay sealed.
 */
import { totalsByCurrency } from "@/lib/domain";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type PortLite = { code: string; name: string };
type Line = { amount_minor: number | string | bigint; currency: string };

/** A quote on one of my jobs (the poster's view). */
export type JobQuote = { id: string; status: string; created_at: string; lines: Line[] };

/** One of my jobs with the quotes I can see on it. */
export type MyJob = {
  id: string;
  status: "open" | "awarded" | "cancelled";
  deadline_at: string;
  created_at: string;
  mode: "FCL" | "LCL" | "Air";
  origin: PortLite;
  destination: PortLite;
  quotes: JobQuote[];
};

/** One of my quotes with its job (the quoter's view). */
export type MyQuote = {
  id: string;
  job_id: string;
  status: "sent" | "withdrawn" | "won" | "lost";
  created_at: string;
  valid_until: string;
  lines: Line[];
  job: {
    status: "open" | "awarded" | "cancelled";
    deadline_at: string;
    created_at: string;
    mode: "FCL" | "LCL" | "Air";
    origin: PortLite;
    destination: PortLite;
  } | null;
};

/** A job on the public board. */
export type BoardJob = {
  id: string;
  company_id: string;
  status: "open" | "awarded" | "cancelled";
  deadline_at: string;
  created_at: string;
  mode: "FCL" | "LCL" | "Air";
  origin: PortLite;
  destination: PortLite;
  flag_dg: boolean;
  flag_reefer: boolean;
  flag_bmsb: boolean;
};

const route = (j: { origin: PortLite; destination: PortLite }) => `${j.origin.name} to ${j.destination.name}`;
const ms = (iso: string) => new Date(iso).getTime();
const liveQuotes = (j: MyJob) => j.quotes.filter((q) => q.status !== "withdrawn");

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 100);

export function formatHours(h: number | null): string {
  if (h === null) return "No data yet";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} days`;
}

function timeLeft(deadline: string, now: Date): string {
  const h = Math.max(0, (ms(deadline) - now.getTime()) / HOUR);
  return h < 1 ? "under an hour" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;
}

/** The total of a quote when it uses a single currency, otherwise null (never mix currencies). */
function singleCurrencyTotal(lines: Line[]): { currency: string; minor: number } | null {
  const totals = totalsByCurrency(lines);
  return totals.length === 1 ? totals[0] : null;
}

// ---------------------------------------------------------------------------
// 1. Needs attention
// ---------------------------------------------------------------------------

export type ActionTone = "danger" | "warning" | "success" | "neutral";
export type ActionItem = { id: string; tone: ActionTone; title: string; detail: string; href: string };

const toneOrder: Record<ActionTone, number> = { danger: 0, warning: 1, success: 2, neutral: 3 };

export function buildActionQueue(input: {
  isVerified: boolean;
  myJobs: MyJob[];
  myQuotes: MyQuote[];
  openJobs: Pick<BoardJob, "id" | "deadline_at" | "mode" | "origin" | "destination" | "company_id">[];
  myCompanyId: string;
  now: Date;
  limit?: number;
}): ActionItem[] {
  const { isVerified, myJobs, myQuotes, openJobs, myCompanyId, now } = input;
  const items: ActionItem[] = [];
  const t = now.getTime();

  // Poster: quotes are waiting on open jobs.
  const waiting = myJobs.filter((j) => j.status === "open" && j.quotes.some((q) => q.status === "sent"));
  const waitingQuotes = waiting.reduce((n, j) => n + j.quotes.filter((q) => q.status === "sent").length, 0);
  if (waiting.length > 0 && !isVerified) {
    items.push({
      id: "get-verified",
      tone: "danger",
      title: `Get verified to award ${waitingQuotes} ${waitingQuotes === 1 ? "quote" : "quotes"}`,
      detail: `${waiting.length} of your ${waiting.length === 1 ? "job has" : "jobs have"} quotes waiting. Only Verified companies can award.`,
      href: "/profile",
    });
  } else {
    for (const j of waiting) {
      const n = j.quotes.filter((q) => q.status === "sent").length;
      items.push({
        id: `award-${j.id}`,
        tone: "success",
        title: `${n} ${n === 1 ? "quote" : "quotes"} ready to compare`,
        detail: `${route(j)}. ${ms(j.deadline_at) > t ? `Quotes close in ${timeLeft(j.deadline_at, now)}.` : "Quoting has closed. Choose a winner."}`,
        href: `/jobs/${j.id}`,
      });
    }
  }

  // Poster: no quotes yet.
  for (const j of myJobs) {
    if (j.status !== "open" || liveQuotes(j).length > 0) continue;
    const left = ms(j.deadline_at) - t;
    if (left > 0 && left <= DAY) {
      items.push({
        id: `closing-${j.id}`,
        tone: "warning",
        title: "Closing soon with no quotes",
        detail: `${route(j)}. Closes in ${timeLeft(j.deadline_at, now)}. Extend the deadline to give forwarders more time.`,
        href: `/jobs/${j.id}/edit`,
      });
    } else if (left <= 0 && t - ms(j.deadline_at) <= 14 * DAY) {
      items.push({
        id: `expired-${j.id}`,
        tone: "neutral",
        title: "No quotes received",
        detail: `${route(j)}. The deadline passed with no quotes. Post it again with a longer deadline.`,
        href: `/jobs/${j.id}`,
      });
    }
  }

  // Quoter: validity running out, recent wins.
  const quotedLive = new Set<string>();
  for (const q of myQuotes) {
    if (q.status !== "withdrawn") quotedLive.add(q.job_id);
    if (!q.job) continue;
    const jobOpen = q.job.status === "open";
    if (q.status === "sent" && jobOpen) {
      const validTo = ms(`${q.valid_until}T23:59:59Z`);
      if (validTo - t <= 3 * DAY && validTo >= t) {
        items.push({
          id: `expiring-${q.id}`,
          tone: "warning",
          title: "Your quote expires soon",
          detail: `${route(q.job)}. Valid until ${q.valid_until.split("-").reverse().join("/")}. Edit it to extend the validity.`,
          href: `/jobs/${q.job_id}`,
        });
      }
    }
    if (q.status === "won" && t - ms(q.created_at) <= 30 * DAY) {
      items.push({
        id: `won-${q.id}`,
        tone: "success",
        title: "You won a job",
        detail: `${route(q.job)}. The poster's contact details are on the job page.`,
        href: `/jobs/${q.job_id}`,
      });
    }
  }

  // Quoter: open jobs closing soon that I have not quoted.
  const closingSoon = openJobs
    .filter((j) => j.company_id !== myCompanyId && !quotedLive.has(j.id))
    .map((j) => ({ j, left: ms(j.deadline_at) - t }))
    .filter(({ left }) => left > 0 && left <= 2 * DAY)
    .sort((a, b) => a.left - b.left)
    .slice(0, 3);
  for (const { j } of closingSoon) {
    items.push({
      id: `closing-open-${j.id}`,
      tone: "neutral",
      title: `${j.mode} job closing in ${timeLeft(j.deadline_at, now)}`,
      detail: `${route(j)}. You have not quoted this job yet.`,
      href: `/jobs/${j.id}`,
    });
  }

  return items.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]).slice(0, input.limit ?? 8);
}

// ---------------------------------------------------------------------------
// 2. Marketplace health (admin). The numbers come from admin_marketplace_stats().
// ---------------------------------------------------------------------------

export type MarketplaceStats = {
  days: number;
  jobs: {
    posted: number;
    awarded: number;
    cancelled: number;
    open_now: number;
    awaiting_award: number;
    expired_no_quotes: number;
    with_quotes: number;
    avg_quotes_per_job: number;
    median_hours_to_first_quote: number | null;
  };
  quotes_sent: number;
  companies: {
    total: number;
    verified: number;
    basic: number;
    suspended: number;
    agents: number;
    forwarders: number;
    new_in_window: number;
  };
};

export type MarketplaceKpi = { label: string; value: string; hint: string };

/** The headline numbers an operator watches: do jobs get quotes, and do quotes become awards? */
export function marketplaceKpis(s: MarketplaceStats): MarketplaceKpi[] {
  const quoted = pct(s.jobs.with_quotes, s.jobs.posted);
  const awardedRate = pct(s.jobs.awarded, s.jobs.with_quotes);
  const verifiedShare = pct(s.companies.verified, s.companies.total);
  return [
    {
      label: "Jobs that got a quote",
      value: quoted === null ? "None yet" : `${quoted}%`,
      hint: `${s.jobs.with_quotes} of ${s.jobs.posted} jobs posted in ${s.days} days`,
    },
    {
      label: "Quoted jobs awarded",
      value: awardedRate === null ? "None yet" : `${awardedRate}%`,
      hint: `${s.jobs.awarded} awarded, ${s.jobs.awaiting_award} still waiting for the poster`,
    },
    {
      label: "Quotes per job",
      value: s.jobs.posted === 0 ? "None yet" : String(s.jobs.avg_quotes_per_job),
      hint: `${s.quotes_sent} quotes sent in ${s.days} days`,
    },
    {
      label: "Time to first quote",
      value: formatHours(s.jobs.median_hours_to_first_quote),
      hint: "Median, from posting to the first quote",
    },
    {
      label: "Verified companies",
      value: verifiedShare === null ? "None yet" : `${verifiedShare}%`,
      hint: `${s.companies.verified} verified, ${s.companies.basic} basic, ${s.companies.suspended} suspended`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 3. Quote scorecard (forwarders)
// ---------------------------------------------------------------------------

export type ModeStat = { mode: string; sent: number; won: number; lost: number; winRate: number | null };

export type QuoteScorecard = {
  days: number;
  sent: number;
  won: number;
  lost: number;
  withdrawn: number;
  open: number;
  awaitingAward: number;
  winRate: number | null;
  wonValue: { currency: string; minor: number }[];
  medianHoursToQuote: number | null;
  byMode: ModeStat[];
};

export function buildQuoteScorecard(quotes: MyQuote[], now: Date, days = 90): QuoteScorecard {
  const since = now.getTime() - days * DAY;
  const inWindow = quotes.filter((q) => ms(q.created_at) >= since);
  const count = (s: MyQuote["status"]) => inWindow.filter((q) => q.status === s).length;
  const won = count("won");
  const lost = count("lost");

  const sentRows = inWindow.filter((q) => q.status === "sent" && q.job);
  const open = sentRows.filter((q) => q.job!.status === "open" && ms(q.job!.deadline_at) > now.getTime()).length;
  const awaitingAward = sentRows.filter(
    (q) => q.job!.status === "open" && ms(q.job!.deadline_at) <= now.getTime(),
  ).length;

  const byMode: ModeStat[] = (["FCL", "LCL", "Air"] as const)
    .map((mode) => {
      const rows = inWindow.filter((q) => q.job?.mode === mode);
      const w = rows.filter((q) => q.status === "won").length;
      const l = rows.filter((q) => q.status === "lost").length;
      return { mode, sent: rows.length, won: w, lost: l, winRate: pct(w, w + l) };
    })
    .filter((m) => m.sent > 0);

  const hours = inWindow
    .filter((q) => q.job)
    .map((q) => (ms(q.created_at) - ms(q.job!.created_at)) / HOUR)
    .filter((h) => h >= 0);

  return {
    days,
    sent: inWindow.length,
    won,
    lost,
    withdrawn: count("withdrawn"),
    open,
    awaitingAward,
    winRate: pct(won, won + lost),
    wonValue: totalsByCurrency(inWindow.filter((q) => q.status === "won").flatMap((q) => q.lines)),
    medianHoursToQuote: median(hours),
    byMode,
  };
}

// ---------------------------------------------------------------------------
// 4. Job scorecard (posters)
// ---------------------------------------------------------------------------

export type JobScorecard = {
  days: number;
  posted: number;
  open: number;
  awarded: number;
  cancelled: number;
  expired: number;
  awardRate: number | null;
  avgQuotesPerJob: number | null;
  noQuoteRate: number | null;
  medianHoursToFirstQuote: number | null;
  /** Average gap between the highest and lowest quote, as a share of the highest. */
  avgPriceSpreadPct: number | null;
  spreadJobs: number;
  /** Awards that went to the lowest quote, out of awards where quotes could be compared. */
  lowestPicked: number;
  awardsCompared: number;
};

export function buildJobScorecard(jobs: MyJob[], now: Date, days = 90): JobScorecard {
  const t = now.getTime();
  const rows = jobs.filter((j) => ms(j.created_at) >= t - days * DAY);
  const open = rows.filter((j) => j.status === "open" && ms(j.deadline_at) > t);
  const awarded = rows.filter((j) => j.status === "awarded");
  const cancelled = rows.filter((j) => j.status === "cancelled");
  const expired = rows.filter((j) => j.status === "open" && ms(j.deadline_at) <= t);
  const closed = [...awarded, ...expired];

  const counted = rows.filter((j) => j.status !== "cancelled");
  const quoteCounts = counted.map((j) => liveQuotes(j).length);
  const firstQuoteHours = counted
    .filter((j) => j.quotes.length > 0)
    .map((j) => (Math.min(...j.quotes.map((q) => ms(q.created_at))) - ms(j.created_at)) / HOUR)
    .filter((h) => h >= 0);

  // Price spread and "did I pick the cheapest": single-currency quotes only, never mixing currencies.
  const spreads: number[] = [];
  let lowestPicked = 0;
  let awardsCompared = 0;
  for (const j of rows) {
    const byCurrency = new Map<string, { id: string; status: string; minor: number }[]>();
    for (const q of liveQuotes(j)) {
      const total = singleCurrencyTotal(q.lines);
      if (!total) continue;
      byCurrency.set(total.currency, [...(byCurrency.get(total.currency) ?? []), { id: q.id, status: q.status, minor: total.minor }]);
    }
    for (const list of byCurrency.values()) {
      if (list.length < 2) continue;
      const hi = Math.max(...list.map((x) => x.minor));
      const lo = Math.min(...list.map((x) => x.minor));
      if (hi > 0) spreads.push(((hi - lo) / hi) * 100);
      const winner = list.find((x) => x.status === "won");
      if (winner) {
        awardsCompared += 1;
        if (winner.minor === lo) lowestPicked += 1;
      }
    }
  }

  return {
    days,
    posted: rows.length,
    open: open.length,
    awarded: awarded.length,
    cancelled: cancelled.length,
    expired: expired.length,
    awardRate: pct(awarded.length, awarded.length + expired.length),
    avgQuotesPerJob: quoteCounts.length === 0 ? null : Math.round((quoteCounts.reduce((a, b) => a + b, 0) / quoteCounts.length) * 10) / 10,
    noQuoteRate: pct(closed.filter((j) => liveQuotes(j).length === 0).length, closed.length),
    medianHoursToFirstQuote: median(firstQuoteHours),
    avgPriceSpreadPct: spreads.length === 0 ? null : Math.round(spreads.reduce((a, b) => a + b, 0) / spreads.length),
    spreadJobs: spreads.length,
    lowestPicked,
    awardsCompared,
  };
}

// ---------------------------------------------------------------------------
// 5. Lane demand (public board data)
// ---------------------------------------------------------------------------

export type LaneStat = {
  key: string;
  origin: string;
  destination: string;
  jobs: number;
  previous: number;
  openNow: number;
  modes: string;
};

export type LaneDemand = {
  days: number;
  total: number;
  previousTotal: number;
  lanes: LaneStat[];
  modeMix: { mode: string; count: number; pct: number }[];
  flags: { dg: number; reefer: number; bmsb: number };
};

export function buildLaneDemand(jobs: BoardJob[], now: Date, days = 30, topN = 5): LaneDemand {
  const t = now.getTime();
  const usable = jobs.filter((j) => j.status !== "cancelled");
  const current = usable.filter((j) => ms(j.created_at) >= t - days * DAY);
  const previous = usable.filter((j) => ms(j.created_at) >= t - 2 * days * DAY && ms(j.created_at) < t - days * DAY);

  const lanes = new Map<string, LaneStat & { modeCounts: Map<string, number> }>();
  for (const j of current) {
    const key = `${j.origin.code}-${j.destination.code}`;
    const lane =
      lanes.get(key) ??
      { key, origin: j.origin.name, destination: j.destination.name, jobs: 0, previous: 0, openNow: 0, modes: "", modeCounts: new Map() };
    lane.jobs += 1;
    if (j.status === "open" && ms(j.deadline_at) > t) lane.openNow += 1;
    lane.modeCounts.set(j.mode, (lane.modeCounts.get(j.mode) ?? 0) + 1);
    lanes.set(key, lane);
  }
  for (const j of previous) {
    const lane = lanes.get(`${j.origin.code}-${j.destination.code}`);
    if (lane) lane.previous += 1;
  }

  const top = [...lanes.values()]
    .sort((a, b) => b.jobs - a.jobs || b.openNow - a.openNow || a.key.localeCompare(b.key))
    .slice(0, topN)
    .map(({ modeCounts, ...lane }) => ({
      ...lane,
      modes: [...modeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m).join(", "),
    }));

  const modeMix = (["FCL", "LCL", "Air"] as const)
    .map((mode) => ({ mode, count: current.filter((j) => j.mode === mode).length }))
    .filter((m) => m.count > 0)
    .map((m) => ({ ...m, pct: pct(m.count, current.length) ?? 0 }));

  return {
    days,
    total: current.length,
    previousTotal: previous.length,
    lanes: top,
    modeMix,
    flags: {
      dg: current.filter((j) => j.flag_dg).length,
      reefer: current.filter((j) => j.flag_reefer).length,
      bmsb: current.filter((j) => j.flag_bmsb).length,
    },
  };
}
