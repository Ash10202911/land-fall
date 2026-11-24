import { describe, expect, it } from "vitest";
import {
  actionsFor,
  buildActionQueue,
  buildJobScorecard,
  buildLaneDemand,
  buildQuoteScorecard,
  formatHours,
  marketplaceKpis,
  median,
  pct,
  type BoardJob,
  type MyJob,
  type MyQuote,
  type MarketplaceStats,
} from "./dashboard";

const now = new Date("2026-11-19T00:00:00Z");
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * 3_600_000).toISOString();
const day = (daysFromNow: number) => at(daysFromNow * 24).slice(0, 10);
const sha = { code: "CNSHA", name: "Shanghai" };
const syd = { code: "AUSYD", name: "Sydney" };
const mel = { code: "AUMEL", name: "Melbourne" };
const lines = (minor: number, currency = "USD") => [{ amount_minor: minor, currency }];

function job(over: Partial<MyJob> & { id: string }): MyJob {
  return {
    status: "open",
    deadline_at: at(48),
    created_at: at(-24),
    mode: "FCL",
    origin: sha,
    destination: syd,
    quotes: [],
    ...over,
  };
}

function quote(over: Partial<MyQuote> & { id: string }): MyQuote {
  return {
    job_id: `job-${over.id}`,
    status: "sent",
    created_at: at(-20),
    valid_until: day(10),
    lines: lines(100_00),
    job: { status: "open", deadline_at: at(48), created_at: at(-24), mode: "FCL", origin: sha, destination: syd },
    ...over,
  };
}

describe("helpers", () => {
  it("median handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("pct avoids dividing by zero", () => {
    expect(pct(1, 0)).toBeNull();
    expect(pct(1, 3)).toBe(33);
  });

  it("formats hours in readable units", () => {
    expect(formatHours(null)).toBe("No data yet");
    expect(formatHours(0.25)).toBe("15 min");
    expect(formatHours(5.5)).toBe("5.5 h");
    expect(formatHours(96)).toBe("4 days");
  });
});

describe("buildActionQueue", () => {
  const base = { isVerified: true, myJobs: [], myQuotes: [], openJobs: [], myCompanyId: "me", now };

  it("tells an unverified requester to get verified once quotes are waiting", () => {
    const j = job({ id: "a", quotes: [{ id: "q1", status: "sent", created_at: at(-2), lines: lines(1) }] });
    const items = buildActionQueue({ ...base, isVerified: false, myJobs: [j] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "get-verified", tone: "danger", href: "/profile" });
  });

  it("lets a verified requester go straight to comparing quotes", () => {
    const j = job({ id: "a", quotes: [{ id: "q1", status: "sent", created_at: at(-2), lines: lines(1) }] });
    const items = buildActionQueue({ ...base, myJobs: [j] });
    expect(items[0]).toMatchObject({ id: "award-a", tone: "success", href: "/jobs/a" });
  });

  it("warns about a job closing within a day with no quotes, and about one that expired empty", () => {
    const soon = job({ id: "soon", deadline_at: at(5) });
    const dead = job({ id: "dead", deadline_at: at(-5) });
    const later = job({ id: "later", deadline_at: at(72) });
    const items = buildActionQueue({ ...base, myJobs: [soon, dead, later] });
    expect(items.map((i) => i.id)).toEqual(["closing-soon", "expired-dead"]);
    // Inside the last 12 hours the job page offers a one-tap extension.
    expect(items[0].href).toBe("/jobs/soon");
  });

  it("sends a quiet job with 12 to 24 hours left to the edit page, where the deadline can be moved", () => {
    const items = buildActionQueue({ ...base, myJobs: [job({ id: "mid", deadline_at: at(20) })] });
    expect(items[0]).toMatchObject({ id: "closing-mid", href: "/jobs/mid/edit" });
  });

  it("flags quotes that expire within three days, only while the job is open", () => {
    const expiring = quote({ id: "e", valid_until: day(2) });
    const fine = quote({ id: "f", valid_until: day(20) });
    const closed = quote({ id: "c", valid_until: day(1), job: { ...quote({ id: "x" }).job!, status: "awarded" } });
    const items = buildActionQueue({ ...base, myQuotes: [expiring, fine, closed] });
    expect(items.map((i) => i.id)).toEqual(["expiring-e"]);
  });

  it("suggests open jobs closing within two days that I have not quoted, never my own", () => {
    const openJobs = [
      { id: "near", company_id: "other", deadline_at: at(10), mode: "FCL" as const, origin: sha, destination: syd },
      { id: "far", company_id: "other", deadline_at: at(200), mode: "FCL" as const, origin: sha, destination: syd },
      { id: "mine", company_id: "me", deadline_at: at(10), mode: "FCL" as const, origin: sha, destination: syd },
      { id: "done", company_id: "other", deadline_at: at(12), mode: "Air" as const, origin: sha, destination: mel },
    ];
    const myQuotes = [quote({ id: "d", job_id: "done" })];
    const items = buildActionQueue({ ...base, openJobs, myQuotes });
    expect(items.map((i) => i.id)).toEqual(["closing-open-near"]);
  });

  it("orders by urgency and caps the list", () => {
    const jobs = Array.from({ length: 12 }, (_, i) => job({ id: `j${i}`, deadline_at: at(3) }));
    const items = buildActionQueue({ ...base, myJobs: jobs, limit: 5 });
    expect(items).toHaveLength(5);
    const won = quote({ id: "w", status: "won" });
    const mixed = buildActionQueue({ ...base, myJobs: [job({ id: "z", deadline_at: at(3) })], myQuotes: [won] });
    expect(mixed.map((i) => i.tone)).toEqual(["warning", "success"]);
  });

  it("gives every item a side and splits them between Requester and Quoter", () => {
    const waiting = job({ id: "a", quotes: [{ id: "q1", status: "sent", created_at: at(-2), lines: lines(1) }] });
    const soon = job({ id: "soon", deadline_at: at(5) });
    const openJobs = [{ id: "near", company_id: "other", deadline_at: at(10), mode: "FCL" as const, origin: sha, destination: syd }];
    const myQuotes = [quote({ id: "w", status: "won" }), quote({ id: "e", valid_until: day(2) })];
    const items = buildActionQueue({ ...base, myJobs: [waiting, soon], myQuotes, openJobs, limit: 20 });
    expect(items.every((i) => i.side === "requester" || i.side === "quoter")).toBe(true);
    expect(actionsFor(items, "requester").map((i) => i.id)).toEqual(["closing-soon", "award-a"]);
    expect(actionsFor(items, "quoter").map((i) => i.id)).toEqual(["expiring-e", "won-w", "closing-open-near"]);
    expect(actionsFor(items, "quoter", 1)).toHaveLength(1);
  });

  it("is empty when there is nothing to do", () => {
    expect(buildActionQueue(base)).toEqual([]);
  });
});

