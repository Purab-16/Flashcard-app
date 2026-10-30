import { expect, test } from "@playwright/test";

// These tests really use the test account: they add a subject and a small text document.
// A text file needs no AI call, so reading it costs nothing.
test("a new subject can be added and chosen for an upload", async ({ page }) => {
  const name = `E2E subject ${Date.now()}`;

  await page.goto("/documents");
  await page.getByLabel("New subject name").fill(name);
  await page.getByRole("button", { name: "Add subject" }).click();

  await expect(page.getByLabel("Subject", { exact: true }).getByRole("option", { name })).toBeAttached();
});

test("a text file is uploaded, read and ready to practice", async ({ page }) => {
  const title = `e2e-notes-${Date.now()}`;
  const text = [
    "Photosynthesis is the process plants use to turn light into chemical energy.",
    "Chlorophyll in the leaves absorbs sunlight and starts the whole reaction.",
    "Plants take in carbon dioxide from the air and release oxygen as a by-product.",
    "The sugar made during photosynthesis is stored as starch for later use by the plant.",
  ].join(" ");

  await page.goto("/documents");
  await page.getByLabel("Choose a file").setInputFiles({
    name: `${title}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await page.getByRole("button", { name: "Upload and read" }).click();

  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row.getByText("Ready")).toBeVisible();
  await expect(row.getByRole("button", { name: "Practice" })).toBeVisible();
});

test("an upload with no file explains what to do", async ({ page }) => {
  await page.goto("/documents");
  await page.getByRole("button", { name: "Upload and read" }).click();

  await expect(page.getByText("Choose a file first.")).toBeVisible();
});

test("a document can be removed after a confirmation", async ({ page }) => {
  const title = `e2e-remove-${Date.now()}`;
  const text =
    "Mitochondria produce most of the energy a cell needs to work properly. " +
    "They do this by breaking down sugar in a process called cellular respiration.";

  await page.goto("/documents");
  await page.getByLabel("Choose a file").setInputFiles({
    name: `${title}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await page.getByRole("button", { name: "Upload and read" }).click();

  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row.getByText("Ready")).toBeVisible({ timeout: 30_000 });

  await row.getByRole("button", { name: `Remove ${title}` }).click();
  await expect(row.getByRole("alert")).toContainText("Remove this document");
  await row.getByRole("button", { name: "Yes, remove" }).click();

  await expect(row).toHaveCount(0);
});
