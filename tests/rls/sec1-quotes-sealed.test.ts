import { describe, expect, it, beforeAll } from "vitest";
import { admin, anonClient, line, makeJob, makeUser, mustSubmitQuote, type TestUser } from "./helpers";

// SEC-1: Only the job poster's company can read quotes and quote lines on its job.
// A quoter reads only its own.
describe("SEC-1 sealed quotes", () => {
  let poster: TestUser, quoterA: TestUser, quoterB: TestUser, outsider: TestUser;
  let jobId: string, quoteA: string, quoteB: string;

  beforeAll(async () => {
    poster = await makeUser({ role: "agent" });
    quoterA = await makeUser();
    quoterB = await makeUser();
    outsider = await makeUser();
    jobId = await makeJob(poster);
    quoteA = await mustSubmitQuote(quoterA, jobId, [line("Handling A", 11100), line("Delivery A", 22200)]);
    quoteB = await mustSubmitQuote(quoterB, jobId, [line("Handling B", 33300)]);
  });

  it("lets the poster read every quote and its lines", async () => {
    const { data: quotes, error } = await poster.client.from("quotes").select("id").eq("job_id", jobId);
    expect(error).toBeNull();
    expect(quotes?.map((q) => q.id).sort()).toEqual([quoteA, quoteB].sort());

    const { data: lines } = await poster.client.from("quote_lines").select("charge_name").in("quote_id", [quoteA, quoteB]);
    expect(lines).toHaveLength(3);
  });

  it("lets a quoter read only its own quote", async () => {
    const { data } = await quoterA.client.from("quotes").select("id").eq("job_id", jobId);
    expect(data?.map((q) => q.id)).toEqual([quoteA]);
  });

  it("hides one quoter's quote from another quoter, directly and by id", async () => {
    const byId = await quoterB.client.from("quotes").select("id").eq("id", quoteA);
    expect(byId.data).toEqual([]);
    const lines = await quoterB.client.from("quote_lines").select("id").eq("quote_id", quoteA);
    expect(lines.data).toEqual([]);
  });

  it("hides quotes from a company that is neither poster nor quoter", async () => {
    const quotes = await outsider.client.from("quotes").select("id").eq("job_id", jobId);
    expect(quotes.data).toEqual([]);
    const lines = await outsider.client.from("quote_lines").select("id").in("quote_id", [quoteA, quoteB]);
    expect(lines.data).toEqual([]);
  });

  it("hides quotes from anonymous visitors", async () => {
    const res = await anonClient().from("quotes").select("id").eq("job_id", jobId);
    expect(res.data ?? []).toEqual([]);
  });

  it("gives admins no special access to quote contents", async () => {
    const adminUser = await makeUser({ isAdmin: true });
    const res = await adminUser.client.from("quotes").select("id").eq("job_id", jobId);
    expect(res.data).toEqual([]);
  });

  it("does not show a withdrawn quote to the poster, but the quoter still sees it", async () => {
    const withdrawer = await makeUser();
    const quoteId = await mustSubmitQuote(withdrawer, jobId);
    const { error } = await withdrawer.client.rpc("withdraw_quote", { p_quote_id: quoteId });
    expect(error).toBeNull();

    const forPoster = await poster.client.from("quotes").select("id").eq("id", quoteId);
    expect(forPoster.data).toEqual([]);
    const forQuoter = await withdrawer.client.from("quotes").select("id, status").eq("id", quoteId);
    expect(forQuoter.data).toEqual([{ id: quoteId, status: "withdrawn" }]);
  });

  it("does not let a company read quotes by listing the table wholesale", async () => {
    const { data } = await quoterB.client.from("quotes").select("id");
    const ids = (data ?? []).map((q) => q.id);
    expect(ids).toContain(quoteB);
    expect(ids).not.toContain(quoteA);
    // service role sees both, proving the data exists and RLS is what hides it
    const all = await admin.from("quotes").select("id").in("id", [quoteA, quoteB]);
    expect(all.data).toHaveLength(2);
  });
});
