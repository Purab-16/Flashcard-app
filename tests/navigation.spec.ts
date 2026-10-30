import { expect, test } from "@playwright/test";

const PAGES = [
  { link: "Documents", heading: "Documents", url: /\/documents/ },
  { link: "Mock test", heading: "Mock test", url: /\/mock/ },
  { link: "Stats", heading: "Stats", url: /\/stats/ },
  { link: "Review", heading: "Review", url: /\/review/ },
  { link: "Dashboard", heading: "Today", url: /\/dashboard/ },
];

test("the sidebar reaches every page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  for (const p of PAGES) {
    await nav.getByRole("link", { name: p.link }).click();
    await expect(page).toHaveURL(p.url);
    await expect(page.getByRole("heading", { name: p.heading, level: 1 })).toBeVisible();
  }
});

test("the active page is marked in the sidebar", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Stats" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