describe("marketplaceKpis", () => {
  const stats: MarketplaceStats = {
    days: 30,
    jobs: {
      posted: 10,
      awarded: 2,
      cancelled: 1,
      open_now: 4,
      awaiting_award: 3,
      expired_no_quotes: 2,
      with_quotes: 8,
      avg_quotes_per_job: 2.5,
      median_hours_to_first_quote: 6,
    },
    quotes_sent: 25,
    companies: { total: 20, verified: 5, basic: 14, suspended: 1, agents: 8, forwarders: 12, new_in_window: 4 },
  };

  it("derives the headline rates", () => {
    const k = Object.fromEntries(marketplaceKpis(stats).map((x) => [x.label, x.value]));
    expect(k["Jobs that got a quote"]).toBe("80%");
    expect(k["Quoted jobs awarded"]).toBe("25%");
    expect(k["Quotes per job"]).toBe("2.5");
    expect(k["Time to first quote"]).toBe("6 h");
    expect(k["Verified companies"]).toBe("25%");
  });

  it("shows None yet on an empty marketplace", () => {
    const empty = {
      ...stats,
      jobs: { ...stats.jobs, posted: 0, awarded: 0, with_quotes: 0, awaiting_award: 0, median_hours_to_first_quote: null },
      companies: { ...stats.companies, total: 0, verified: 0 },
    };
    expect(marketplaceKpis(empty).every((x) => x.value === "None yet" || x.value === "No data yet")).toBe(true);
  });
});

describe("buildQuoteScorecard", () => {
  it("counts outcomes, win rate by decided quotes, and value won per currency", () => {
    const quotes = [
      quote({ id: "1", status: "won", lines: lines(500_00, "AUD") }),
      quote({ id: "2", status: "won", lines: lines(250_00, "AUD") }),
      quote({ id: "3", status: "lost" }),
      quote({ id: "4", status: "withdrawn" }),
      quote({ id: "5" }), // open
      quote({ id: "6", job: { ...quote({ id: "x" }).job!, deadline_at: at(-2) } }), // awaiting award
    ];
    const s = buildQuoteScorecard(quotes, now);
    expect(s).toMatchObject({ sent: 6, won: 2, lost: 1, withdrawn: 1, open: 1, awaitingAward: 1, winRate: 67 });
    expect(s.wonValue).toEqual([{ currency: "AUD", minor: 750_00 }]);
    expect(s.medianHoursToQuote).toBe(4);
  });

  it("breaks win rate down by mode and ignores quotes outside the window", () => {
    const air = { ...quote({ id: "x" }).job!, mode: "Air" as const };
    const quotes = [
      quote({ id: "1", status: "won", job: air }),
      quote({ id: "2", status: "lost", job: air }),
      quote({ id: "3", status: "lost" }),
      quote({ id: "old", status: "won", created_at: at(-24 * 200) }),
    ];
    const s = buildQuoteScorecard(quotes, now);
    expect(s.sent).toBe(3);
    expect(s.byMode).toEqual([
      { mode: "FCL", sent: 1, won: 0, lost: 1, winRate: 0 },
      { mode: "Air", sent: 2, won: 1, lost: 1, winRate: 50 },
    ]);
  });

  it("returns no win rate before anything is decided", () => {
    expect(buildQuoteScorecard([quote({ id: "1" })], now).winRate).toBeNull();
    expect(buildQuoteScorecard([], now).sent).toBe(0);
  });
});

