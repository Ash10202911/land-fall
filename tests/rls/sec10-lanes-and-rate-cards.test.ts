import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, dateInDays, makeJob, makeUser, twoPorts, type TestUser } from "./helpers";

const CHARGES = [
  { kind: "charge", name: "Port service charge", category: "destination", basis: "per_40ft", amount_minor: 16500, gst_included: true },
  { kind: "zone", name: "Zone 1", category: "delivery", basis: "per_container", amount_minor: 42000, gst_included: true, postcode_from: 2000, postcode_to: 2050 },
  { kind: "charge", name: "Side-loader", category: "delivery", basis: "per_container", amount_minor: 8000, gst_included: true, unload_type: "side_loader" },
];

async function saveCard(user: TestUser, overrides: Record<string, unknown> = {}) {
  const [, port] = await twoPorts();
  return user.client.rpc("save_rate_card", {
    p_id: null,
    p_name: "Port Botany",
    p_port: port,
    p_currency: "AUD",
    p_valid_to: dateInDays(30),
    p_charges: CHARGES,
    ...overrides,
  });
}

async function addAlert(user: TestUser, extra: Record<string, unknown> = {}) {
  const [, port] = await twoPorts();
  return user.client
    .from("lane_alerts")
    .insert({ company_id: user.companyId, created_by: user.id, destination_port_id: port, ...extra })
    .select("id")
    .single();
}

describe("lane alerts are private to a company", () => {
  let owner: TestUser, other: TestUser, adminUser: TestUser;
  let alertId: string;

  beforeAll(async () => {
    owner = await makeUser();
    other = await makeUser();
    adminUser = await makeUser({ isAdmin: true, trust: "verified" });
    const res = await addAlert(owner, { modes: ["FCL"], frequency: "daily" });
    expect(res.error).toBeNull();
    alertId = res.data?.id as string;
  });

  it("lets the owner read, change and delete its own alert", async () => {
    expect((await owner.client.from("lane_alerts").select("id").eq("id", alertId)).data).toHaveLength(1);
    const upd = await owner.client.from("lane_alerts").update({ frequency: "off" }).eq("id", alertId).select("frequency");
    expect(upd.data).toEqual([{ frequency: "off" }]);
    const extra = (await addAlert(owner)).data?.id as string;
    const del = await owner.client.from("lane_alerts").delete().eq("id", extra).select("id");
    expect(del.data).toHaveLength(1);
  });

  it("hides it from other companies, from admins and from signed-out callers", async () => {
    for (const c of [other.client, adminUser.client, anonClient()]) {
      expect((await c.from("lane_alerts").select("id").eq("id", alertId)).data ?? []).toEqual([]);
    }
  });

  it("stops another company changing or deleting it", async () => {
    const upd = await other.client.from("lane_alerts").update({ frequency: "instant" }).eq("id", alertId).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await other.client.from("lane_alerts").delete().eq("id", alertId).select("id");
    expect(del.data ?? []).toEqual([]);
    const row = await admin.from("lane_alerts").select("frequency").eq("id", alertId).single();
    expect(row.data?.frequency).toBe("off");
  });

  it("stops a company creating an alert for someone else, or for a suspended company", async () => {
    const [, port] = await twoPorts();
    const forOther = await owner.client
      .from("lane_alerts")
      .insert({ company_id: other.companyId, created_by: owner.id, destination_port_id: port });
    expect(forOther.error).not.toBeNull();
    const asOther = await owner.client
      .from("lane_alerts")
      .insert({ company_id: owner.companyId, created_by: other.id, destination_port_id: port });
    expect(asOther.error).not.toBeNull();
    const suspended = await makeUser({ status: "suspended" });
    expect((await addAlert(suspended)).error).not.toBeNull();
  });

  it("rejects bad modes, a bad frequency, and both an origin port and country", async () => {
    const [origin] = await twoPorts();
    expect((await addAlert(owner, { modes: ["Rail"] })).error).not.toBeNull();
    expect((await addAlert(owner, { frequency: "hourly" })).error).not.toBeNull();
    expect((await addAlert(owner, { origin_port_id: origin, origin_country: "China" })).error).not.toBeNull();
  });

  it("caps a company at 20 alerts", async () => {
    const busy = await makeUser();
    for (let i = 0; i < 20; i += 1) expect((await addAlert(busy)).error).toBeNull();
    const over = await addAlert(busy);
    expect(over.error?.message).toMatch(/at most 20/);
  });

  it("keeps the delivery log out of reach of every signed-in user", async () => {
    const jobId = await makeJob(owner);
    await admin.from("lane_alert_deliveries").insert({ alert_id: alertId, job_id: jobId });
    for (const c of [owner.client, adminUser.client, anonClient()]) {
      const read = await c.from("lane_alert_deliveries").select("job_id");
      expect(read.data ?? []).toEqual([]);
      expect((await c.from("lane_alert_deliveries").insert({ alert_id: alertId, job_id: jobId })).error).not.toBeNull();
    }
  });
});

