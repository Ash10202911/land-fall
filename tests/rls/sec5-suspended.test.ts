import { describe, expect, it, beforeAll } from "vitest";
import { admin, dateInDays, inDays, line, makeJob, makeUser, mustSubmitQuote, submitQuote, twoPorts, type TestUser } from "./helpers";

// SEC-5: Suspended companies cannot insert or update jobs or quotes.
describe("SEC-5 suspended companies", () => {
  let verifiedPoster: TestUser, suspendedPoster: TestUser, suspendedQuoter: TestUser, activePoster: TestUser;

  beforeAll(async () => {
    verifiedPoster = await makeUser({ role: "agent", trust: "verified" });
    activePoster = await makeUser({ role: "agent" });
    suspendedPoster = await makeUser({ role: "agent", trust: "verified", status: "suspended" });
    suspendedQuoter = await makeUser({ status: "suspended" });
  });

  const jobPayload = async (u: TestUser) => {
    const [origin, destination] = await twoPorts();
    return {
      company_id: u.companyId,
      created_by: u.id,
      direction: "import",
      incoterm: "FOB",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 1,
      cargo_description: "Suspended test",
      ready_date: dateInDays(10),
      services: [],
      deadline_at: inDays(3),
    };
  };

  it("lets an active company post a job (control)", async () => {
    const { error } = await activePoster.client.from("jobs").insert(await jobPayload(activePoster));
    expect(error).toBeNull();
  });

  it("blocks a suspended company from posting a job", async () => {
    const { error } = await suspendedPoster.client.from("jobs").insert(await jobPayload(suspendedPoster));
    expect(error).not.toBeNull();
    const { data } = await admin.from("jobs").select("id").eq("company_id", suspendedPoster.companyId);
    expect(data).toEqual([]);
  });

  it("blocks a suspended company from sending a quote", async () => {
    const jobId = await makeJob(verifiedPoster);
    const { error } = await submitQuote(suspendedQuoter, jobId);
    expect(error).not.toBeNull();
    const { data } = await admin.from("quotes").select("id").eq("job_id", jobId);
    expect(data).toEqual([]);
  });

  it("blocks a company suspended after quoting from editing or withdrawing", async () => {
    const jobId = await makeJob(verifiedPoster);
    const quoter = await makeUser();
    const quoteId = await mustSubmitQuote(quoter, jobId, [line("Original", 1000)]);
    await admin.from("companies").update({ status: "suspended" }).eq("id", quoter.companyId);

    const edit = await quoter.client.rpc("update_quote", {
      p_quote_id: quoteId,
      p_valid_until: dateInDays(20),
      p_notes: null,
      p_lines: [line("Changed", 2)],
    });
    expect(edit.error).not.toBeNull();
    expect((await quoter.client.rpc("withdraw_quote", { p_quote_id: quoteId })).error).not.toBeNull();

    const lines = await admin.from("quote_lines").select("charge_name").eq("quote_id", quoteId);
    expect(lines.data).toEqual([{ charge_name: "Original" }]);

    // unsuspending restores access
    await admin.from("companies").update({ status: "active" }).eq("id", quoter.companyId);
    expect((await quoter.client.rpc("withdraw_quote", { p_quote_id: quoteId })).error).toBeNull();
  });

  it("blocks a suspended company from awarding", async () => {
    const jobId = await makeJob(suspendedPoster);
    const quoter = await makeUser();
    const quoteId = await mustSubmitQuote(quoter, jobId);
    const { error } = await suspendedPoster.client.rpc("award_quote", { p_quote_id: quoteId });
    expect(error).not.toBeNull();
  });
});
