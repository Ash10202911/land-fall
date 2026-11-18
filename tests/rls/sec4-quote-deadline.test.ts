import { describe, expect, it, beforeAll } from "vitest";
import { admin, dateInDays, expireJob, line, makeJob, makeUser, mustSubmitQuote, submitQuote, type TestUser } from "./helpers";

// SEC-4: Quotes cannot be created or changed after the job deadline or once the job is awarded.
describe("SEC-4 quote deadline and award lock", () => {
  let poster: TestUser, quoter: TestUser;

  beforeAll(async () => {
    poster = await makeUser({ role: "agent", trust: "verified" });
    quoter = await makeUser();
  });

  it("allows a quote with several lines before the deadline", async () => {
    const jobId = await makeJob(poster);
    const quoteId = await mustSubmitQuote(quoter, jobId, [line("A", 1000), line("B", 2000, "USD")]);
    const { data } = await quoter.client.from("quote_lines").select("currency").eq("quote_id", quoteId);
    expect(data).toHaveLength(2);
  });

  it("allows editing and withdrawing before the deadline", async () => {
    const jobId = await makeJob(poster);
    const quoteId = await mustSubmitQuote(quoter, jobId);
    const edit = await quoter.client.rpc("update_quote", {
      p_quote_id: quoteId,
      p_valid_until: dateInDays(20),
      p_notes: "Updated",
      p_lines: [line("Only line", 5000)],
    });
    expect(edit.error).toBeNull();
    const { data } = await quoter.client.from("quote_lines").select("charge_name").eq("quote_id", quoteId);
    expect(data).toEqual([{ charge_name: "Only line" }]);

    const wd = await quoter.client.rpc("withdraw_quote", { p_quote_id: quoteId });
    expect(wd.error).toBeNull();
  });

  it("rejects creating a quote after the deadline", async () => {
    const jobId = await makeJob(poster);
    await expireJob(jobId);
    const { error } = await submitQuote(quoter, jobId);
    expect(error).not.toBeNull();
    const { data } = await admin.from("quotes").select("id").eq("job_id", jobId);
    expect(data).toEqual([]);
  });

  it("rejects editing, withdrawing and changing lines after the deadline", async () => {
    const jobId = await makeJob(poster);
    const quoteId = await mustSubmitQuote(quoter, jobId, [line("Original", 1000)]);
    await expireJob(jobId);

    const edit = await quoter.client.rpc("update_quote", {
      p_quote_id: quoteId,
      p_valid_until: dateInDays(20),
      p_notes: null,
      p_lines: [line("Sneaky", 1)],
    });
    expect(edit.error).not.toBeNull();

    const wd = await quoter.client.rpc("withdraw_quote", { p_quote_id: quoteId });
    expect(wd.error).not.toBeNull();

    const insertLine = await quoter.client
      .from("quote_lines")
      .insert({ quote_id: quoteId, charge_name: "Extra", amount_minor: 1, currency: "AUD", gst_included: false });
    expect(insertLine.error).not.toBeNull();

    const del = await quoter.client.from("quote_lines").delete().eq("quote_id", quoteId).select();
    expect(del.data ?? []).toEqual([]);

    const { data } = await admin.from("quote_lines").select("charge_name").eq("quote_id", quoteId);
    expect(data).toEqual([{ charge_name: "Original" }]);
    const q = await admin.from("quotes").select("status").eq("id", quoteId).single();
    expect(q.data?.status).toBe("sent");
  });

  it("rejects direct writes to quotes after the deadline", async () => {
    const jobId = await makeJob(poster);
    const quoteId = await mustSubmitQuote(quoter, jobId);
    await expireJob(jobId);
    const upd = await quoter.client.from("quotes").update({ notes: "late edit" }).eq("id", quoteId).select();
    expect(upd.data ?? []).toEqual([]);
    const direct = await quoter.client
      .from("quotes")
      .insert({ job_id: jobId, company_id: quoter.companyId, created_by: quoter.id, valid_until: dateInDays(5) });
    expect(direct.error).not.toBeNull();
  });

  it("rejects quotes and edits once the job is awarded", async () => {
    const jobId = await makeJob(poster);
    const winning = await mustSubmitQuote(quoter, jobId);
    const other = await makeUser();
    const losing = await mustSubmitQuote(other, jobId);
    const award = await poster.client.rpc("award_quote", { p_quote_id: winning });
    expect(award.error).toBeNull();

    const late = await makeUser();
    expect((await submitQuote(late, jobId)).error).not.toBeNull();

    const edit = await other.client.rpc("update_quote", {
      p_quote_id: losing,
      p_valid_until: dateInDays(20),
      p_notes: null,
      p_lines: [line("Late", 1)],
    });
    expect(edit.error).not.toBeNull();
    expect((await quoter.client.rpc("withdraw_quote", { p_quote_id: winning })).error).not.toBeNull();
  });

  it("does not let a company quote its own job", async () => {
    const own = await makeUser();
    const jobId = await makeJob(own);
    expect((await submitQuote(own, jobId)).error).not.toBeNull();
  });

  it("allows only one live quote per company per job", async () => {
    const jobId = await makeJob(poster);
    await mustSubmitQuote(quoter, jobId);
    expect((await submitQuote(quoter, jobId)).error).not.toBeNull();
  });

  it("rejects an empty or invalid quote", async () => {
    const jobId = await makeJob(poster);
    expect((await submitQuote(quoter, jobId, [])).error).not.toBeNull();
    expect((await submitQuote(quoter, jobId, [line("Zero", 0)])).error).not.toBeNull();
    expect((await submitQuote(quoter, jobId, [line("Bad currency", 100, "aud1")])).error).not.toBeNull();
  });
});
