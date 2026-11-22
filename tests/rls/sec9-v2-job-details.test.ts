import { beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  dateInDays,
  inDays,
  makeJob,
  makeUser,
  mustSubmitQuote,
  twoPorts,
  type TestUser,
} from "./helpers";

const DELIVERY = {
  services: ["destination_charges", "delivery"],
  delivery_suburb: "Wetherill Park NSW",
  delivery_postcode: "2164",
  unload_type: "side_loader",
};

async function insertAs(user: TestUser, extra: Record<string, unknown>) {
  const [origin, destination] = await twoPorts();
  return user.client
    .from("jobs")
    .insert({
      company_id: user.companyId,
      created_by: user.id,
      direction: "import",
      incoterm: "CIF",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 2,
      cargo_description: "Furniture",
      ready_date: dateInDays(10),
      deadline_at: inDays(2),
      ...extra,
    })
    .select("id")
    .single();
}

describe("v2 job fields", () => {
  let poster: TestUser;
  beforeAll(async () => {
    poster = await makeUser({ role: "agent", trust: "verified" });
  });

  it("requires a suburb, postcode and unload type when delivery is requested", async () => {
    const missing = await insertAs(poster, { services: ["delivery"] });
    expect(missing.error).not.toBeNull();
    const ok = await insertAs(poster, DELIVERY);
    expect(ok.error).toBeNull();
  });

  it("rejects a postcode that is not four digits and an unknown unload type", async () => {
    expect((await insertAs(poster, { ...DELIVERY, delivery_postcode: "21640" })).error).not.toBeNull();
    expect((await insertAs(poster, { ...DELIVERY, unload_type: "crane" })).error).not.toBeNull();
  });

  it("rejects a needed-by date before the ready date", async () => {
    const bad = await insertAs(poster, { required_by: dateInDays(5) });
    expect(bad.error).not.toBeNull();
    const ok = await insertAs(poster, { required_by: dateInDays(30), repeat_frequency: "monthly", repeat_volume: "4 x 40HC" });
    expect(ok.error).toBeNull();
  });
});

describe("delivery street address is released only at award", () => {
  let verified: TestUser, basic: TestUser, winner: TestUser, loser: TestUser, stranger: TestUser;
  beforeAll(async () => {
    verified = await makeUser({ role: "agent", trust: "verified" });
    basic = await makeUser({ role: "agent", trust: "basic" });
    winner = await makeUser();
    loser = await makeUser();
    stranger = await makeUser();
  });

  it("blocks direct writes to the address table", async () => {
    const jobId = await makeJob(verified, DELIVERY);
    const { error } = await verified.client.from("job_delivery_addresses").insert({ job_id: jobId, street: "1 Test St" });
    expect(error).not.toBeNull();
  });

  it("needs a street address when the job asks for delivery, and rolls the award back without one", async () => {
    const jobId = await makeJob(verified, DELIVERY);
    const quoteId = await mustSubmitQuote(winner, jobId);
    const { error } = await verified.client.rpc("award_quote_with_address", { p_quote_id: quoteId, p_street: "  " });
    expect(error?.message).toMatch(/street address/i);
    const job = await admin.from("jobs").select("status").eq("id", jobId).single();
    expect(job.data?.status).toBe("open");
  });

  it("keeps every award rule: a Basic requester cannot award and no address is stored", async () => {
    const jobId = await makeJob(basic, DELIVERY);
    const quoteId = await mustSubmitQuote(winner, jobId);
    const { error } = await basic.client.rpc("award_quote_with_address", { p_quote_id: quoteId, p_street: "1 Test St" });
    expect(error?.message).toMatch(/verified/i);
    const rows = await admin.from("job_delivery_addresses").select("job_id").eq("job_id", jobId);
    expect(rows.data).toEqual([]);
  });

  it("does not let a quoter award their own quote", async () => {
    const jobId = await makeJob(verified, DELIVERY);
    const quoteId = await mustSubmitQuote(winner, jobId);
    const { error } = await winner.client.rpc("award_quote_with_address", { p_quote_id: quoteId, p_street: "1 Test St" });
    expect(error).not.toBeNull();
  });

  it("shows the address to the requester and the winner only", async () => {
    const jobId = await makeJob(verified, DELIVERY);
    const won = await mustSubmitQuote(winner, jobId);
    await mustSubmitQuote(loser, jobId);
    const { error } = await verified.client.rpc("award_quote_with_address", { p_quote_id: won, p_street: "12 Example Street" });
    expect(error).toBeNull();

    const read = (u: TestUser) => u.client.from("job_delivery_addresses").select("street").eq("job_id", jobId);
    expect((await read(verified)).data).toEqual([{ street: "12 Example Street" }]);
    expect((await read(winner)).data).toEqual([{ street: "12 Example Street" }]);
    expect((await read(loser)).data ?? []).toEqual([]);
    expect((await read(stranger)).data ?? []).toEqual([]);
    const anon = await anonClient().from("job_delivery_addresses").select("street").eq("job_id", jobId);
    expect(anon.data ?? []).toEqual([]);
  });

  it("awards a job without delivery with no address", async () => {
    const jobId = await makeJob(verified, { services: ["destination_charges"] });
    const quoteId = await mustSubmitQuote(winner, jobId);
    const { error } = await verified.client.rpc("award_quote_with_address", { p_quote_id: quoteId, p_street: null });
    expect(error).toBeNull();
    const job = await admin.from("jobs").select("status").eq("id", jobId).single();
    expect(job.data?.status).toBe("awarded");
  });
});

describe("competition bands", () => {
  let poster: TestUser, viewer: TestUser;
  const quoters: TestUser[] = [];
  let none: string, few: string, busy: string, awarded: string;

  beforeAll(async () => {
    poster = await makeUser({ role: "agent", trust: "verified" });
    viewer = await makeUser();
    for (let i = 0; i < 4; i += 1) quoters.push(await makeUser());
    none = await makeJob(poster);
    few = await makeJob(poster);
    busy = await makeJob(poster);
    awarded = await makeJob(poster);
    await mustSubmitQuote(quoters[0], few);
    for (const q of quoters) await mustSubmitQuote(q, busy);
    const won = await mustSubmitQuote(quoters[0], awarded);
    await poster.client.rpc("award_quote", { p_quote_id: won });
  });

  it("returns only a band per open job, never a count or prices", async () => {
    const { data, error } = await viewer.client.rpc("job_quote_bands", { p_job_ids: [none, few, busy, awarded] });
    expect(error).toBeNull();
    const byJob = Object.fromEntries((data as { job_id: string; band: string }[]).map((r) => [r.job_id, r.band]));
    expect(byJob).toEqual({ [none]: "none", [few]: "few", [busy]: "busy" });
    for (const row of data as Record<string, unknown>[]) {
      expect(Object.keys(row).sort()).toEqual(["band", "job_id"]);
    }
  });

  it("refuses signed-out callers", async () => {
    const { data, error } = await anonClient().rpc("job_quote_bands", { p_job_ids: [busy] });
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
