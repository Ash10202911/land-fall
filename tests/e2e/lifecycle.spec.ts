import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, signInUrl, watchErrors } from "./support";

const errors: string[] = [];
const isoDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test("requester repeats a job, edits it, extends the deadline and cancels it", async ({ page }) => {
  watchErrors(page, errors, "requester");
  // Seeded Verified demo agent (local database only).
  await page.goto(await signInUrl("agent@demo.test"));
  await expect(page).toHaveURL(/\/jobs$/);

  // Repeat last job pre-fills the form from the company's most recent job.
  await page.goto("/post");
  await page.getByRole("link", { name: "Repeat last job" }).click();
  await expect(page.getByText("Filled in from your last job")).toBeVisible();
  await expect(page.locator("#cargoDescription")).not.toHaveValue("");
  expect(await expectNoHorizontalScroll(page)).toBe(0);

  const cargo = `E2E lifecycle ${Date.now()}`;
  await page.locator("#cargoDescription").fill(cargo);
  await page.locator("#readyDate").fill(isoDate(10));
  await page.getByRole("button", { name: /Defaults/ }).click();
  await page.getByRole("button", { name: "Pick a date" }).click();
  await page.locator("#deadlineDate").fill(isoDate(3));
  await page.getByRole("button", { name: "Post request" }).click();
  await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
  const jobPath = new URL(page.url()).pathname;
  await expect(page.getByText("Open for quotes")).toBeVisible();

  // Edit: notes change and the deadline can only be extended.
  await page.getByRole("link", { name: "Edit job" }).click();
  await expect(page.getByRole("heading", { name: "Edit job" })).toBeVisible();
  await page.locator("#notes").fill("Updated by the poster");
  await page.locator("#deadlineDate").fill(isoDate(1));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("The deadline can only be extended")).toBeVisible();
  await page.locator("#deadlineDate").fill(isoDate(6));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`${jobPath}$`));
  await expect(page.getByText("Updated by the poster")).toBeVisible();

  // Cancel with a two-step confirm.
  await page.getByRole("button", { name: "Cancel job" }).click();
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await expect(page.getByText("The requester cancelled this job")).toBeVisible();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit job" })).toHaveCount(0);

  expect(errors, errors.join("\n")).toEqual([]);
});
