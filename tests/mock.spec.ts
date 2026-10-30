import { expect, test } from "@playwright/test";

const SESSION_ID = "00000000-0000-4000-8000-0000000000b1";

const questions = [
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    type: "mcq",
    difficulty: "medium",
    topic: "Photosynthesis",
    prompt: "Which gas do plants take in for photosynthesis?",
    options: [
      { key: "A", text: "Oxygen" },
      { key: "B", text: "Carbon dioxide" },
      { key: "C", text: "Nitrogen" },
      { key: "D", text: "Helium" },
    ],
    max_score: 1,
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    type: "short",
    difficulty: "medium",
    topic: "Photosynthesis",
    prompt: "Where in the leaf does photosynthesis start?",
    options: null,
    max_score: 3,
  },
];

test("the setup page asks for the material before starting", async ({ page }) => {
  await page.goto("/mock");
  await expect(page.getByRole("heading", { name: "Mock test", level: 1 })).toBeVisible();

  const start = page.getByRole("button", { name: "Start test" });
  // An account with no ready document sees a hint instead of the form.
  test.skip(!(await start.isVisible()), "The test account has no ready document yet.");

  await start.click();
  await expect(page.getByText("Choose a document or subject.")).toBeVisible();
});

test.describe("a running test", () => {
  test.beforeEach(async ({ page }) => {
    // A running test lives in sessionStorage, so it can be set up without any AI or database.
    await page.addInitScript(
      ({ id, qs }) => {
        // This script runs again on a reload. Only set the test if it is not there yet, so saved answers stay.
        const key = `mock:${id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, JSON.stringify({ questions: qs, endsAt: Date.now() + 10 * 60_000, answers: {} }));
      },
      { id: SESSION_ID, qs: questions },
    );
    await page.route("**/api/mock/*/grade", (route) => route.fulfill({ json: { ok: true } }));
    await page.route("**/api/mock/*/finish", (route) => route.fulfill({ json: { ok: true } }));
    await page.goto(`/mock/${SESSION_ID}`);
  });

  test("shows the timer, the question and no answers", async ({ page }) => {
    await expect(page.getByRole("timer")).toContainText(/\d+:\d{2}/);
    await expect(page.getByText(questions[0].prompt)).toBeVisible();
    await expect(page.getByText("Correct answer")).toBeHidden();
  });

  test("answered questions are counted and can be jumped to", async ({ page }) => {
    await page.getByText("Carbon dioxide", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Submit test (1 of 2 answered)" })).toBeVisible();

    await page.getByRole("button", { name: "Question 2" }).click();
    await expect(page.getByText(questions[1].prompt)).toBeVisible();
    await page.getByLabel("Your answer").fill("In the chloroplasts.");
    await expect(page.getByRole("button", { name: "Submit test (2 of 2 answered)" })).toBeVisible();
  });

  test("answers survive a reload", async ({ page }) => {
    await page.getByText("Carbon dioxide", { exact: true }).click();
    await page.reload();

    await expect(page.getByRole("button", { name: "Submit test (1 of 2 answered)" })).toBeVisible();
  });

  test("submitting opens the report", async ({ page }) => {
    await page.getByText("Carbon dioxide", { exact: true }).click();
    await page.getByRole("button", { name: /Submit test/ }).click();

    await expect(page).toHaveURL(new RegExp(`/mock/${SESSION_ID}/report`));
  });
});
