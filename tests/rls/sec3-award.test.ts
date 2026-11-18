import { describe, expect, it, beforeAll } from "vitest";
import { admin, anonClient, expireJob, makeJob, makeUser, mustSubmitQuote, type TestUser } from "./helpers";

// SEC-3: Only Verified, active companies can award, and only on their own open jobs.
describe("SEC-3 award rules", () => {
  let verifiedPoster: TestUser, basicPoster: TestUser, quoterA: TestUser, quoterB: TestUser;

  beforeAll(async () => {
    verifiedPoster = await makeUser({ role: "agent", trust: "verified" });
    basicPoster = await makeUser({ role: "agent", trust: "basic" });
    quoterA = await makeUser();
    quoterB = await makeUser();
  });

  it("lets a Verified poster award: job awarded, winner won, the rest lost", async () => {
    const jobId = await makeJob(verifiedPoster);
    const winning = await mustSubmitQuote(quoterA, jobId);
    const losing = await mustSubmitQuote(quoterB, jobId);

    const { error } = await verifiedPoster.client.rpc("award_quote", { p_quote_id: winning });
    expect(error).toBeNull();

    const job = await admin.from("jobs").select("status, awarded_quote_id").eq("id", jobId).single();
    expect(job.data).toEqual({ status: "awarded", awarded_quote_id: winning });
    const quotes = await admin.from("quotes").select("id, status").eq("job_id", jobId);
    const byId = Object.fromEntries((quotes.data ?? []).map((q) => [q.id, q.status]));
    expect(byId[winning]).toBe("won");
    expect(byId[losing]).toBe("lost");
  });

  it("does not mark a withdrawn quote as lost", async () => {
    const jobId = await makeJob(verifiedPoster);
    const winning = await mustSubmitQuote(quoterA, jobId);
    const withdrawn = await mustSubmitQuote(quoterB, jobId);
    await quoterB.client.rpc("withdraw_quote", { p_quote_id: withdrawn });
    await verifiedPoster.client.rpc("award_quote", { p_quote_id: winning });
    const q = await admin.from("quotes").select("status").eq("id", withdrawn).single();
    expect(q.data?.status).toBe("withdrawn");
  });

  it("blocks a Basic (unverified) poster from awarding through the function", async () => {
    const jobId = await makeJob(basicPoster);
    const quoteId = await mustSubmitQuote(quoterA, jobId);
    const { error } = await basicPoster.client.rpc("award_quote", { p_quote_id: quoteId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/verified/i);
    const job = await admin.from("jobs").select("status, awarded_quote_id").eq("id", jobId).single();
    expect(job.data).toEqual({ status: "open", awarded_quote_id: null });
  });

  it("blocks a Basic poster from awarding by writing to the tables directly", async () => {
    const jobId = await makeJob(basicPoster);
    const quoteId = await mustSubmitQuote(quoterA, jobId);

    const jobUpdate = await basicPoster.client
      .from("jobs")
      .update({ status: "awarded", awarded_quote_id: quoteId })
      .eq("id", jobId)
      .select();
    expect(jobUpdate.data ?? []).toEqual([]);

    const quoteUpdate = await basicPoster.client.from("quotes").update({ status: "won" }).eq("id", quoteId).select();
    expect(quoteUpdate.data ?? []).toEqual([]);

    const job = await admin.from("jobs").select("status").eq("id", jobId).single();
    const quote = await admin.from("quotes").select("status").eq("id", quoteId).single();
    expect(job.data?.status).toBe("open");
    expect(quote.data?.status).toBe("sent");
  });

  it("blocks even a Verified poster from awarding by direct table writes", async () => {
    const jobId = await makeJob(verifiedPoster);
    const quoteId = await mustSubmitQuote(quoterA, jobId);
    const res = await verifiedPoster.client.from("jobs").update({ status: "awarded" }).eq("id", jobId).select();
    expect(res.data ?? []).toEqual([]);
    const job = await admin.from("jobs").select("status").eq("id", jobId).single();
    expect(job.data?.status).toBe("open");
    expect(quoteId).toBeTruthy();
  });

  it("blocks a company that does not own the job, even if Verified", async () => {
    const jobId = await makeJob(verifiedPoster);
    const quoteId = await mustSubmitQuote(quoterA, jobId);
    const otherVerified = await makeUser({ trust: "verified" });
    expect((await otherVerified.client.rpc("award_quote", { p_quote_id: quoteId })).error).not.toBeNull();
    expect((await quoterA.client.rpc("award_quote", { p_quote_id: quoteId })).error).not.toBeNull();
  });

  it("blocks a suspended company even if Verified", async () => {
    const jobId = await makeJob(verifiedPoster);
    const quoteId = await mustSubmitQuote(quoterA, jobId);
    await admin.from("companies").update({ status: "suspended" }).eq("id", verifiedPoster.companyId);
    try {
      const { error } = await verifiedPoster.client.rpc("award_quote", { p_quote_id: quoteId });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/suspended/i);
    } finally {
      await admin.from("companies").update({ status: "active" }).eq("id", verifiedPoster.companyId);
    }
  });

  it("cannot award twice, or award a withdrawn quote", async () => {
    const jobId = await makeJob(verifiedPoster);
    const first = await mustSubmitQuote(quoterA, jobId);
    const second = await mustSubmitQuote(quoterB, jobId);
    expect((await verifiedPoster.client.rpc("award_quote", { p_quote_id: first })).error).toBeNull();
    expect((await verifiedPoster.client.rpc("award_quote", { p_quote_id: second })).error).not.toBeNull();

    const jobId2 = await makeJob(verifiedPoster);
    const withdrawn = await mustSubmitQuote(quoterA, jobId2);
    await quoterA.client.rpc("withdraw_quote", { p_quote_id: withdrawn });
    expect((await verifiedPoster.client.rpc("award_quote", { p_quote_id: withdrawn })).error).not.toBeNull();
  });

  it("lets a Verified poster award after the deadline passed (the poster decides when)", async () => {
    const jobId = await makeJob(verifiedPoster);
    const quoteId = await mustSubmitQuote(quoterA, jobId);
    await expireJob(jobId);
    expect((await verifiedPoster.client.rpc("award_quote", { p_quote_id: quoteId })).error).toBeNull();
  });

  it("blocks anonymous callers", async () => {
    const jobId = await makeJob(verifiedPoster);
    const quoteId = await mustSubmitQuote(quoterA, jobId);
    const { error } = await anonClient().rpc("award_quote", { p_quote_id: quoteId });
    expect(error).not.toBeNull();
  });
});
