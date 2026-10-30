import { expect, test } from "@playwright/test";

// Phone width: the sidebar is replaced by a tab bar at the bottom.
test("the tab bar is used instead of the sidebar", async ({ page }) => {
  await page.goto("/dashboard");

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  for (const name of ["Dashboard", "Documents", "Review", "Mock test", "Stats"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }

  await nav.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByRole("heading", { name: "Stats", level: 1 })).toBeVisible();
});

test("the page does not scroll sideways", async ({ page }) => {
  for (const path of ["/dashboard", "/documents", "/mock", "/stats"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} is wider than the screen`).toBeLessThanOrEqual(0);
  }
});

test("a phone can log out from the top bar", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});
