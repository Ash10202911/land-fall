import { expect, test } from "@playwright/test";
import { admin, createMember, emailFor, expectNoHorizontalScroll, insertJob, runId, signInUrl, watchErrors } from "./support";

const CRON_SECRET = process.env.CRON_SECRET ?? "e2e-cron-secret-for-local-tests-only";
const isoDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test("a forwarder builds a rate card and the quote opens already filled in from it", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "rate-card");
  const fwdEmail = emailFor("ratecard-fwd");
  await createMember(fwdEmail, { name: `E2E Rate Forwarder ${runId}`, role: "forwarder", trust: "verified" });
  const agent = await createMember(emailFor("ratecard-agent"), { name: `E2E Rate Agent ${runId}`, role: "agent", country: "China" });

  await page.goto(await signInUrl(fwdEmail));
  await page.goto("/lanes");
  await expect(page.getByRole("heading", { name: "My lanes" })).toBeVisible();
  await expect(page.getByText("No rate cards yet")).toBeVisible();

  // ---- Build the card in the app: three fixed charges, one cartage zone.
  await page.getByRole("link", { name: "New rate card" }).click();
  await expect(page.getByRole("heading", { name: "New rate card" })).toBeVisible();
  await page.locator("#name").fill(`Brisbane ${runId}`);
  await page.locator("#destinationPortId").selectOption({ label: "Brisbane (AUBNE)" });

  await page.locator("#charge-name-0").fill("Port service charge");
  await page.locator("#charge-basis-0").selectOption("per_40ft");
  await page.locator("#charge-amount-0").fill("165.00");

  await page.getByRole("button", { name: "Add a charge" }).click();
  await page.locator("#charge-name-1").fill("Customs entry");
  await page.locator("#charge-category-1").selectOption("customs");
  await page.locator("#charge-basis-1").selectOption("per_job");
  await page.locator("#charge-amount-1").fill("120.00");

  await page.getByRole("button", { name: "Add a charge" }).click();
  await page.locator("#charge-name-2").fill("Side-loader");
  await page.locator("#charge-category-2").selectOption("delivery");
  await page.locator("#charge-basis-2").selectOption("per_container");
  await page.locator("#charge-amount-2").fill("80.00");
  await page.locator("#charge-unload-2").selectOption("side_loader");

  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.locator("#zone-name-0").fill("Zone 1");
  await page.locator("#zone-from-0").fill("4000");
  await page.locator("#zone-to-0").fill("4100");
  await page.locator("#zone-amount-0").fill("560.00");
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  // A mistake is reported on the field and nothing is saved.
  await page.locator("#charge-amount-1").fill("abc");
  await page.getByRole("button", { name: "Save rate card" }).click();
  await expect(page.getByText("Enter an amount such as 165.00")).toBeVisible();
  await page.locator("#charge-amount-1").fill("120.00");
  await page.getByRole("button", { name: "Save rate card" }).click();
  await expect(page).toHaveURL(/\/lanes$/);
  await expect(page.getByText(`Brisbane ${runId}`)).toBeVisible();
  await expect(page.getByText("4 lines")).toBeVisible();

  // ---- A job arrives for that port: 2 x 40HC, all services, delivery to 4009, side-loader.
  const jobId = await insertJob(agent, { origin: "CNSZX", destination: "AUBNE" });
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByText(/Filled in from your rate card/)).toContainText("$1,730.00");
  // 2 x 165 + 120 + 2 x 560 + 2 x 80 = 1,730. Each line says where it came from.
  const sources = page.getByTestId("line-source");
  await expect(sources).toHaveCount(4);
  await expect(sources.nth(0)).toHaveText("Rate card");
  await expect(sources.nth(2)).toHaveText("Job says Side-loader");
  await expect(sources.nth(3)).toHaveText("Zone 1 · postcode 4009");
  await expect(page.locator("#amount-0")).toHaveValue("330.00");
  await expect(page.locator("#amount-2")).toHaveValue("160.00");
  await expect(page.locator("#amount-3")).toHaveValue("1120.00");
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  // Changing a pre-filled line marks it as edited, and nothing is sent until the forwarder taps Send.
  await page.locator("#amount-1").fill("130.00");
  await expect(sources.nth(1)).toHaveText("Rate card (edited)");
  await expect(page.getByRole("heading", { name: "Your quote" })).toHaveCount(0);
  await page.getByRole("button", { name: "Send sealed quote" }).click();
  await expect(page.getByRole("heading", { name: "Your quote" })).toBeVisible();
  await expect(page.getByText("$1,740.00").first()).toBeVisible();
  const saved = await admin.from("quote_lines").select("amount_minor").eq("quote_id", (await admin.from("quotes").select("id").eq("job_id", jobId).single()).data!.id);
  expect(saved.data?.map((l) => Number(l.amount_minor)).sort((a, b) => a - b)).toEqual([13000, 16000, 33000, 112000].sort((a, b) => a - b));

  // ---- A job to a port with no rate card opens with a blank form.
  const other = await insertJob(agent, { origin: "CNSZX", destination: "AUFRE" });
  await page.goto(`/jobs/${other}`);
  await expect(page.getByText(/Filled in from your rate card/)).toHaveCount(0);
  await expect(page.locator("#amount-0")).toHaveValue("");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a forwarder adds a lane alert and gets an instant alert when a matching job is posted", async ({ browser, page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "lane-alert");
  const fwdEmail = emailFor("lane-fwd");
  const fwd = await createMember(fwdEmail, { name: `E2E Lane Forwarder ${runId}`, role: "forwarder", trust: "verified" });
  const agentEmail = emailFor("lane-agent");
  const agentMember = await createMember(agentEmail, { name: `E2E Lane Agent ${runId}`, role: "agent", trust: "verified", country: "China" });

  await page.goto(await signInUrl(fwdEmail));
  await page.goto("/lanes");
  await page.getByText("Add a lane", { exact: true }).click();
  await page.locator("#origin").selectOption("country:China");
  await page.locator("#destinationPortId").selectOption({ label: "Brisbane (AUBNE)" });
  // The mode choices are styled toggles: click the visible label.
  await page.getByText("Sea, full container", { exact: true }).click();
  await page.getByRole("button", { name: "Save lane" }).click();
  // The new lane shows as a card (the same words are also an option in the add-lane dropdown).
  const laneCard = page.getByRole("listitem").filter({ hasText: "China (any port)" });
  await expect(laneCard).toBeVisible();
  await expect(laneCard.getByText(/No rate card for Brisbane yet/)).toBeVisible();
  const alert = await admin.from("lane_alerts").select("id, frequency, modes, origin_country").eq("company_id", fwd.companyId).single();
  expect(alert.data).toMatchObject({ frequency: "instant", modes: ["FCL"], origin_country: "China" });

  // The frequency switch works without leaving the page.
  await page.getByRole("button", { name: "Daily 7am" }).click();
  await expect.poll(async () => (await admin.from("lane_alerts").select("frequency").eq("id", alert.data!.id).single()).data?.frequency).toBe("daily");
  await page.getByRole("button", { name: "Instantly" }).click();
  await expect.poll(async () => (await admin.from("lane_alerts").select("frequency").eq("id", alert.data!.id).single()).data?.frequency).toBe("instant");
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  // A China agent posts a matching job through the quick form: the alert is recorded as sent.
  const ctx = await browser.newContext(test.info().project.use);
  const agentPage = await ctx.newPage();
  watchErrors(agentPage, errors, "agent");
  await agentPage.goto(await signInUrl(agentEmail));
  await agentPage.goto("/post");
  await agentPage.locator("#originPortId").fill("Shenzhen");
  await agentPage.getByRole("option", { name: /Shenzhen \(CNSZX\)/ }).click();
  await agentPage.locator("#destinationPortId").fill("Brisbane");
  await agentPage.getByRole("option", { name: /Brisbane \(AUBNE\)/ }).click();
  await agentPage.locator("#cargoDescription").fill(`E2E alert cargo ${runId}`);
  await agentPage.locator("#readyDate").fill(isoDate(10));
  await agentPage.getByRole("button", { name: "Post request" }).click();
  await expect(agentPage).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
  const jobId = new URL(agentPage.url()).pathname.split("/").pop()!;
  await ctx.close();

  // Other alerts left over from earlier runs may also match, so look at this company's alert only.
  const delivered = await admin.from("lane_alert_deliveries").select("alert_id, job_id").eq("alert_id", alert.data!.id);
  expect(delivered.data).toEqual([{ alert_id: alert.data!.id, job_id: jobId }]);

  // A job on a lane nobody watches records nothing.
  const quiet = await insertJob(agentMember, { origin: "CNSZX", destination: "AUFRE" });
  expect((await admin.from("lane_alert_deliveries").select("job_id").eq("alert_id", alert.data!.id).eq("job_id", quiet)).data).toEqual([]);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a forwarder uploads a rate card from a CSV, and a mistake is rejected with the row number", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "upload");
  const email = emailFor("upload-fwd");
  await createMember(email, { name: `E2E Upload Forwarder ${runId}`, role: "forwarder" });
  await page.goto(await signInUrl(email));

  // The template downloads and reads back cleanly.
  const template = await page.request.get("/lanes/rate-cards/template");
  expect(template.status()).toBe(200);
  expect(template.headers()["content-type"]).toContain("text/csv");
  const csvText = await template.text();
  expect(csvText.startsWith("type,name,category,basis,amount")).toBe(true);

  await page.goto("/lanes/rate-cards/upload");
  await expect(page.getByRole("heading", { name: "Upload a rate card" })).toBeVisible();
  const fill = async (name: string) => {
    await page.locator("#name").fill(name);
    await page.locator("#destinationPortId").selectOption({ label: "Sydney (Port Botany) (AUSYD)" });
  };

  // One bad row rejects the whole file and says which row.
  await fill(`Bad sheet ${runId}`);
  const bad = csvText.replace("per_40ft", "per_banana");
  await page.setInputFiles("#file", { name: "rates.csv", mimeType: "text/csv", buffer: Buffer.from(bad) });
  await page.getByRole("button", { name: "Upload rate card" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Row 2" })).toBeVisible();
  await expect(page).toHaveURL(/\/upload$/);
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  // A spreadsheet that was not saved as CSV is explained, not guessed at.
  await page.setInputFiles("#file", { name: "rates.xlsx", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("not csv") });
  await page.getByRole("button", { name: "Upload rate card" }).click();
  await expect(page.getByText(/Save the spreadsheet as CSV/)).toBeVisible();

  // The good template uploads and appears on My lanes.
  await page.setInputFiles("#file", { name: "rates.csv", mimeType: "text/csv", buffer: Buffer.from(csvText) });
  await page.getByRole("button", { name: "Upload rate card" }).click();
  await expect(page).toHaveURL(/\/lanes$/);
  await expect(page.getByText(`Bad sheet ${runId}`)).toBeVisible();
  await expect(page.getByText("7 lines")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the daily summary needs the secret, sends one email per person and never repeats", async ({ page, request }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "digest");
  const fwd = await createMember(emailFor("digest-fwd"), { name: `E2E Digest Forwarder ${runId}`, role: "forwarder", trust: "verified" });
  const agent = await createMember(emailFor("digest-agent"), { name: `E2E Digest Agent ${runId}`, role: "agent", country: "China" });
  // Darwin: no other test uses it. The alert matches every open Darwin job from the last 3 days, ours included.
  const port = await admin.from("ports").select("id").eq("code", "AUDRW").single();
  const alert = await admin
    .from("lane_alerts")
    .insert({ company_id: fwd.companyId, created_by: fwd.userId, destination_port_id: port.data!.id, frequency: "daily" })
    .select("id")
    .single();
  expect(alert.error).toBeNull();
  const job = await insertJob(agent, { origin: "CNSZX", destination: "AUDRW" });

  // The endpoint refuses callers without the secret.
  const open = await request.get("/api/cron/lane-digest?any=1");
  expect(open.status(), "CRON_SECRET must be set for the dev server (see .env.example)").toBe(401);
  const wrong = await request.get("/api/cron/lane-digest?any=1", { headers: { authorization: "Bearer not-the-secret-not-the-secret" } });
  expect(wrong.status()).toBe(401);

  const headers = { authorization: `Bearer ${CRON_SECRET}` };
  const first = await request.get("/api/cron/lane-digest?any=1", { headers });
  expect(first.status()).toBe(200);
  expect((await first.json()).people).toBeGreaterThanOrEqual(1);
  const sent = await admin.from("lane_alert_deliveries").select("job_id").eq("alert_id", alert.data!.id);
  expect(sent.data).toEqual(expect.arrayContaining([{ job_id: job }]));
  const sentCount = sent.data!.length;

  // Running it again sends nothing.
  const second = await request.get("/api/cron/lane-digest?any=1", { headers });
  expect(await second.json()).toEqual({ people: 0, jobs: 0 });
  expect((await admin.from("lane_alert_deliveries").select("job_id").eq("alert_id", alert.data!.id)).data).toHaveLength(sentCount);

  // Outside 7am Sydney it does nothing, even with the secret.
  const timed = await request.get("/api/cron/lane-digest", { headers });
  const body = await timed.json();
  expect(timed.status()).toBe(200);
  expect(body.people === 0 || "skipped" in body).toBe(true);
  expect(errors, errors.join("\n")).toEqual([]);
});