describe("rate cards are private to a company", () => {
  let owner: TestUser, other: TestUser, adminUser: TestUser;
  let cardId: string;

  beforeAll(async () => {
    owner = await makeUser();
    other = await makeUser();
    adminUser = await makeUser({ isAdmin: true, trust: "verified" });
    const res = await saveCard(owner);
    expect(res.error).toBeNull();
    cardId = res.data as string;
  });

  it("stores the card with all its rows for the owner", async () => {
    const card = await owner.client.from("rate_cards").select("name, currency").eq("id", cardId).single();
    expect(card.data).toEqual({ name: "Port Botany", currency: "AUD" });
    const rows = await owner.client.from("rate_card_charges").select("name, kind, position").eq("rate_card_id", cardId).order("position");
    expect(rows.data?.map((r) => r.name)).toEqual(["Port service charge", "Zone 1", "Side-loader"]);
    expect(rows.data?.map((r) => r.kind)).toEqual(["charge", "zone", "charge"]);
  });

  it("hides cards and their prices from other companies, admins and signed-out callers", async () => {
    for (const c of [other.client, adminUser.client, anonClient()]) {
      expect((await c.from("rate_cards").select("id").eq("id", cardId)).data ?? []).toEqual([]);
      expect((await c.from("rate_card_charges").select("id").eq("rate_card_id", cardId)).data ?? []).toEqual([]);
    }
  });

  it("stops another company editing, deleting or adding rows to the card", async () => {
    const [, port] = await twoPorts();
    const edit = await other.client.rpc("save_rate_card", {
      p_id: cardId, p_name: "Hijacked", p_port: port, p_currency: "AUD", p_valid_to: dateInDays(10), p_charges: CHARGES,
    });
    expect(edit.error).not.toBeNull();
    expect((await other.client.from("rate_cards").delete().eq("id", cardId).select("id")).data ?? []).toEqual([]);
    const add = await other.client.from("rate_card_charges").insert({
      rate_card_id: cardId, position: 9, kind: "charge", name: "Planted", category: "destination", basis: "per_job", amount_minor: 100,
    });
    expect(add.error).not.toBeNull();
    const row = await admin.from("rate_cards").select("name").eq("id", cardId).single();
    expect(row.data?.name).toBe("Port Botany");
  });

  it("replaces the rows atomically when the owner saves again", async () => {
    const res = await saveCard(owner, { p_id: cardId, p_name: "Port Botany v2", p_charges: [CHARGES[0]] });
    expect(res.error).toBeNull();
    const rows = await owner.client.from("rate_card_charges").select("id").eq("rate_card_id", cardId);
    expect(rows.data).toHaveLength(1);
    const card = await owner.client.from("rate_cards").select("name").eq("id", cardId).single();
    expect(card.data?.name).toBe("Port Botany v2");
  });

  it("rolls the whole save back when one row is invalid", async () => {
    const before = await owner.client.from("rate_card_charges").select("id").eq("rate_card_id", cardId);
    const bad = await saveCard(owner, {
      p_id: cardId,
      p_name: "Should not stick",
      p_charges: [CHARGES[0], { ...CHARGES[1], postcode_from: 2100, postcode_to: 2000 }],
    });
    expect(bad.error).not.toBeNull();
    const after = await owner.client.from("rate_card_charges").select("id").eq("rate_card_id", cardId);
    expect(after.data).toHaveLength(before.data?.length ?? -1);
    const card = await owner.client.from("rate_cards").select("name").eq("id", cardId).single();
    expect(card.data?.name).toBe("Port Botany v2");
  });

  it("rejects invalid rows: zero price, zone without a range, unload rule on a non-delivery charge", async () => {
    const zero = await saveCard(owner, { p_charges: [{ ...CHARGES[0], amount_minor: 0 }] });
    expect(zero.error).not.toBeNull();
    const noRange = await saveCard(owner, { p_charges: [{ ...CHARGES[1], postcode_from: null, postcode_to: null }] });
    expect(noRange.error).not.toBeNull();
    const badUnload = await saveCard(owner, { p_charges: [{ ...CHARGES[0], unload_type: "side_loader" }] });
    expect(badUnload.error).not.toBeNull();
    const badBasis = await saveCard(owner, { p_charges: [{ ...CHARGES[0], basis: "per_banana" }] });
    expect(badBasis.error).not.toBeNull();
  });

  it("rejects a past valid-to date, an empty card and an unknown currency", async () => {
    expect((await saveCard(owner, { p_valid_to: dateInDays(-1) })).error?.message).toMatch(/past/);
    expect((await saveCard(owner, { p_charges: [] })).error).not.toBeNull();
    expect((await saveCard(owner, { p_currency: "XXX" })).error).not.toBeNull();
  });

  it("refuses suspended companies and signed-out callers", async () => {
    const suspended = await makeUser({ status: "suspended" });
    expect((await saveCard(suspended)).error).not.toBeNull();
    const anon = await anonClient().rpc("save_rate_card", {
      p_id: null, p_name: "x1", p_port: 1, p_currency: "AUD", p_valid_to: dateInDays(5), p_charges: CHARGES,
    });
    expect(anon.error).not.toBeNull();
  });

  it("caps a company at 10 rate cards", async () => {
    const busy = await makeUser();
    for (let i = 0; i < 10; i += 1) expect((await saveCard(busy)).error).toBeNull();
    expect((await saveCard(busy)).error?.message).toMatch(/at most 10/);
  });

  it("deletes the rows with the card", async () => {
    const mine = (await saveCard(owner)).data as string;
    const del = await owner.client.from("rate_cards").delete().eq("id", mine).select("id");
    expect(del.data).toHaveLength(1);
    const rows = await admin.from("rate_card_charges").select("id").eq("rate_card_id", mine);
    expect(rows.data).toEqual([]);
  });
});
