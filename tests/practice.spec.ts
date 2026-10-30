import { expect, test, type Page } from "@playwright/test";

// The practice screen is tested with fake API replies, so these tests use no AI calls and no database rows.
const DOC_ID = "00000000-0000-4000-8000-000000000001";
const QUESTION_ID = "00000000-0000-4000-8000-0000000000a1";

const question = {
  id: QUESTION_ID,
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
  hint: "Think about what animals breathe out.",
  max_score: 1,
};

async function mockApi(page: Page) {
  await page.route(/\/api\/documents\/[^/]+\/questions/, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { questions: [question] } });
    // No more questions to make after the first one.
    return route.fulfill({ json: { questions: [], done: true } });
  });

  await page.route("**/api/attempts", async (route) => {
    const { answer } = route.request().postDataJSON();
    const isCorrect = answer === "B";
    return route.fulfill({
      json: {
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1,
        correctAnswer: "B",
        reasoning: "Plants take in carbon dioxide and release oxygen.",
        missedPoints: [],
        rubric: [],
        sourceQuote: "Plants absorb carbon dioxide from the air.",
        sourceContext: { before: "Plants absorb ", match: "carbon dioxide", after: " from the air." },
        options: question.options,
      },
    });
  });

  await page.route("**/api/videos?*", (route) => route.fulfill({ json: { topic: "Photosynthesis", videos: [] } }));
  await page.route("**/api/questions/*/report", (route) => route.fulfill({ json: { ok: true } }));
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto(`/practice/${DOC_ID}?type=mcq&difficulty=medium`);
  await expect(page.getByText(question.prompt)).toBeVisible();
});

test("shows the question as a card with its options", async ({ page }) => {
  await expect(page.getByText("Card 1")).toBeVisible();
  for (const o of question.options) await expect(page.getByText(o.text, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check answer" })).toBeDisabled();
});

test("the hint stays hidden until it is asked for", async ({ page }) => {
  await expect(page.getByText(question.hint)).toBeHidden();
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByText(question.hint)).toBeVisible();
});

test("a right answer is marked correct", async ({ page }) => {
  await page.getByText("Carbon dioxide", { exact: true }).click();
  await page.getByRole("button", { name: "Check answer" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Correct" })).toBeVisible();
  await expect(page.getByText("1 of 1 mark")).toBeVisible();
});

test("a wrong answer shows the right one and the passage from the notes", async ({ page }) => {
  await page.getByText("Oxygen", { exact: true }).click();
  await page.getByRole("button", { name: "Check answer" }).click();

  await expect(page.getByText("Not quite")).toBeVisible();
  await expect(page.getByText("Plants take in carbon dioxide and release oxygen.")).toBeVisible();
  await expect(page.locator("mark")).toHaveText("carbon dioxide");
});

test("a question can be reported once", async ({ page }) => {
  await page.getByText("Carbon dioxide", { exact: true }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Report this question" }).click();

  await expect(page.getByRole("button", { name: "Reported" })).toBeDisabled();
});

test("a question can be skipped without answering", async ({ page }) => {
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(page.getByRole("heading", { name: "You have covered everything here" })).toBeVisible();
});

test("after the last question it says everything is covered", async ({ page }) => {
  await page.getByText("Carbon dioxide", { exact: true }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Next question" }).click();

  await expect(page.getByRole("heading", { name: "You have covered everything here" })).toBeVisible();
});

test("keys choose an option and check the answer", async ({ page }) => {
  await page.keyboard.press("2");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status").filter({ hasText: "Correct" })).toBeVisible();
  await expect(page.getByText("1 right")).toBeVisible();
});
