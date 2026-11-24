import { expect, test } from "@playwright/test";
import { admin, createMember, emailFor, expectNoHorizontalScroll, insertJob, runId, signInUrl, watchErrors } from "./support";

const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function addQuote(jobId: string, member: { userId: string; companyId: string }, lines: { category: string; amount: number }[]) {
  const q = await admin
    .from("quotes")
    .insert({ job_id: jobId, company_id: member.companyId, created_by: member.userId, valid_until: day(20) })
    .select("id")
    .single();
  if (q.error) throw q.error;
  const { error } = await admin.from("quote_lines").insert(
    lines.map((l) => ({ quote_id: q.data.id, charge_name: `E2E ${l.category}`, amount_minor: l.amount, currency: "AUD", gst_included: true, category: l.category })),
  );
  if (error) throw error;
}

test("the requester compares like for like: lowest complete badge, missing legs flagged, filter works", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "requester");
  const agent = await createMember(emailFor("cmp-agent"), { name: `E2E Cmp Agent ${runId}`, role: "agent", trust: "verified", country: "China" });
  const jobId = await insertJob(agent, { origin: "CNSZX", destination: "AUMEL" }, { deadline_at: hours(72) });
  const full = ["destination", "customs", "delivery"];
  const f1 = await createMember(emailFor("cmp-f1"), { name: `E2E Dear Freight ${runId}`, role: "forwarder" });
  const f2 = await createMember(emailFor("cmp-f2"), { name: `E2E Cheap Freight ${runId}`, role: "forwarder" });
  const f3 = await createMember(emailFor("cmp-f3"), { name: `E2E Partial Freight ${runId}`, role: "forwarder" });
  await addQuote(jobId, f1, full.map((category) => ({ category, amount: 100_000 })));
  await addQuote(jobId, f2, full.map((category) => ({ category, amount: 80_000 })));
  await addQuote(jobId, f3, [{ category: "destination", amount: 30_000 }]);

  await page.goto(await signInUrl(emailFor("cmp-agent")));
  await page.goto(`/jobs/${jobId}`);
  const card = (name: string) => page.getByTestId("quote-card").filter({ hasText: name });

  await expect(card("Cheap Freight")).toContainText("Lowest complete quote");
  await expect(card("Dear Freight")).not.toContainText("Lowest complete quote");
  await expect(card("Partial Freight")).not.toContainText("Lowest complete quote");
  await expect(card("Partial Freight").getByTestId("quote-warnings")).toContainText("Does not include: Customs, Delivery");
  await expect(card("Cheap Freight").getByTestId("coverage")).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  await page.getByRole("link", { name: "Show only quotes that cover everything" }).click();
  await expect(card("Partial Freight")).toHaveCount(0);
  await expect(card("Cheap Freight")).toHaveCount(1);
  await expect(card("Dear Freight")).toHaveCount(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("questions are public once answered, the asker stays anonymous, and contact details are refused", async ({ browser }) => {
  const errors: string[] = [];
  const agent = await createMember(emailFor("qa-agent"), { name: `E2E Qa Agent ${runId}`, role: "agent", trust: "verified", country: "China" });
  const askerName = `E2E Asker Freight ${runId}`;
  await createMember(emailFor("qa-asker"), { name: askerName, role: "forwarder" });
  await createMember(emailFor("qa-other"), { name: `E2E Other Freight ${runId}`, role: "forwarder" });
  const jobId = await insertJob(agent, { origin: "CNSZX", destination: "AUSYD" }, { deadline_at: hours(72) });

  const open = async (label: string, email: string) => {
    const context = await browser.newContext(test.info().project.use);
    const page = await context.newPage();
    watchErrors(page, errors, label);
    await page.goto(await signInUrl(email));
    await page.goto(`/jobs/${jobId}`);
    return { context, page };
  };

  // The asker: contact details are refused, a clean question is accepted.
  const asker = await open("asker", emailFor("qa-asker"));
  await asker.page.locator("#question").fill("Please call me on +61 400 111 222 about this");
  await asker.page.getByRole("button", { name: "Send question" }).click();
  await expect(asker.page.getByRole("alert").filter({ hasText: "do not include contact details" })).toBeVisible();
  await asker.page.locator("#question").fill("Can the pallets be stacked two high?");
  await asker.page.getByRole("button", { name: "Send question" }).click();
  await expect(asker.page.getByText("Question sent")).toBeVisible();
  await asker.page.reload();
  await expect(asker.page.getByTestId("question").filter({ hasText: "stacked two high" })).toContainText("Your question");

  // Another forwarder cannot see it until it is answered.
  const other = await open("other", emailFor("qa-other"));
  await expect(other.page.getByText("stacked two high")).toHaveCount(0);

  // The requester sees it, without the asker's name, and answers it.
  const requester = await open("requester", emailFor("qa-agent"));
  const q = requester.page.getByTestId("question").filter({ hasText: "stacked two high" });
  await expect(q).toBeVisible();
  await expect(requester.page.locator("main")).not.toContainText(askerName);
  await q.getByLabel("Your answer").fill("Yes, up to two high.");
  await q.getByRole("button", { name: "Post answer" }).click();
  await expect(requester.page.getByText("Yes, up to two high.")).toBeVisible();

  // Now the other forwarder reads question and answer, and still cannot tell who asked.
  await other.page.reload();
  await expect(other.page.getByTestId("question").filter({ hasText: "stacked two high" })).toContainText("Yes, up to two high.");
  await expect(other.page.getByTestId("question")).not.toContainText("Your question");
  await expect(other.page.locator("main")).not.toContainText(askerName);
  expect(await expectNoHorizontalScroll(other.page)).toBe(0);

  for (const c of [asker, other, requester]) await c.context.close();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a quiet job can be extended in one tap, twice at most, and a job with a quote cannot", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "requester");
  const agent = await createMember(emailFor("ext-agent"), { name: `E2E Ext Agent ${runId}`, role: "agent", trust: "verified", country: "China" });
  const quiet = await insertJob(agent, { origin: "CNSZX", destination: "AUBNE" }, { deadline_at: hours(6) });
  const busy = await insertJob(agent, { origin: "CNSZX", destination: "AUFRE" }, { deadline_at: hours(6) });
  const fwd = await createMember(emailFor("ext-fwd"), { name: `E2E Ext Fwd ${runId}`, role: "forwarder" });
  await addQuote(busy, fwd, [{ category: "destination", amount: 10_000 }]);

  await page.goto(await signInUrl(emailFor("ext-agent")));

  await page.goto(`/jobs/${busy}`);
  await expect(page.getByTestId("extend-panel")).toHaveCount(0);

  await page.goto(`/jobs/${quiet}`);
  const before = (await admin.from("jobs").select("deadline_at").eq("id", quiet).single()).data!.deadline_at as string;
  await expect(page.getByTestId("extend-panel")).toBeVisible();
  await page.getByRole("button", { name: "Extend by 24 hours" }).click();
  await expect(page.getByText("Deadline extended by 24 hours")).toBeVisible();
  const after = await admin.from("jobs").select("deadline_at, extensions").eq("id", quiet).single();
  expect(after.data!.extensions).toBe(1);
  expect(new Date(after.data!.deadline_at).getTime() - new Date(before).getTime()).toBe(24 * 3_600_000);

  // The deadline is now more than 12 hours away, so the offer goes away until it is close again.
  await expect(page.getByTestId("extend-panel")).toHaveCount(0);
  await admin.from("jobs").update({ deadline_at: hours(5) }).eq("id", quiet);
  await page.reload();
  await page.getByRole("button", { name: "Extend by 48 hours" }).click();
  await expect(page.getByText("Deadline extended by 48 hours")).toBeVisible();
  expect((await admin.from("jobs").select("extensions").eq("id", quiet).single()).data!.extensions).toBe(2);

  // A third extension is refused, even if the deadline is close again.
  await admin.from("jobs").update({ deadline_at: hours(5) }).eq("id", quiet);
  await page.reload();
  await expect(page.getByTestId("extend-panel")).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});
