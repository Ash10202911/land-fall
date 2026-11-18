import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createAdminUser, emailFor, expectNoHorizontalScroll, runId, signInUrl, watchErrors } from "./support";

const errors: string[] = [];
const AGENT = `E2E Agent ${runId}`;
const WINNER = `E2E Winner ${runId}`;
const LOSER = `E2E Loser ${runId}`;
const CARGO = `E2E cargo ${runId}: ceramic tiles`;

const isoDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function newUser(browser: Browser, label: string) {
  const context = await browser.newContext(test.info().project.use);
  const page = await context.newPage();
  watchErrors(page, errors, label);
  return { context, page };
}

async function signIn(page: Page, email: string) {
  await page.goto(await signInUrl(email));
}

async function onboard(page: Page, company: string, country: string, role: "agent" | "forwarder") {
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Company name").fill(company);
  await page.getByLabel("Country").fill(country);
  await page.getByLabel("Your company is a").selectOption(role);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
}

async function sendQuote(page: Page, jobUrl: string, charge: string, amount: string) {
  await page.goto(jobUrl);
  await page.locator("#charge-0").fill(charge);
  await page.locator("#amount-0").fill(amount);
  await page.getByRole("button", { name: "Send sealed quote" }).click();
  await expect(page.getByRole("heading", { name: "Your quote" })).toBeVisible();
}

