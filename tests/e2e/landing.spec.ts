import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, watchErrors } from "./support";

test("the sign-in page is the CargoTribe landing page, with the sign-in form up front and no sideways scroll", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors, "visitor");
  await page.goto("/sign-in");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("freight agents and forwarders");
  await expect(page.getByRole("img", { name: "CargoTribe" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in or join" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();

  // The portal screens load, and the page sells the product with facts, not numbers.
  for (const name of [/job board on a phone/, /Two sealed quotes side by side/, /filled in from a saved rate card/]) {
    const img = page.getByRole("img", { name });
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await expect(page.getByText("One tribe, two sides of the same shipment")).toBeVisible();

  // The closing button takes the visitor back to the form.
  await page.getByRole("link", { name: "Sign in or join" }).click();
  await expect(page.locator("#sign-in")).toBeInViewport();
  expect(await expectNoHorizontalScroll(page)).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});
