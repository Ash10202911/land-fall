import { beforeAll, describe, expect, it } from "vitest";
import { admin, dateInDays, expireJob, inDays, makeJob, makeUser, mustSubmitQuote, submitQuote, twoPorts, type TestUser } from "./helpers";

describe("cancel_job and update_job", () => {
  let poster: TestUser, other: TestUser, quoter: TestUser;

  beforeAll(async () => {
    poster = await makeUser({ role: "agent", trust: "verified" });
    other = await makeUser({ role: "agent", trust: "verified" });
    quoter = await makeUser();
  });

  it("lets the poster cancel an open job; live quotes become lost", async () => {
    const jobId = await makeJob(poster);
    const quoteId = await mustSubmitQuote(quoter, jobId);
    const { error } = await poster.client.rpc("cancel_job", { p_job_id: jobId });
    expect(error).toBeNull();
    const job = await admin.from("jobs").select("status").eq("id", jobId).single();
    expect(job.data?.status).toBe("cancelled");
    const q = await admin.from("quotes").select("status").eq("id", quoteId).single();
    expect(q.data?.status).toBe("lost");
  });

  it("blocks other companies, quoters and anonymous users from cancelling", async () => {
    const jobId = await makeJob(poster);
    expect((await other.client.rpc("cancel_job", { p_job_id: jobId })).error).not.toBeNull();
    expect((await quoter.client.rpc("cancel_job", { p_job_id: jobId })).error).not.toBeNull();
    const job = await admin.from("jobs").select("status").eq("id", jobId).single();
    expect(job.data?.status).toBe("open");
  });

  it("cannot cancel an awarded job", async () => {
    const jobId = await makeJob(poster);
    const quoteId = await mustSubmitQuote(quoter, jobId);
    expect((await poster.client.rpc("award_quote", { p_quote_id: quoteId })).error).toBeNull();
    expect((await poster.client.rpc("cancel_job", { p_job_id: jobId })).error).not.toBeNull();
  });

  it("cannot quote a cancelled job", async () => {
    const jobId = await makeJob(poster);
    await poster.client.rpc("cancel_job", { p_job_id: jobId });
    expect((await submitQuote(quoter, jobId)).error).not.toBeNull();
  });

  it("lets the poster edit notes and extend the deadline, but not shorten it", async () => {
    const jobId = await makeJob(poster);
    const later = inDays(6);
    const ok = await poster.client.rpc("update_job", {
      p_job_id: jobId,
      p_cargo_description: "Test cargo",
      p_notes: "Updated notes",
      p_ready_date: dateInDays(10),
      p_deadline_at: later,
    });
    expect(ok.error).toBeNull();
    const shorter = await poster.client.rpc("update_job", {
      p_job_id: jobId,
      p_cargo_description: "Test cargo",
      p_notes: "x",
      p_ready_date: dateInDays(10),
      p_deadline_at: inDays(1),
    });
    expect(shorter.error).not.toBeNull();
  });

  it("freezes cargo details once a live quote exists", async () => {
    const jobId = await makeJob(poster);
    await mustSubmitQuote(quoter, jobId);
    const res = await poster.client.rpc("update_job", {
      p_job_id: jobId,
      p_cargo_description: "Completely different cargo",
      p_notes: null,
      p_ready_date: dateInDays(10),
      p_deadline_at: inDays(5),
    });
    expect(res.error).not.toBeNull();
  });

  it("blocks edits by other companies and after the deadline", async () => {
    const jobId = await makeJob(poster);
    const args = {
      p_job_id: jobId,
      p_cargo_description: "Test cargo",
      p_notes: null,
      p_ready_date: dateInDays(10),
      p_deadline_at: inDays(8),
    };
    expect((await other.client.rpc("update_job", args)).error).not.toBeNull();
    await expireJob(jobId);
    expect((await poster.client.rpc("update_job", args)).error).not.toBeNull();
  });
});

