import { expect, test, type Page } from "@playwright/test";
import { admin, chooseMode, expectNoHorizontalScroll, runId, signInUrl, watchErrors } from "./support";

// Seeded demo companies (local database only):
//   agent@demo.test  Shenzhen Star Logistics, Verified agent: posts the Shenzhen and Ningbo jobs.
//   fwd1@demo.test   Harbour Freight, Verified forwarder: posted the Sydney to Singapore reefer job
//                    and quoted on the Shenzhen to Melbourne job, so it works on both sides.

async function switchTo(page: Page, mode: "Requester" | "Quoter") {
  await page.getByRole("radio", { name: mode }).click();
  await expect(page.getByRole("radio", { name: mode })).toHaveAttribute("aria-checked", "true");
}

test("a job with a very long cargo description does not widen the board on a phone", async ({ page }) => {
  // Posted by the seeded Basic agent, so it shows on the Verified forwarder's board.
  const ports = await admin.from("ports").select("id, code").in("code", ["CNNGB", "AUMEL"]);
  const id = (code: string) => ports.data?.find((p) => p.code === code)?.id;
  const cargo = `E2E long ${runId}: ${"palletised flat-pack furniture and homewares with mixed cartons ".repeat(4)}`;
  const { error } = await admin.from("jobs").insert({
    company_id: "c0000000-0000-4000-8000-000000000003",
    created_by: "a0000000-0000-4000-8000-000000000003",
    direction: "import",
    incoterm: "CIF",
    mode: "FCL",
    origin_port_id: id("CNNGB"),
    destination_port_id: id("AUMEL"),
    container_type: "40HC",
    container_qty: 2,
    cargo_description: cargo,
    ready_date: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
    services: ["destination_charges"],
    deadline_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  });
  expect(error).toBeNull();

  await page.goto(await signInUrl("fwd1@demo.test"));
  await expect(page).toHaveURL(/\/jobs$/);
  await chooseMode(page, "quoter");
  await expect(page.getByText(`E2E long ${runId}`).first()).toBeAttached();
  expect(await expectNoHorizontalScroll(page)).toBe(0);
});

test("everyone starts on the same screen, picks Requester, switches to Quoter and the choice persists", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "agent");
  await page.goto(await signInUrl("agent@demo.test"));
  await expect(page).toHaveURL(/\/jobs$/);

  // Nobody is sorted by company type: the first screen asks what they want to do.
  await expect(page.getByRole("heading", { name: "What would you like to do?" })).toBeVisible();
  await expect(page.getByTestId("choose-requester")).toBeVisible();
  await expect(page.getByTestId("choose-quoter")).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(0);
  await page.getByTestId("choose-requester").click();

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(page.getByRole("radio", { name: "Requester" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("My requests · Requester mode")).toBeVisible();
  await expect(nav.getByRole("link", { name: "Request quote" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "My quotes" })).toHaveCount(0);
  await expect(page.getByText("Flat-pack timber furniture, palletised").first()).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  await switchTo(page, "Quoter");
  await expect(page.getByText("Job board · Quoter mode")).toBeVisible();
  await expect(nav.getByRole("link", { name: "My quotes" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Request quote" })).toHaveCount(0);
  // Its own jobs never appear on the board it quotes on.
  await expect(page.getByText("Flat-pack timber furniture, palletised")).toHaveCount(0);
  await expect(page.getByText("Chilled beef, boxed")).toBeVisible();
  // Cards show the route map, the scope and the competition band.
  await expect(page.getByRole("img", { name: /Route map: Sydney to Singapore/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Competition:/ }).first()).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  await page.reload();
  await expect(page.getByRole("radio", { name: "Quoter" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Job board · Quoter mode")).toBeVisible();

  // The old dashboard link lands on the jobs page.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/jobs$/);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a forwarder can pick Quoter, and sees only its own jobs as a Requester", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "forwarder");
  await page.goto(await signInUrl("fwd1@demo.test"));
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole("heading", { name: "What would you like to do?" })).toBeVisible();
  await page.getByTestId("choose-quoter").click();
  await expect(page.getByRole("radio", { name: "Quoter" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Flat-pack timber furniture, palletised").first()).toBeVisible();

  // A company that has both posted and quoted sees different data on each side.
  await page.goto("/quotes");
  await expect(page.getByRole("heading", { name: "My quotes" })).toBeVisible();
  await expect(page.getByText("Shenzhen to Melbourne").first()).toBeVisible();

  await page.goto("/jobs");
  await switchTo(page, "Requester");
  await expect(page.getByText("My requests · Requester mode")).toBeVisible();
  await expect(page.getByText("Chilled beef, boxed")).toBeVisible();
  await expect(page.getByText("Flat-pack timber furniture, palletised")).toHaveCount(0);
  expect(await expectNoHorizontalScroll(page)).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the admin sees marketplace health on the admin page with counts only", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "admin");
  await page.goto(await signInUrl("admin@southbound.test"));
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Marketplace health" })).toBeVisible();
  await expect(page.getByTestId("marketplace-kpis")).toContainText("Jobs that got a quote");
  await expect(page.getByTestId("marketplace-kpis")).toContainText("Verified companies");
  await expect(page.getByRole("heading", { name: "Verification queue" })).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});
