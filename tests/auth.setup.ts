import { expect, test as setup } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

// Signs in once and saves the session so the other tests start signed in.
setup("sign in with the test account", async ({ page }) => {
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in tests/.env.test (the name starts with a dot). See tests/env.test.example.");
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: "tests/.auth/user.json" });
});