describe("admin guards and audit log", () => {
  it("blocks an admin from changing their own company's trust level or status", async () => {
    const boss = await makeUser({ isAdmin: true, trust: "basic" });
    const trust = await boss.client.from("companies").update({ trust_level: "verified" }).eq("id", boss.companyId).select();
    expect(trust.error).not.toBeNull();
    const status = await boss.client.from("companies").update({ status: "suspended" }).eq("id", boss.companyId).select();
    expect(status.error).not.toBeNull();
    const row = await admin.from("companies").select("trust_level, status").eq("id", boss.companyId).single();
    expect(row.data).toEqual({ trust_level: "basic", status: "active" });
  });

  it("logs admin trust changes on other companies, readable by admins only", async () => {
    const boss = await makeUser({ isAdmin: true });
    const target = await makeUser();
    const regular = await makeUser();
    const upd = await boss.client.from("companies").update({ trust_level: "verified" }).eq("id", target.companyId).select();
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);

    const seen = await boss.client.from("admin_audit_log").select("field, old_value, new_value, actor_id").eq("company_id", target.companyId);
    expect(seen.data).toEqual([{ field: "trust_level", old_value: "basic", new_value: "verified", actor_id: boss.id }]);

    const hidden = await regular.client.from("admin_audit_log").select("id");
    expect(hidden.data ?? []).toEqual([]);
    const write = await boss.client.from("admin_audit_log").insert({ company_id: target.companyId, field: "status", old_value: "a", new_value: "b" });
    expect(write.error).not.toBeNull();
  });
});

describe("abuse limits", () => {
  it("rejects a quote validity date in the past", async () => {
    const poster = await makeUser({ role: "agent", trust: "verified" });
    const quoter = await makeUser();
    const jobId = await makeJob(poster);
    const res = await quoter.client.rpc("submit_quote", {
      p_job_id: jobId,
      p_valid_until: dateInDays(-1),
      p_notes: null,
      p_lines: [{ charge_name: "x", amount_minor: 100, currency: "AUD", gst_included: false }],
    });
    expect(res.error).not.toBeNull();
  });

  it("limits quote attempts per company per job", async () => {
    const poster = await makeUser({ role: "agent", trust: "verified" });
    const quoter = await makeUser();
    const jobId = await makeJob(poster);
    for (let i = 0; i < 5; i++) {
      const id = await mustSubmitQuote(quoter, jobId);
      await quoter.client.rpc("withdraw_quote", { p_quote_id: id });
    }
    expect((await submitQuote(quoter, jobId)).error).not.toBeNull();
  });

  it("limits jobs posted per company in 24 hours", async () => {
    const poster = await makeUser({ role: "agent" });
    const [origin, destination] = await twoPorts();
    const row = () => ({
      company_id: poster.companyId,
      created_by: poster.id,
      direction: "import",
      incoterm: "FOB",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 1,
      cargo_description: "Test cargo",
      ready_date: dateInDays(10),
      deadline_at: inDays(3),
    });
    for (let i = 0; i < 20; i++) {
      const r = await poster.client.from("jobs").insert(row());
      expect(r.error).toBeNull();
    }
    expect((await poster.client.from("jobs").insert(row())).error).not.toBeNull();
  });
});

describe("admin posting on behalf of a company", () => {
  it("lets an admin post for an active company but not a suspended one", async () => {
    const boss = await makeUser({ isAdmin: true });
    const agent = await makeUser({ role: "agent" });
    const suspended = await makeUser({ role: "agent", status: "suspended" });
    const [origin, destination] = await twoPorts();
    const base = {
      created_by: boss.id,
      direction: "import",
      incoterm: "FOB",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 1,
      cargo_description: "Posted on behalf",
      ready_date: dateInDays(10),
      deadline_at: inDays(3),
    };
    expect((await boss.client.from("jobs").insert({ ...base, company_id: agent.companyId })).error).toBeNull();
    expect((await boss.client.from("jobs").insert({ ...base, company_id: suspended.companyId })).error).not.toBeNull();
  });

  it("does not let a non-admin post for another company", async () => {
    const user = await makeUser({ role: "agent" });
    const agent = await makeUser({ role: "agent" });
    const [origin, destination] = await twoPorts();
    const res = await user.client.from("jobs").insert({
      company_id: agent.companyId,
      created_by: user.id,
      direction: "import",
      incoterm: "FOB",
      mode: "FCL",
      origin_port_id: origin,
      destination_port_id: destination,
      container_type: "40HC",
      container_qty: 1,
      cargo_description: "Nope",
      ready_date: dateInDays(10),
      deadline_at: inDays(3),
    });
    expect(res.error).not.toBeNull();
  });
});
