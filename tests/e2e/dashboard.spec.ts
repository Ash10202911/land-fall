import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, signInUrl, watchErrors } from "./support";

const errors: string[] = [];

test("a member sees the dashboard on a phone with no horizontal scroll", async ({ page }) => {
  watchErrors(page, errors, "member");
  // Seeded Verified demo agent (local database only).
  await page.goto(await signInUrl("agent@demo.test"));
  await expect(page).toHaveURL(/\/jobs$/);

  // The tab bar reaches the dashboard.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  for (const name of ["Needs attention", "Your quotes", "Your jobs", "Where the demand is"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  // A non-admin never sees the marketplace section.
  await expect(page.getByRole("heading", { name: "Marketplace health" })).toHaveCount(0);
  expect(await expectNoHorizontalScroll(page)).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the admin sees marketplace health with counts only", async ({ page }) => {
  const adminErrors: string[] = [];
  watchErrors(page, adminErrors, "admin");
  await page.goto(await signInUrl("admin@southbound.test"));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Marketplace health" })).toBeVisible();
  await expect(page.getByTestId("marketplace-kpis")).toContainText("Jobs that got a quote");
  await expect(page.getByTestId("marketplace-kpis")).toContainText("Verified companies");
  await expect(page.getByRole("heading", { name: "Verification queue" })).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(0);
  expect(adminErrors, adminErrors.join("\n")).toEqual([]);
});
