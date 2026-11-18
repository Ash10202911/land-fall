import { describe, expect, it, beforeAll } from "vitest";
import { anonClient, makeJob, makeUser, mustSubmitQuote, type TestUser } from "./helpers";

// SEC-2: Profile email and phone are readable only by the same company, by admins, and by the
// other party after award (poster and winner), via the contact function.
describe("SEC-2 contact details", () => {
  let poster: TestUser, winner: TestUser, loser: TestUser, outsider: TestUser, adminUser: TestUser;
  let jobId: string, quoteWin: string;

  beforeAll(async () => {
    poster = await makeUser({ role: "agent", trust: "verified" });
    winner = await makeUser();
    loser = await makeUser();
    outsider = await makeUser();
    adminUser = await makeUser({ isAdmin: true });
    jobId = await makeJob(poster);
    quoteWin = await mustSubmitQuote(winner, jobId);
    await mustSubmitQuote(loser, jobId);
  });

  it("returns no contacts before the job is awarded", async () => {
    for (const u of [poster, winner, loser, outsider]) {
      const { data, error } = await u.client.rpc("get_award_contacts", { p_job_id: jobId });
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    }
  });

  it("hides another company's profile (email and phone) before and after award", async () => {
    const before = await winner.client.from("profiles").select("email, phone").eq("id", poster.id);
    expect(before.data).toEqual([]);

    await poster.client.rpc("award_quote", { p_quote_id: quoteWin });

    // Even after award, the table itself stays private. Contacts come only from the function.
    const afterWinner = await winner.client.from("profiles").select("email, phone").eq("id", poster.id);
    expect(afterWinner.data).toEqual([]);
    const afterPoster = await poster.client.from("profiles").select("email, phone").eq("id", winner.id);
    expect(afterPoster.data).toEqual([]);
  });

  it("gives the poster and the winner each other's contact details after award", async () => {
    const forPoster = await poster.client.rpc("get_award_contacts", { p_job_id: jobId });
    expect(forPoster.error).toBeNull();
    const posterRows = forPoster.data as { party: string; email: string; phone: string }[];
    expect(posterRows.map((r) => r.party).sort()).toEqual(["poster", "winner"]);
    expect(posterRows.find((r) => r.party === "winner")?.email).toBe(winner.email);
    expect(posterRows.find((r) => r.party === "winner")?.phone).toBe("+61 400 000 000");

    const forWinner = await winner.client.rpc("get_award_contacts", { p_job_id: jobId });
    const winnerRows = forWinner.data as { party: string; email: string }[];
    expect(winnerRows.find((r) => r.party === "poster")?.email).toBe(poster.email);
  });

  it("gives nothing to the losing quoter, an outsider, an admin or an anonymous caller", async () => {
    for (const u of [loser, outsider, adminUser]) {
      const { data, error } = await u.client.rpc("get_award_contacts", { p_job_id: jobId });
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    }
    const anon = await anonClient().rpc("get_award_contacts", { p_job_id: jobId });
    expect(anon.error).not.toBeNull();
  });

  it("lets a user read their own profile, and admins read any profile to do their work", async () => {
    const own = await outsider.client.from("profiles").select("email").eq("id", outsider.id);
    expect(own.data).toEqual([{ email: outsider.email }]);
    const asAdmin = await adminUser.client.from("profiles").select("email").eq("id", poster.id);
    expect(asAdmin.data).toEqual([{ email: poster.email }]);
  });

  it("lets colleagues in the same company read each other's profiles", async () => {
    const colleague = await makeUser({ companyId: poster.companyId });
    const { data } = await colleague.client.from("profiles").select("email").eq("id", poster.id);
    expect(data).toEqual([{ email: poster.email }]);
  });

  it("does not leak any other profile when listing the table", async () => {
    const { data } = await outsider.client.from("profiles").select("id");
    expect((data ?? []).map((p) => p.id)).toEqual([outsider.id]);
  });
});
