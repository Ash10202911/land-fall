import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, makeJob, makeUser, mustSubmitQuote, type TestUser } from "./helpers";

describe("admin dashboard functions", () => {
  let adminUser: TestUser, basicPoster: TestUser, verifiedPoster: TestUser, quoter: TestUser, plain: TestUser;
  let basicJobId: string;

  beforeAll(async () => {
    adminUser = await makeUser({ isAdmin: true, role: "agent", trust: "verified" });
    basicPoster = await makeUser({ role: "agent", trust: "basic", name: "Queue Basic Poster" });
    verifiedPoster = await makeUser({ role: "agent", trust: "verified", name: "Queue Verified Poster" });
    quoter = await makeUser();
    plain = await makeUser();
    basicJobId = await makeJob(basicPoster);
    await mustSubmitQuote(quoter, basicJobId);
    await mustSubmitQuote(quoter, await makeJob(verifiedPoster));
  });

  it("refuses non-admins and signed-out callers", async () => {
    for (const c of [plain.client, quoter.client, anonClient()]) {
      expect((await c.rpc("admin_marketplace_stats", { p_days: 30 })).error).not.toBeNull();
      expect((await c.rpc("admin_verification_queue")).error).not.toBeNull();
    }
  });

  it("returns marketplace counts to an admin, with no money or contact fields", async () => {
    const { data, error } = await adminUser.client.rpc("admin_marketplace_stats", { p_days: 30 });
    expect(error).toBeNull();
    expect(data.jobs.posted).toBeGreaterThanOrEqual(2);
    expect(data.jobs.with_quotes).toBeGreaterThanOrEqual(2);
    expect(data.quotes_sent).toBeGreaterThanOrEqual(2);
    expect(data.companies.total).toBeGreaterThanOrEqual(5);
    const text = JSON.stringify(data).toLowerCase();
    for (const forbidden of ["amount", "currency", "email", "phone", "notes"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("clamps the reporting window", async () => {
    const { data, error } = await adminUser.client.rpc("admin_marketplace_stats", { p_days: 100000 });
    expect(error).toBeNull();
    expect(data.days).toBe(365);
  });

  it("lists Basic companies with quotes waiting, but not Verified ones", async () => {
    const { data, error } = await adminUser.client.rpc("admin_verification_queue");
    expect(error).toBeNull();
    const names = (data as { company_name: string }[]).map((r) => r.company_name);
    expect(names).toContain("Queue Basic Poster");
    expect(names).not.toContain("Queue Verified Poster");
    const row = (data as { company_name: string; waiting_quotes: number; awaiting_jobs: number }[]).find(
      (r) => r.company_name === "Queue Basic Poster",
    );
    expect(row).toMatchObject({ waiting_quotes: 1, awaiting_jobs: 1 });
    expect(Object.keys(row ?? {}).sort()).toEqual(
      ["awaiting_jobs", "company_country", "company_id", "company_name", "company_role", "joined_at", "waiting_quotes"].sort(),
    );
  });
});

describe("dashboard queries cannot reveal other companies' quotes", () => {
  it("returns only my own quote when I read a job's embedded quotes", async () => {
    const poster = await makeUser({ role: "agent", trust: "verified" });
    const a = await makeUser();
    const b = await makeUser();
    const jobId = await makeJob(poster);
    await mustSubmitQuote(a, jobId);
    const mine = await mustSubmitQuote(b, jobId);

    // The same embed shape the dashboard uses for "my jobs".
    const { data, error } = await b.client
      .from("jobs")
      .select("id, quotes:quotes!job_id(id, lines:quote_lines(amount_minor, currency))")
      .eq("id", jobId)
      .single();
    expect(error).toBeNull();
    const quotes = (data?.quotes ?? []) as { id: string }[];
    expect(quotes.map((q) => q.id)).toEqual([mine]);
  });

  it("shows a quoter only their own quotes in the 'my quotes' query", async () => {
    const poster = await makeUser({ role: "agent", trust: "verified" });
    const a = await makeUser();
    const b = await makeUser();
    const jobId = await makeJob(poster);
    await mustSubmitQuote(a, jobId);
    await mustSubmitQuote(b, jobId);
    const { data } = await a.client.from("quotes").select("id, company_id").eq("job_id", jobId);
    expect((data ?? []).every((q) => q.company_id === a.companyId)).toBe(true);
    expect(data).toHaveLength(1);
  });
});
