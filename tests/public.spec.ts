import { expect, test } from "@playwright/test";

// Signed out. No account needed.
test.describe("signed out", () => {
  test("private pages send you to the login page", async ({ page }) => {
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("a wrong password shows an error and stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("not-the-password-1");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText(/invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the signup page asks for a password of at least 8 characters", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Create one" }).click();

    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });
});