test("agent posts, forwarders quote, admin verifies, agent awards, only winner sees contacts", async ({ browser }) => {
  // ---- Sign-in redirect for a signed-out visitor
  const visitor = await newUser(browser, "visitor");
  await visitor.page.goto("/jobs");
  await expect(visitor.page).toHaveURL(/\/sign-in/);
  await expect(visitor.page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  await visitor.context.close();

  // ---- Agent signs in, onboards (company starts Basic) and posts a job on a phone
  const agent = await newUser(browser, "agent");
  await signIn(agent.page, emailFor("agent"));
  await onboard(agent.page, AGENT, "China", "agent");
  await expect(agent.page.getByRole("navigation", { name: "Main" })).toBeVisible(); // bottom tab bar
  expect(await expectNoHorizontalScroll(agent.page)).toBe(0);

  await agent.page.getByRole("link", { name: "Post", exact: true }).click();
  await expect(agent.page.getByRole("heading", { name: "Post a job" })).toBeVisible();

  // a past deadline is rejected with a clear error
  await agent.page.locator("#originPortId").fill("Shenzhen");
  await agent.page.getByRole("option", { name: /Shenzhen \(CNSZX\)/ }).click();
  await agent.page.locator("#destinationPortId").fill("Melbourne");
  await agent.page.getByRole("option", { name: /Melbourne \(AUMEL\)/ }).click();
  await agent.page.locator("#cargoDescription").fill(CARGO);
  await agent.page.locator("#readyDate").fill(isoDate(10));
  await agent.page.locator("#deadlineDate").fill(isoDate(-2));
  await agent.page.getByRole("button", { name: "Post job" }).click();
  await expect(agent.page.getByText("The quote deadline must be in the future")).toBeVisible();
  expect(await expectNoHorizontalScroll(agent.page)).toBe(0);

  await agent.page.locator("#deadlineDate").fill(isoDate(3));
  await agent.page.getByRole("button", { name: "Post job" }).click();
  await expect(agent.page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
  const jobUrl = new URL(agent.page.url()).pathname;
  await expect(agent.page.getByRole("heading", { name: "Shenzhen to Melbourne" })).toBeVisible();
  await expect(agent.page.getByText("Your job")).toBeVisible();

  // the poster's own job is hidden from the open feed
  await agent.page.goto("/jobs");
  await expect(agent.page.getByText(CARGO)).toHaveCount(0);

  // ---- Two forwarders find the job in the feed and send sealed quotes
  const winner = await newUser(browser, "winner");
  await signIn(winner.page, emailFor("winner"));
  await onboard(winner.page, WINNER, "Australia", "forwarder");

  const loser = await newUser(browser, "loser");
  await signIn(loser.page, emailFor("loser"));
  await onboard(loser.page, LOSER, "New Zealand", "forwarder");

  await winner.page.goto("/jobs");
  await expect(winner.page.getByText(CARGO)).toBeVisible();
  // no open job goes to Hobart, so this filter shows the empty state
  await winner.page.locator('select[name="dest"]').selectOption({ label: "Hobart (AUHBA)" });
  await winner.page.getByRole("button", { name: "Filter" }).click();
  await expect(winner.page.getByText("No jobs match those filters")).toBeVisible(); // empty state
  await winner.page.goto("/jobs?mode=FCL");
  await expect(winner.page.getByText(CARGO)).toBeVisible();

  await sendQuote(winner.page, jobUrl, "Destination charges", "1234.50");
  await expect(winner.page.getByText("$1,234.50").first()).toBeVisible();
  await sendQuote(loser.page, jobUrl, "All-in destination", "999.00");

  // quotes are sealed: the second forwarder only ever sees their own quote
  await expect(loser.page.getByText("$999.00").first()).toBeVisible();
  await expect(loser.page.getByText("$1,234.50")).toHaveCount(0);
  await loser.page.goto("/quotes");
  await expect(loser.page.getByText("Shenzhen to Melbourne")).toBeVisible();
  await expect(loser.page.getByText("Sent")).toBeVisible();

  // ---- Agent compares quotes but cannot award while Basic
  await agent.page.goto(jobUrl);
  await expect(agent.page.getByRole("heading", { name: "Quotes (2)" })).toBeVisible();
  await expect(agent.page.getByText(WINNER)).toBeVisible();
  await expect(agent.page.getByText(LOSER)).toBeVisible();
  await expect(agent.page.getByText("Get verified to award")).toBeVisible();
  await expect(agent.page.getByRole("button", { name: /^Award to/ })).toHaveCount(0);
  await expect(agent.page.getByText("Unverified").first()).toBeVisible();
  await agent.page.getByText("Show line items").first().click();
  expect(await expectNoHorizontalScroll(agent.page)).toBe(0);

  // non-admins get a 404 on /admin
  const notFound = await agent.page.request.get("/admin");
  expect(notFound.status()).toBe(404);

  // ---- Admin verifies the agent's company
  const founder = await newUser(browser, "admin");
  const adminEmail = emailFor("admin");
  await createAdminUser(adminEmail);
  await signIn(founder.page, adminEmail);
  await founder.page.goto("/admin");
  await expect(founder.page.getByRole("heading", { name: "Admin: companies" })).toBeVisible();
  const agentCard = founder.page.getByTestId(`company-${AGENT}`);
  await expect(agentCard.getByText("Basic")).toBeVisible();
  await agentCard.getByRole("button", { name: "Verify" }).click();
  await expect(agentCard.getByText("Verified")).toBeVisible();
  expect(await expectNoHorizontalScroll(founder.page)).toBe(0);

  // ---- Agent awards the winner (two-step confirm)
  await agent.page.goto(jobUrl);
  await expect(agent.page.getByText("Get verified to award")).toHaveCount(0);
  await agent.page.getByRole("button", { name: `Award to ${WINNER}` }).click();
  await agent.page.getByRole("button", { name: "Confirm award" }).click();
  await expect(agent.page.getByRole("heading", { name: "Contact details" })).toBeVisible();
  await expect(agent.page.getByText("Never change bank details based on a message.")).toBeVisible();
  await expect(agent.page.getByText(emailFor("winner"))).toBeVisible();
  await expect(agent.page.getByText("Awarded", { exact: true })).toBeVisible();

  // ---- Winner sees the poster's contact details; the loser sees none
  await winner.page.goto(jobUrl);
  await expect(winner.page.getByRole("heading", { name: "Contact details" })).toBeVisible();
  await expect(winner.page.getByText(emailFor("agent"))).toBeVisible();
  await expect(winner.page.getByText("Never change bank details based on a message.")).toBeVisible();
  await expect(winner.page.getByText("Won").first()).toBeVisible();

  await loser.page.goto(jobUrl);
  await expect(loser.page.getByRole("heading", { name: "Contact details" })).toHaveCount(0);
  await expect(loser.page.getByText(emailFor("agent"))).toHaveCount(0);
  await expect(loser.page.getByText(emailFor("winner"))).toHaveCount(0);
  await loser.page.goto("/quotes");
  await expect(loser.page.getByText("Lost")).toBeVisible();

  // ---- The database agrees: loser cannot read the poster's profile even by direct query
  const dbJob = await admin.from("jobs").select("status").eq("company_id", (await admin.from("companies").select("id").eq("name", AGENT).single()).data!.id).single();
  expect(dbJob.data?.status).toBe("awarded");

  // ---- No browser console errors anywhere in the journey
  expect(errors, errors.join("\n")).toEqual([]);

  await Promise.all([agent, winner, loser, founder].map((u) => u.context.close()));
});