describe("buildJobScorecard", () => {
  const q = (id: string, minor: number, status = "sent", hoursAgo = 10, currency = "USD") => ({
    id,
    status,
    created_at: at(-hoursAgo),
    lines: lines(minor, currency),
  });

  it("summarises the pipeline and quote competition", () => {
    const jobs = [
      job({ id: "a", status: "awarded", deadline_at: at(-5), quotes: [q("1", 100, "won"), q("2", 150, "lost"), q("3", 200, "lost")] }),
      job({ id: "b", deadline_at: at(-5), quotes: [] }), // expired with no quotes
      job({ id: "c", quotes: [q("4", 90)] }), // open
      job({ id: "d", status: "cancelled" }),
    ];
    const s = buildJobScorecard(jobs, now);
    expect(s).toMatchObject({ posted: 4, open: 1, awarded: 1, cancelled: 1, expired: 1, awardRate: 50 });
    expect(s.avgQuotesPerJob).toBe(1.3);
    expect(s.noQuoteRate).toBe(50);
    expect(s.medianHoursToFirstQuote).toBe(14);
    expect(s.avgPriceSpreadPct).toBe(50);
    expect(s.spreadJobs).toBe(1);
    expect(s).toMatchObject({ lowestPicked: 1, awardsCompared: 1 });
  });

  it("does not compare quotes in different currencies", () => {
    const jobs = [job({ id: "a", status: "awarded", quotes: [q("1", 100, "won", 10, "USD"), q("2", 5, "lost", 10, "AUD")] })];
    const s = buildJobScorecard(jobs, now);
    expect(s.avgPriceSpreadPct).toBeNull();
    expect(s.awardsCompared).toBe(0);
  });

  it("notices when the requester did not pick the cheapest quote", () => {
    const jobs = [job({ id: "a", status: "awarded", quotes: [q("1", 100, "lost"), q("2", 180, "won")] })];
    const s = buildJobScorecard(jobs, now);
    expect(s).toMatchObject({ lowestPicked: 0, awardsCompared: 1 });
  });

  it("is safe with no jobs", () => {
    const s = buildJobScorecard([], now);
    expect(s).toMatchObject({ posted: 0, awardRate: null, avgQuotesPerJob: null, noQuoteRate: null, medianHoursToFirstQuote: null });
  });
});

describe("buildLaneDemand", () => {
  const board = (id: string, over: Partial<BoardJob> = {}): BoardJob => ({
    id,
    company_id: "c",
    status: "open",
    deadline_at: at(48),
    created_at: at(-24 * 3),
    mode: "FCL",
    origin: sha,
    destination: syd,
    flag_dg: false,
    flag_reefer: false,
    flag_bmsb: false,
    ...over,
  });

  it("ranks lanes by volume with trend against the previous period", () => {
    const jobs = [
      board("1"),
      board("2", { mode: "LCL" }),
      board("3", { created_at: at(-24 * 40) }), // previous period, same lane
      board("4", { destination: mel, flag_dg: true }),
      board("5", { status: "cancelled" }),
      board("6", { created_at: at(-24 * 100) }), // out of both windows
    ];
    const d = buildLaneDemand(jobs, now);
    expect(d.total).toBe(3);
    expect(d.previousTotal).toBe(1);
    expect(d.lanes[0]).toMatchObject({ key: "CNSHA-AUSYD", jobs: 2, previous: 1, openNow: 2 });
    expect(d.lanes[0].modes).toContain("LCL");
    expect(d.lanes[1]).toMatchObject({ key: "CNSHA-AUMEL", jobs: 1 });
    expect(d.modeMix).toEqual([
      { mode: "FCL", count: 2, pct: 67 },
      { mode: "LCL", count: 1, pct: 33 },
    ]);
    expect(d.flags.dg).toBe(1);
  });

  it("limits to the top lanes and handles an empty board", () => {
    expect(buildLaneDemand([], now)).toMatchObject({ total: 0, lanes: [], modeMix: [] });
    const many = Array.from({ length: 9 }, (_, i) => board(`j${i}`, { destination: { code: `X${i}`, name: `Port ${i}` } }));
    expect(buildLaneDemand(many, now, 30, 5).lanes).toHaveLength(5);
  });
});
