import { describe, expect, it } from "vitest";
import {
  groupForDigest,
  laneMatches,
  planDigest,
  planInstantAlert,
  planRun,
  sydneyHour,
  toBrief,
  type AlertRow,
  type AlertWithRecipient,
  type JobForBrief,
  type MatchJob,
  type RunJob,
} from "./lane-alerts";

const alert = (over: Partial<AlertRow> = {}): AlertRow => ({
  id: "a1",
  company_id: "quoter",
  created_by: "u1",
  origin_port_id: null,
  origin_country: null,
  destination_port_id: 10,
  modes: [],
  destination_only: false,
  frequency: "instant",
  ...over,
});

const job: MatchJob = {
  company_id: "requester",
  mode: "FCL",
  incoterm: "CIF",
  services: ["destination_charges", "customs_clearance", "delivery"],
  origin_port_id: 5,
  origin_country: "China",
  destination_port_id: 10,
};

describe("laneMatches", () => {
  it("matches the destination and, by default, any origin and any mode", () => {
    expect(laneMatches(alert(), job)).toBe(true);
    expect(laneMatches(alert({ destination_port_id: 11 }), job)).toBe(false);
  });

  it("never matches an alert that is off, or a company's own job", () => {
    expect(laneMatches(alert({ frequency: "off" }), job)).toBe(false);
    expect(laneMatches(alert({ company_id: "requester" }), job)).toBe(false);
  });

  it("matches an origin port exactly, or a whole origin country ignoring case and spacing", () => {
    expect(laneMatches(alert({ origin_port_id: 5 }), job)).toBe(true);
    expect(laneMatches(alert({ origin_port_id: 6 }), job)).toBe(false);
    expect(laneMatches(alert({ origin_country: " china " }), job)).toBe(true);
    expect(laneMatches(alert({ origin_country: "India" }), job)).toBe(false);
  });

  it("matches modes when listed, any mode when the list is empty", () => {
    expect(laneMatches(alert({ modes: ["FCL", "LCL"] }), job)).toBe(true);
    expect(laneMatches(alert({ modes: ["Air"] }), job)).toBe(false);
  });

  it("with destination only, wants CIF-type jobs and not FOB or EXW", () => {
    expect(laneMatches(alert({ destination_only: true }), job)).toBe(true);
    expect(laneMatches(alert({ destination_only: true }), { ...job, incoterm: "FOB" })).toBe(false);
    expect(laneMatches(alert({ destination_only: true }), { ...job, incoterm: "EXW" })).toBe(false);
    expect(laneMatches(alert({ destination_only: false }), { ...job, incoterm: "FOB" })).toBe(true);
  });
});

const brief: JobForBrief = {
  id: "j1",
  mode: "FCL",
  incoterm: "CIF",
  services: ["destination_charges", "customs_clearance", "delivery"],
  container_type: "40HC",
  container_qty: 2,
  weight_kg: null,
  volume_cbm: null,
  deadline_at: "2026-11-25T09:00:00Z",
  delivery_suburb: "Wetherill Park NSW",
  delivery_postcode: "2164",
  unload_type: "side_loader",
  repeat_frequency: "monthly",
  repeat_volume: "about 4 × 40HC",
  origin_name: "Shenzhen",
  destination_name: "Sydney (Port Botany)",
};

describe("alert emails", () => {
  it("describes the job with public details only, and links to it", () => {
    const m = planInstantAlert({ baseUrl: "https://app.test/", to: "a@b.test", job: toBrief(brief) });
    expect(m.subject).toBe("New job on your lane: Shenzhen to Sydney");
    expect(m.text).toContain("Destination only · CIF · Sea, full container");
    expect(m.text).toContain("2 × 40HC · Monthly, about 4 × 40HC");
    expect(m.text).toContain("Deliver to Wetherill Park NSW 2164 (Side-loader)");
    expect(m.text).toContain("Quotes close 25/11/2026 09:00 UTC");
    expect(m.text).toContain("https://app.test/jobs/j1");
    // Public details only: no street address, no phone, no email address, no price.
    expect(m.text).not.toMatch(/street address|phone|@|\$/i);
  });

  it("adds the rate card total when one matches, and changes the call to action", () => {
    const m = planInstantAlert({ baseUrl: "https://app.test", to: "a@b.test", job: toBrief(brief), rateCard: { name: "Port Botany", total: "$1,950.00" } });
    expect(m.text).toContain('Your rate card "Port Botany" gives $1,950.00 for this job');
    expect(m.text).toContain("Review and send your quote: https://app.test/jobs/j1");
    const plain = planInstantAlert({ baseUrl: "https://app.test", to: "a@b.test", job: toBrief(brief) });
    expect(plain.text).toContain("View the job: https://app.test/jobs/j1");
    expect(plain.text).not.toMatch(/rate card/i);
  });

  it("leaves out delivery and regular-work lines when the job has none", () => {
    const m = planInstantAlert({
      baseUrl: "https://app.test",
      to: "a@b.test",
      job: toBrief({ ...brief, mode: "Air", container_type: null, container_qty: null, weight_kg: "380", volume_cbm: "2.1", delivery_suburb: null, unload_type: null, repeat_frequency: "one_off", repeat_volume: null }),
    });
    expect(m.text).toContain("380 kg · 2.1 cbm");
    expect(m.text).toContain("Air");
    expect(m.text).not.toContain("Deliver to");
    expect(m.text).not.toContain("One-off");
  });

  it("builds one digest with every job once, and a singular subject for one job", () => {
    const b2 = toBrief({ ...brief, id: "j2", origin_name: "Ningbo", destination_name: "Melbourne" });
    const d = planDigest({ baseUrl: "https://app.test", to: "a@b.test", jobs: [toBrief(brief), b2] });
    expect(d.subject).toBe("2 new jobs on your lanes");
    expect(d.text).toContain("Shenzhen to Sydney");
    expect(d.text).toContain("Ningbo to Melbourne");
    expect(d.text).toContain("https://app.test/jobs/j2");
    expect(planDigest({ baseUrl: "https://app.test", to: "a@b.test", jobs: [b2] }).subject).toBe("1 new job on your lanes");
  });
});

