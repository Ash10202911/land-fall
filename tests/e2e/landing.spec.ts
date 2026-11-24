import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, watchErrors } from "./support";

test("the sign-in page is the CargoTribe landing page: sign-in up front, and the demos respond to taps", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "visitor");
  await page.goto("/sign-in");

  // The pitch and the way in are on the first screen.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Freight's easier with friends");
  await expect(page.getByRole("img", { name: "CargoTribe" }).first()).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join the tribe" }).first()).toBeVisible();

  // "A day on CargoTribe": tapping a step changes the story and the screen.
  await page.getByRole("tab", { name: "Mei compares" }).click();
  await expect(page.getByText("One glance shows who covers what.")).toBeVisible();
  await expect(page.getByText("Lowest complete quote").first()).toBeVisible();
  await page.getByRole("tab", { name: "Awarded. Now talk." }).click();
  await expect(page.getByText("Dan Whitfield")).toBeVisible();

  // The mess it replaces: flip to the tidy version.
  await page.getByRole("button", { name: "On CargoTribe" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "On CargoTribe" }).click();
  await expect(page.getByText("Does not include: Delivery").first()).toBeVisible();

  // Real recordings: choose one, it loads with its poster and plays on request.
  await page.getByRole("tab", { name: "Quote fast" }).scrollIntoViewIfNeeded();
  await page.getByRole("tab", { name: "Quote fast" }).click();
  await expect(page.getByRole("heading", { name: "Your rate card does the typing." })).toBeVisible();
  const video = page.locator("video[aria-label^='Screen recording']");
  await expect(video).toHaveAttribute("src", /video-quote\.webm/);
  for (const file of ["video-post", "video-compare", "video-quote"]) {
    const res = await page.request.get(`/marketing/${file}.webm`);
    expect(res.status(), file).toBe(200);
  }

  // Pick a lane and see the email a forwarder would get.
  await page.getByRole("button", { name: "Europe" }).first().scrollIntoViewIfNeeded();
  await page.getByRole("group", { name: "Origin country" }).getByRole("button", { name: "Europe" }).click();
  await page.getByRole("group", { name: "Destination port" }).getByRole("button", { name: "New Zealand" }).click();
  await expect(page.getByText("New job on your lane: Europe to New Zealand")).toBeVisible();

  // The closing button takes the visitor back to the form.
  await page.getByRole("link", { name: "Join the tribe" }).click();
  await expect(page.locator("#sign-in")).toBeInViewport();
  expect(await expectNoHorizontalScroll(page)).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});
