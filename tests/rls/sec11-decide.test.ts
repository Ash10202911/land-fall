import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, dateInDays, expireJob, inDays, line, makeJob, makeUser, mustSubmitQuote, type TestUser } from "./helpers";

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe("each person's language", () => {
  let me: TestUser, other: TestUser;
  beforeAll(async () => {
    me = await makeUser();
    other = await makeUser();
  });

  it("defaults to English and lets a person change their own", async () => {
    const before = await admin.from("profiles").select("language").eq("id", me.id).single();
    expect(before.data?.language).toBe("en");
    const upd = await me.client.from("profiles").update({ language: "zh" }).eq("id", me.id).select("language");
    expect(upd.data).toEqual([{ language: "zh" }]);
  });

  it("rejects an unknown language and cannot change someone else's", async () => {
    expect((await me.client.from("profiles").update({ language: "fr" }).eq("id", me.id)).error).not.toBeNull();
    const cross = await me.client.from("profiles").update({ language: "zh" }).eq("id", other.id).select("language");
    expect(cross.data ?? []).toEqual([]);
    expect((await admin.from("profiles").select("language").eq("id", other.id).single()).data?.language).toBe("en");
  });
});

describe("quote line categories", () => {
  let requester: TestUser, quoter: TestUser;
  beforeAll(async () => {
    requester = await makeUser({ role: "agent", trust: "verified" });
    quoter = await makeUser();
  });

  it("stores each line's category and defaults to other", async () => {
    const jobId = await makeJob(requester);
    const { data, error } = await quoter.client.rpc("submit_quote", {
      p_job_id: jobId,
      p_valid_until: dateInDays(14),
      p_notes: null,
      p_lines: [{ ...line("Port charges"), category: "destination" }, { ...line("Cartage"), category: "delivery" }, line("Misc")],
    });
    expect(error).toBeNull();
    const rows = await admin.from("quote_lines").select("charge_name, category").eq("quote_id", data as string).order("charge_name");
    expect(rows.data).toEqual([
      { charge_name: "Cartage", category: "delivery" },
      { charge_name: "Misc", category: "other" },
      { charge_name: "Port charges", category: "destination" },
    ]);
  });

  it("rejects an unknown category on submit and on edit", async () => {
    const jobId = await makeJob(requester);
    const bad = await quoter.client.rpc("submit_quote", {
      p_job_id: jobId, p_valid_until: dateInDays(14), p_notes: null, p_lines: [{ ...line(), category: "freight" }],
    });
    expect(bad.error).not.toBeNull();
    const id = await mustSubmitQuote(quoter, jobId);
    const edit = await quoter.client.rpc("update_quote", {
      p_quote_id: id, p_valid_until: dateInDays(14), p_notes: null, p_lines: [{ ...line(), category: "freight" }],
    });
    expect(edit.error).not.toBeNull();
  });
});