describe("sydneyHour", () => {
  it("is 7am at 20:00 UTC in summer and 21:00 UTC in winter, so two cron times cover daylight saving", () => {
    expect(sydneyHour(new Date("2026-11-23T20:00:00Z"))).toBe(7);
    expect(sydneyHour(new Date("2026-11-23T21:00:00Z"))).toBe(8);
    expect(sydneyHour(new Date("2026-06-23T21:00:00Z"))).toBe(7);
    expect(sydneyHour(new Date("2026-06-23T20:00:00Z"))).toBe(6);
  });
});

describe("planRun", () => {
  const rj = (over: Partial<RunJob> & { id: string }): RunJob => ({ ...job, ...brief, ...over });
  const a = (over: Partial<AlertWithRecipient> & { id: string }): AlertWithRecipient => ({ ...alert(), recipient: "x@t.test", ...over });

  it("emails each matching alert once per job, grouped by person", () => {
    const runs = planRun({
      alerts: [a({ id: "a1" }), a({ id: "a2", origin_country: "China" }), a({ id: "a3", recipient: "y@t.test" })],
      jobs: [rj({ id: "j1" })],
      delivered: new Set(),
      frequency: "instant",
    });
    expect(runs.map((r) => r.to)).toEqual(["x@t.test", "y@t.test"]);
    expect(runs[0].jobs.map((j) => j.id)).toEqual(["j1"]);
    expect(runs[0].pairs).toEqual([{ alertId: "a1", jobId: "j1" }, { alertId: "a2", jobId: "j1" }]);
    expect(runs[0].companyId).toBe("quoter");
  });

  it("skips what was already delivered, so a retry or a second run sends nothing twice", () => {
    const base = { alerts: [a({ id: "a1" })], jobs: [rj({ id: "j1" }), rj({ id: "j2" })], frequency: "instant" as const };
    expect(planRun({ ...base, delivered: new Set(["a1:j1"]) })[0].jobs.map((j) => j.id)).toEqual(["j2"]);
    expect(planRun({ ...base, delivered: new Set(["a1:j1", "a1:j2"]) })).toEqual([]);
  });

  it("only uses alerts of the requested frequency, never off alerts, and ignores non-matching jobs", () => {
    const alerts = [a({ id: "inst" }), a({ id: "day", frequency: "daily" }), a({ id: "off", frequency: "off" })];
    expect(planRun({ alerts, jobs: [rj({ id: "j1" })], delivered: new Set(), frequency: "daily" })[0].pairs).toEqual([{ alertId: "day", jobId: "j1" }]);
    expect(planRun({ alerts, jobs: [rj({ id: "j1" })], delivered: new Set(), frequency: "instant" })[0].pairs).toEqual([{ alertId: "inst", jobId: "j1" }]);
    expect(planRun({ alerts, jobs: [rj({ id: "j1", destination_port_id: 99 })], delivered: new Set(), frequency: "instant" })).toEqual([]);
  });

  it("never emails a company about its own job, or an alert with no recipient", () => {
    expect(planRun({ alerts: [a({ id: "a1", company_id: "requester" })], jobs: [rj({ id: "j1" })], delivered: new Set(), frequency: "instant" })).toEqual([]);
    expect(planRun({ alerts: [a({ id: "a1", recipient: "" })], jobs: [rj({ id: "j1" })], delivered: new Set(), frequency: "instant" })).toEqual([]);
  });

  it("builds a digest with several jobs for one person", () => {
    const runs = planRun({ alerts: [a({ id: "d1", frequency: "daily" })], jobs: [rj({ id: "j1" }), rj({ id: "j2" })], delivered: new Set(), frequency: "daily" });
    expect(runs).toHaveLength(1);
    expect(runs[0].jobs.map((j) => j.id)).toEqual(["j1", "j2"]);
  });
});

describe("groupForDigest", () => {
  it("gives each person one group, with each job listed once even if two alerts matched", () => {
    const g = groupForDigest([
      { alertId: "a1", recipient: "x@t.test", jobId: "j1" },
      { alertId: "a2", recipient: "x@t.test", jobId: "j1" },
      { alertId: "a2", recipient: "x@t.test", jobId: "j2" },
      { alertId: "a3", recipient: "y@t.test", jobId: "j1" },
    ]);
    expect([...g.keys()]).toEqual(["x@t.test", "y@t.test"]);
    expect(g.get("x@t.test")?.jobIds).toEqual(["j1", "j2"]);
    expect(g.get("x@t.test")?.pairs).toHaveLength(3);
    expect(g.get("y@t.test")?.jobIds).toEqual(["j1"]);
  });
});
