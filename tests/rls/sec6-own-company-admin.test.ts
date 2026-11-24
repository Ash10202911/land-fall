import { describe, expect, it, beforeAll } from "vitest";
import { admin, anonClient, dateInDays, inDays, makeJob, makeUser, twoPorts, type TestUser } from "./helpers";

// SEC-6: Users can only act for their own company. Admin actions require is_admin.
describe("SEC-6 own company and admin only", () => {
  let alice: TestUser, bob: TestUser, adminUser: TestUser;

  beforeAll(async () => {
    alice = await makeUser({ role: "agent" });
    bob = await makeUser();
    adminUser = await makeUser({ isAdmin: true });
  });

  it("blocks posting a job for another company", async () => {
    const [origin, destination] = await twoPorts();
    const { error } = await alice.client.from("jobs").insert({
      company_id: bob.companyId,
      created_by: alice.id,
      direction: "import",
      incoterm: "FOB",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 1,
      cargo_description: "Impersonation",
      ready_date: dateInDays(5),
      services: [],
      deadline_at: inDays(2),
    });
    expect(error).not.toBeNull();
  });

  it("blocks posting a job as another user", async () => {
    const [origin, destination] = await twoPorts();
    const { error } = await alice.client.from("jobs").insert({
      company_id: alice.companyId,
      created_by: bob.id,
      direction: "import",
      incoterm: "FOB",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 1,
      cargo_description: "Forged author",
      ready_date: dateInDays(5),
      services: [],
      deadline_at: inDays(2),
    });
    expect(error).not.toBeNull();
  });

  it("blocks sending a quote for another company", async () => {
    const jobId = await makeJob(alice);
    const { error } = await bob.client.from("quotes").insert({
      job_id: jobId,
      company_id: alice.companyId,
      created_by: bob.id,
      valid_until: dateInDays(5),
    });
    expect(error).not.toBeNull();
  });

  it("blocks users from changing a company, including their own trust level and status", async () => {
    const own = await alice.client.from("companies").update({ trust_level: "verified" }).eq("id", alice.companyId).select();
    expect(own.data ?? []).toEqual([]);
    const other = await alice.client.from("companies").update({ status: "suspended" }).eq("id", bob.companyId).select();
    expect(other.data ?? []).toEqual([]);
    const renamed = await alice.client.from("companies").update({ name: "Renamed" }).eq("id", alice.companyId);
    expect(renamed.error).not.toBeNull();

    const row = await admin.from("companies").select("trust_level, status").eq("id", alice.companyId).single();
    expect(row.data).toEqual({ trust_level: "basic", status: "active" });
  });

  it("lets an admin change trust level and status", async () => {
    const verify = await adminUser.client.from("companies").update({ trust_level: "verified" }).eq("id", bob.companyId).select();
    expect(verify.data).toHaveLength(1);
    const suspend = await adminUser.client.from("companies").update({ status: "suspended" }).eq("id", bob.companyId).select();
    expect(suspend.data).toHaveLength(1);
    const row = await admin.from("companies").select("trust_level, status").eq("id", bob.companyId).single();
    expect(row.data).toEqual({ trust_level: "verified", status: "suspended" });
  });

  it("blocks users from making themselves admin or moving to another company", async () => {
    const asAdmin = await alice.client.from("profiles").update({ is_admin: true }).eq("id", alice.id);
    expect(asAdmin.error).not.toBeNull();
    const moved = await alice.client.from("profiles").update({ company_id: bob.companyId }).eq("id", alice.id);
    expect(moved.error).not.toBeNull();
    const row = await admin.from("profiles").select("is_admin, company_id").eq("id", alice.id).single();
    expect(row.data).toEqual({ is_admin: false, company_id: alice.companyId });
  });

  it("lets users edit only their own name and phone", async () => {
    const ok = await alice.client.from("profiles").update({ full_name: "Alice A", phone: "+61 411 111 111" }).eq("id", alice.id).select();
    expect(ok.data).toHaveLength(1);
    const theirs = await alice.client.from("profiles").update({ full_name: "Hacked" }).eq("id", bob.id).select();
    expect(theirs.data ?? []).toEqual([]);
  });

  it("blocks anonymous visitors from every table", async () => {
    const anon = anonClient();
    for (const table of ["companies", "profiles", "jobs", "quotes", "quote_lines", "ports"]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0, `${table} must not be readable anonymously`).toBe(true);
    }
  });

  it("keeps a company's website to itself and admins, and never lets the API write it", async () => {
    await admin.from("company_sites").upsert({ company_id: alice.companyId, website: "https://alice-freight.example.com" });
    const own = await alice.client.from("company_sites").select("website");
    expect(own.data).toEqual([{ website: "https://alice-freight.example.com" }]);
    const other = await bob.client.from("company_sites").select("website").eq("company_id", alice.companyId);
    expect(other.data ?? []).toEqual([]);
    const asAdmin = await adminUser.client.from("company_sites").select("website").eq("company_id", alice.companyId);
    expect(asAdmin.data).toEqual([{ website: "https://alice-freight.example.com" }]);
    const anon = anonClient();
    expect((await anon.from("company_sites").select("website")).data ?? []).toEqual([]);
    const write = await alice.client.from("company_sites").update({ website: "https://evil.example.com" }).eq("company_id", alice.companyId);
    expect(write.error).not.toBeNull();
    const row = await admin.from("company_sites").select("website").eq("company_id", alice.companyId).single();
    expect(row.data?.website).toBe("https://alice-freight.example.com");
  });

  it("lets a user onboard once and no more", async () => {
    const fresh = await makeUser({ companyId: undefined });
    await admin.from("profiles").update({ company_id: null }).eq("id", fresh.id);
    const noSite = await fresh.client.rpc("onboard", { p_company_name: "Fresh Freight", p_country: "Australia", p_role: "forwarder", p_website: "" });
    expect(noSite.error, "a website is required").not.toBeNull();
    const badSite = await fresh.client.rpc("onboard", { p_company_name: "Fresh Freight", p_country: "Australia", p_role: "forwarder", p_website: "javascript:alert(1)" });
    expect(badSite.error, "only http(s) addresses are stored").not.toBeNull();
    const first = await fresh.client.rpc("onboard", { p_company_name: "Fresh Freight", p_country: "Australia", p_role: "forwarder", p_website: "https://fresh-freight.example.com" });
    expect(first.error).toBeNull();
    const second = await fresh.client.rpc("onboard", { p_company_name: "Another Co", p_country: "Australia", p_role: "agent", p_website: "https://another.example.com" });
    expect(second.error).not.toBeNull();
    const row = await admin.from("companies").select("trust_level, status").eq("id", first.data as string).single();
    expect(row.data).toEqual({ trust_level: "basic", status: "active" });
  });
});