describe("public questions and answers", () => {
  let requester: TestUser, askerA: TestUser, askerB: TestUser, adminUser: TestUser;
  let jobId: string, questionId: string;

  beforeAll(async () => {
    requester = await makeUser({ role: "agent", trust: "verified" });
    askerA = await makeUser();
    askerB = await makeUser();
    adminUser = await makeUser({ isAdmin: true, trust: "verified" });
    jobId = await makeJob(requester);
    const res = await askerA.client.rpc("ask_question", { p_job_id: jobId, p_question: "Is the cargo palletised?" });
    expect(res.error).toBeNull();
    questionId = res.data as string;
  });

  const readQuestions = (c: TestUser["client"], id = questionId) => c.from("job_questions").select("question, answer").eq("id", id);

  it("shows an unanswered question only to the requester and the company that asked", async () => {
    expect((await readQuestions(requester.client)).data).toHaveLength(1);
    expect((await readQuestions(askerA.client)).data).toHaveLength(1);
    for (const c of [askerB.client, adminUser.client, anonClient()]) {
      expect((await readQuestions(c)).data ?? []).toEqual([]);
    }
  });

  it("never reveals who asked, to the requester, other forwarders, admins or signed-out callers", async () => {
    expect((await askerA.client.from("job_question_authors").select("company_id").eq("question_id", questionId)).data).toHaveLength(1);
    for (const c of [requester.client, askerB.client, adminUser.client, anonClient()]) {
      expect((await c.from("job_question_authors").select("company_id").eq("question_id", questionId)).data ?? []).toEqual([]);
    }
    // The public question table has no column that names the asker.
    const cols = await admin.from("job_questions").select("*").eq("id", questionId).single();
    expect(Object.keys(cols.data ?? {}).sort()).toEqual(["answer", "answered_at", "created_at", "id", "job_id", "question"]);
  });

  it("lets only the requester answer, and then every signed-in user reads the answer", async () => {
    for (const c of [askerA, askerB]) {
      expect((await c.client.rpc("answer_question", { p_question_id: questionId, p_answer: "Yes, 22 pallets." })).error).not.toBeNull();
    }
    expect((await anonClient().rpc("answer_question", { p_question_id: questionId, p_answer: "Yes." })).error).not.toBeNull();
    const ok = await requester.client.rpc("answer_question", { p_question_id: questionId, p_answer: "Yes, 22 pallets per container." });
    expect(ok.error).toBeNull();
    for (const c of [askerA.client, askerB.client, adminUser.client, requester.client]) {
      expect((await readQuestions(c)).data).toEqual([{ question: "Is the cargo palletised?", answer: "Yes, 22 pallets per container." }]);
    }
    expect((await readQuestions(anonClient())).data ?? []).toEqual([]);
    // Still no author for anyone but the asker.
    expect((await askerB.client.from("job_question_authors").select("company_id").eq("question_id", questionId)).data ?? []).toEqual([]);
  });

  it("blocks direct writes to both tables", async () => {
    const ins = await askerA.client.from("job_questions").insert({ job_id: jobId, question: "Sneaky direct insert" });
    expect(ins.error).not.toBeNull();
    const upd = await requester.client.from("job_questions").update({ answer: "Edited directly" }).eq("id", questionId).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await askerA.client.from("job_questions").delete().eq("id", questionId).select("id");
    expect(del.data ?? []).toEqual([]);
    expect((await askerA.client.from("job_question_authors").insert({ question_id: questionId, company_id: askerA.companyId, created_by: askerA.id })).error).not.toBeNull();
  });

  it("stops a requester asking on their own job, and suspended companies asking at all", async () => {
    expect((await requester.client.rpc("ask_question", { p_job_id: jobId, p_question: "Asking my own job?" })).error).not.toBeNull();
    const suspended = await makeUser({ status: "suspended" });
    expect((await suspended.client.rpc("ask_question", { p_job_id: jobId, p_question: "Can a suspended company ask?" })).error).not.toBeNull();
    expect((await anonClient().rpc("ask_question", { p_job_id: jobId, p_question: "Can a visitor ask?" })).error).not.toBeNull();
  });

  it("closes questions when the job is closed, awarded or cancelled", async () => {
    const expired = await makeJob(requester);
    await expireJob(expired);
    expect((await askerB.client.rpc("ask_question", { p_job_id: expired, p_question: "Too late to ask?" })).error).not.toBeNull();

    const cancelled = await makeJob(requester);
    await requester.client.rpc("cancel_job", { p_job_id: cancelled });
    expect((await askerB.client.rpc("ask_question", { p_job_id: cancelled, p_question: "Asking a cancelled job?" })).error).not.toBeNull();

    const awarded = await makeJob(requester);
    const q = (await askerA.client.rpc("ask_question", { p_job_id: awarded, p_question: "Question before the award?" })).data as string;
    const quoteId = await mustSubmitQuote(askerB, awarded);
    expect((await requester.client.rpc("award_quote", { p_quote_id: quoteId })).error).toBeNull();
    expect((await askerA.client.rpc("ask_question", { p_job_id: awarded, p_question: "Question after the award?" })).error).not.toBeNull();
    expect((await requester.client.rpc("answer_question", { p_question_id: q, p_answer: "Too late to answer." })).error).not.toBeNull();
  });

  it("rejects contact details in a question or an answer", async () => {
    const blocked = [
      "Email me at buyer@example.com please",
      "Call +61 400 123 456 about it",
      "My number is 0400 123 456 ok",
      "See www.example.com for photos",
      "Photos at https://example.com/x",
    ];
    for (const text of blocked) {
      const res = await askerB.client.rpc("ask_question", { p_job_id: jobId, p_question: text });
      expect(res.error?.message, text).toMatch(/contact details/i);
    }
    const q = (await askerB.client.rpc("ask_question", { p_job_id: jobId, p_question: "What size are the pallets?" })).data as string;
    for (const text of ["Write to me at boss@example.com", "Ring 0400 123 456"]) {
      const res = await requester.client.rpc("answer_question", { p_question_id: q, p_answer: text });
      expect(res.error?.message, text).toMatch(/contact details/i);
    }
    // Ordinary freight talk is fine: container types, weights, pallet counts.
    expect((await requester.client.rpc("answer_question", { p_question_id: q, p_answer: "1.2 x 1.0 m, 22 pallets, about 14,500 kg in a 40HC." })).error).toBeNull();
  });

  it("checks length and caps questions at 3 per job and 20 per day", async () => {
    expect((await askerB.client.rpc("ask_question", { p_job_id: jobId, p_question: "Hi" })).error).not.toBeNull();
    expect((await askerB.client.rpc("ask_question", { p_job_id: jobId, p_question: "x".repeat(501) })).error).not.toBeNull();
    const busy = await makeUser();
    const target = await makeJob(requester);
    for (let i = 0; i < 3; i += 1) {
      expect((await busy.client.rpc("ask_question", { p_job_id: target, p_question: `Question number ${i + 1} here` })).error).toBeNull();
    }
    expect((await busy.client.rpc("ask_question", { p_job_id: target, p_question: "A fourth question here" })).error?.message).toMatch(/most questions/);

    const daily = await makeUser();
    for (let i = 0; i < 7; i += 1) {
      const j = await makeJob(requester);
      for (let k = 0; k < 3 && i * 3 + k < 20; k += 1) {
        expect((await daily.client.rpc("ask_question", { p_job_id: j, p_question: `Daily question ${i}-${k} here` })).error).toBeNull();
      }
    }
    const last = await makeJob(requester);
    expect((await daily.client.rpc("ask_question", { p_job_id: last, p_question: "The twenty-first today" })).error?.message).toMatch(/24 hours/);
  });
});

describe("extending a quiet job", () => {
  let requester: TestUser, other: TestUser, quoter: TestUser;
  beforeAll(async () => {
    requester = await makeUser({ role: "agent", trust: "verified" });
    other = await makeUser({ role: "agent", trust: "verified" });
    quoter = await makeUser();
  });

  const deadline = async (id: string) => new Date((await admin.from("jobs").select("deadline_at").eq("id", id).single()).data!.deadline_at as string).getTime();

  it("extends by 24 then 48 hours, and stops after two extensions", async () => {
    const jobId = await makeJob(requester, { deadline_at: inHours(5) });
    const before = await deadline(jobId);
    const first = await requester.client.rpc("extend_job", { p_job_id: jobId, p_hours: 24 });
    expect(first.error).toBeNull();
    expect((await deadline(jobId)) - before).toBe(24 * 3_600_000);
    // Now 29 hours away: outside the last-12-hours window until it is brought forward again.
    expect((await requester.client.rpc("extend_job", { p_job_id: jobId, p_hours: 24 })).error?.message).toMatch(/last 12 hours/);
    await admin.from("jobs").update({ deadline_at: inHours(4) }).eq("id", jobId);
    const second = await requester.client.rpc("extend_job", { p_job_id: jobId, p_hours: 48 });
    expect(second.error).toBeNull();
    await admin.from("jobs").update({ deadline_at: inHours(3) }).eq("id", jobId);
    expect((await requester.client.rpc("extend_job", { p_job_id: jobId, p_hours: 24 })).error?.message).toMatch(/twice/);
    expect((await admin.from("jobs").select("extensions").eq("id", jobId).single()).data?.extensions).toBe(2);
  });

  it("only offers 24 or 48 hours", async () => {
    const jobId = await makeJob(requester, { deadline_at: inHours(5) });
    for (const hours of [0, 12, 72, -24]) {
      expect((await requester.client.rpc("extend_job", { p_job_id: jobId, p_hours: hours })).error, `${hours}`).not.toBeNull();
    }
    expect(await deadline(jobId)).toBeLessThan(Date.now() + 6 * 3_600_000);
  });

  it("is only for the requester, signed in, on their own job", async () => {
    const jobId = await makeJob(requester, { deadline_at: inHours(5) });
    for (const c of [other.client, quoter.client]) {
      expect((await c.rpc("extend_job", { p_job_id: jobId, p_hours: 24 })).error).not.toBeNull();
    }
    expect((await anonClient().rpc("extend_job", { p_job_id: jobId, p_hours: 24 })).error).not.toBeNull();
    expect(await deadline(jobId)).toBeLessThan(Date.now() + 6 * 3_600_000);
  });

  it("is refused for a job with live quotes, a job with plenty of time, and a closed job", async () => {
    const quoted = await makeJob(requester, { deadline_at: inHours(5) });
    const quoteId = await mustSubmitQuote(quoter, quoted);
    expect((await requester.client.rpc("extend_job", { p_job_id: quoted, p_hours: 24 })).error?.message).toMatch(/with quotes/);
    // A withdrawn quote does not count as live.
    await quoter.client.rpc("withdraw_quote", { p_quote_id: quoteId });
    expect((await requester.client.rpc("extend_job", { p_job_id: quoted, p_hours: 24 })).error).toBeNull();

    const roomy = await makeJob(requester, { deadline_at: inDays(2) });
    expect((await requester.client.rpc("extend_job", { p_job_id: roomy, p_hours: 24 })).error?.message).toMatch(/last 12 hours/);

    const closed = await makeJob(requester, { deadline_at: inHours(5) });
    await expireJob(closed);
    expect((await requester.client.rpc("extend_job", { p_job_id: closed, p_hours: 24 })).error).not.toBeNull();
  });

  it("is refused for a suspended company", async () => {
    const suspended = await makeUser({ role: "agent", status: "suspended" });
    const jobId = await makeJob(suspended, { deadline_at: inHours(5) });
    expect((await suspended.client.rpc("extend_job", { p_job_id: jobId, p_hours: 24 })).error).not.toBeNull();
  });
});

describe("lane alert deliveries per extension round", () => {
  it("allows one delivery per alert, job and round", async () => {
    const owner = await makeUser();
    const requester = await makeUser({ role: "agent", trust: "verified" });
    const jobId = await makeJob(requester);
    const ports = await admin.from("ports").select("id").limit(1).single();
    const alert = await admin
      .from("lane_alerts")
      .insert({ company_id: owner.companyId, created_by: owner.id, destination_port_id: ports.data!.id })
      .select("id")
      .single();
    const put = (round: number) => admin.from("lane_alert_deliveries").insert({ alert_id: alert.data!.id, job_id: jobId, round });
    expect((await put(0)).error).toBeNull();
    expect((await put(1)).error).toBeNull();
    expect((await put(1)).error).not.toBeNull();
  });
});
