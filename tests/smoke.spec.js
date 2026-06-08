const { test, expect } = require("@playwright/test");

const sampleWords = [
  word("smoke-test-word", "tu kiem thu", "test", 0),
  word("alpha", "mot", "test", 1),
  word("bravo", "hai", "test", 2),
  word("charlie", "ba", "test", 3)
];

const reviewWords = [
  {
    ...word("review-one", "on tap mot", "review", 10),
    stats: {
      seen: 2,
      correct: 1,
      wrong: 1,
      streak: 0,
      bestStreak: 1,
      masteryLevel: 1,
      lastReviewed: new Date(Date.now() - 86400000).toISOString(),
      nextReview: new Date(Date.now() - 86400000).toISOString()
    }
  },
  ...sampleWords.slice(1)
];

function word(eng, vie, tag, index) {
  return {
    id: index + 1,
    eng,
    vie,
    pos: "n",
    tag,
    level: "A1",
    favorite: false,
    mastered: false,
    stats: {
      seen: 0,
      correct: 0,
      wrong: 0,
      streak: 0,
      bestStreak: 0,
      masteryLevel: 0,
      lastReviewed: "",
      nextReview: ""
    }
  };
}

async function preparePage(page, options = {}) {
  const fatalConsole = [];
  const syncBodies = [];
  const profile = options.profile || {
    name: "Smoke Tester",
    email: "",
    avatar: "images/icon.png"
  };
  const accountId = String(profile.email || "").trim().toLowerCase() || "local-guest";
  const cloudSnapshot = options.cloudSnapshot || {
    profile,
    vocab: [],
    wrongWords: [],
    progress: {},
    achievements: [],
    quizHistory: []
  };

  page.on("console", (message) => {
    if (message.type() === "error") fatalConsole.push(message.text());
  });
  page.on("pageerror", (error) => fatalConsole.push(error.message));

  await page.route("http://localhost:8080/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/api/me")) {
      await route.fulfill({
        json: options.authenticated
          ? { authenticated: true, ...profile }
          : { authenticated: false }
      });
      return;
    }
    if (url.endsWith("/api/snapshot")) {
      await route.fulfill({ json: cloudSnapshot });
      return;
    }
    if (url.endsWith("/api/sync")) {
      syncBodies.push(route.request().postDataJSON());
      let body = syncBodies[syncBodies.length - 1] || {};
      await route.fulfill({
        json: options.syncResponse || {
          profile: body.profile || cloudSnapshot.profile || profile,
          vocab: body.vocab || [],
          wrongWords: body.wrongWords || [],
          progress: {},
          achievements: [],
          quizHistory: []
        }
      });
      return;
    }
    if (method === "DELETE" && url.includes("/api/vocab/")) {
      await route.fulfill({
        status: options.deleteFails ? 500 : 204,
        body: ""
      });
      return;
    }
    if (url.includes("/api/review/queue")) {
      if (options.forceLocalReview) {
        await route.fulfill({ json: { items: [] } });
      } else if (Array.isArray(options.cloudReviewQueue)) {
        await route.fulfill({ json: options.cloudReviewQueue });
      } else {
        await route.fulfill({ json: [] });
      }
      return;
    }
    if (url.endsWith("/api/review/answer")) {
      await route.fulfill({
        json: {
          wordId: 1,
          mastery: 40,
          streak: 2,
          nextReview: new Date(Date.now() + 86400000).toISOString(),
          message: "Smoke review saved."
        }
      });
      return;
    }
    if (url.endsWith("/api/ai/generate-deck")) {
      if (options.aiDeckRawBody !== undefined || options.aiDeckStatus) {
        await route.fulfill({
          status: options.aiDeckStatus || 200,
          contentType: options.aiDeckContentType || "application/json",
          body: options.aiDeckRawBody !== undefined
            ? options.aiDeckRawBody
            : JSON.stringify(options.aiDeckResponse || {})
        });
        return;
      }
      await route.fulfill({
        json: options.aiDeckResponse || {
          source: "fallback",
          items: [
            {
              english: "smoke",
              vietnameseMeaning: "kiem thu",
              partOfSpeech: "n",
              level: "A1",
              exampleSentence: "This is a smoke test.",
              tag: "test",
              source: "mock"
            }
          ]
        }
      });
      return;
    }
    await route.fulfill({ json: {} });
  });

  await page.addInitScript((seed) => {
    window.QUIZ_APP_CONFIG = { apiOrigin: "http://localhost:8080" };
    localStorage.clear();
    let accountId = String(seed.profile.email || "").trim().toLowerCase() || "local-guest";
    localStorage.setItem("quizUserProfile", JSON.stringify(seed.profile));
    if (seed.vocab) {
      localStorage.setItem(`quizAccount:${accountId}:vocab`, JSON.stringify(seed.vocab));
    }
    if (seed.wrongWords) {
      localStorage.setItem(`quizAccount:${accountId}:wrongWords`, JSON.stringify(seed.wrongWords));
    }
    if (seed.pendingDeletes) {
      localStorage.setItem(`quizAccount:${accountId}:cloudDeleteQueue`, JSON.stringify(seed.pendingDeletes));
    }
  }, {
    profile,
    vocab: options.vocab || [],
    wrongWords: options.wrongWords || [],
    pendingDeletes: options.pendingDeletes || null
  });

  await page.goto("index.html");
  await expect(page.getByRole("heading", { name: "WordArena" })).toBeVisible();
  Object.defineProperty(fatalConsole, "syncBodies", { value: syncBodies });
  Object.defineProperty(fatalConsole, "accountId", { value: accountId });
  return fatalConsole;
}

test("static app loads without fatal console errors", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await expect(page.locator(".appMain")).toBeVisible();
  await expect(page.locator(".sidebarBrand")).toContainText("WordArena");
  expect(fatalConsole).toEqual([]);
});

test("empty user sees start-here onboarding and opens starter decks", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await expect(page.locator("#startHerePanel")).toBeVisible();
  await expect(page.locator("#startHerePanel")).toContainText("Start here");
  await expect(page.locator("#startHerePanel")).toContainText("Recommended first decks");

  await page.locator("#startHereStarterBtn").click();
  await expect(page.locator("#learningStudio")).toBeVisible();
  await expect(page.locator(".studioTab[data-studio-tab='decks']")).toHaveClass(/is-active/);
  await expect(page.locator("#curatedTopicSelect")).toHaveValue("daily-life");
  await expect(page.locator("#topicDeckGrid")).toContainText("Daily English");

  expect(fatalConsole).toEqual([]);
});

test("main navigation opens critical sections", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await page.getByRole("button", { name: "Vocabulary", exact: true }).click();
  await expect(page.locator("#engInput")).toBeVisible();

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.locator("#reviewTodayPanel")).toBeVisible();

  await page.getByRole("button", { name: "AI Deck", exact: true }).click();
  await expect(page.locator("#aiDeckBtn")).toBeVisible();

  await page.getByRole("button", { name: "Studio" }).click();
  await expect(page.locator("#studioBtn")).toBeVisible();

  expect(fatalConsole).toEqual([]);
});

test("local vocabulary can add and delete a word", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await page.getByRole("button", { name: "Vocabulary", exact: true }).click();
  await page.locator("#engInput").fill("smoke-test-word");
  await page.locator("#vieInput").fill("tu kiem thu");
  await page.locator(".addBtn").click();

  await expect(page.locator("#tableBody")).toContainText("smoke-test-word");
  await expect.poll(async () => page.evaluate(() => {
    const words = JSON.parse(localStorage.getItem("quizAccount:local-guest:vocab") || "[]");
    const item = words.find(word => word.eng === "smoke-test-word");
    return Boolean(item?.updatedAt && !Number.isNaN(Date.parse(item.updatedAt)));
  })).toBe(true);
  await page.locator("#tableBody .moreBtn").first().click();
  await page.locator("#tableBody .deleteBtn").first().click();
  await expect(page.locator("#tableBody")).not.toContainText("smoke-test-word");

  expect(fatalConsole).toEqual([]);
});

test("sync merge collapses spacing and case duplicate English words", async ({ page }) => {
  const profile = { name: "Cloud Tester", email: "cloud@example.com", avatar: "images/icon.png" };
  const localWord = {
    ...word("hello world", "local meaning", "sync", 20),
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  const cloudWord = {
    ...word(" HELLO   WORLD ", "cloud meaning", "sync", 21),
    id: 321,
    updatedAt: "2026-01-02T00:00:00.000Z"
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [localWord],
    cloudSnapshot: {
      profile,
      vocab: [cloudWord],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(async () => page.evaluate((accountId) => {
    const words = JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]");
    return words.length;
  }, fatalConsole.accountId)).toBe(1);

  const merged = await page.evaluate((accountId) => {
    const words = JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]");
    return words.map(item => String(item.eng || "").trim().toLowerCase().replace(/\s+/g, " "));
  }, fatalConsole.accountId);
  expect(merged).toEqual(["hello world"]);
  expect(fatalConsole).toEqual([]);
});

test("logged-in empty local storage pulls cloud words before sync", async ({ page }) => {
  const profile = { name: "Fresh Browser", email: "fresh@example.com", avatar: "images/icon.png" };
  const cloudWord = {
    ...word("cloud-only", "from cloud", "sync", 30),
    id: 654,
    updatedAt: "2026-01-03T00:00:00.000Z"
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    cloudSnapshot: {
      profile,
      vocab: [cloudWord],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(async () => page.evaluate((accountId) => {
    const words = JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]");
    return words.map(item => item.eng);
  }, fatalConsole.accountId)).toEqual(["cloud-only"]);

  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  expect(fatalConsole.syncBodies.at(-1).vocab.map(item => item.eng)).toContain("cloud-only");
  expect(fatalConsole).toEqual([]);
});

test("failed pending cloud delete shows paused sync status", async ({ page }) => {
  const profile = { name: "Delete Tester", email: "delete@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [{ ...word("delete-me", "remove", "sync", 40), id: 123 }],
    pendingDeletes: ["123"],
    deleteFails: true,
    cloudSnapshot: {
      profile,
      vocab: [],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Delete pending - sync paused");
  await page.waitForTimeout(300);
  await expect(page.locator("#cloudSyncStatus")).not.toContainText("Synced");
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("quiz can start and accept an answer from seeded local words", async ({ page }) => {
  const fatalConsole = await preparePage(page, { vocab: sampleWords });

  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await expect(page.locator("#question")).toContainText("Question 1/4");

  await page.locator("#answers .answer").first().click();
  await expect(page.locator("#question")).toContainText(/Question [12]\/4/);

  expect(fatalConsole).toEqual([]);
});

test("quiz locks answers and keyboard Enter continues after feedback", async ({ page }) => {
  const fatalConsole = await preparePage(page, { vocab: sampleWords });

  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#question")).toContainText("Question 1/4");

  await page.keyboard.press("1");
  await expect(page.locator("#answers .answer").first()).toBeDisabled();
  await expect(page.locator("#questionFeedback")).toContainText(/Correct|Wrong/);
  await expect(page.locator("#question")).toContainText("Question 1/4");

  await page.keyboard.press("1");
  await expect(page.locator("#question")).toContainText("Question 1/4");

  await page.keyboard.press("Enter");
  await expect(page.locator("#question")).toContainText("Question 2/4");

  expect(fatalConsole).toEqual([]);
});

test("review queue renders ratings and accepts one local review", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    vocab: reviewWords,
    forceLocalReview: true
  });

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.locator("#reviewTodayBody")).toContainText("review-one");
  await expect(page.locator(".reviewSessionOverview")).toContainText("Progress: 0 / 1");
  await expect(page.locator(".reviewSessionOverview")).toContainText("1 word left");

  await page.getByRole("button", { name: "Reveal Answer" }).first().click();
  await expect(page.getByRole("button", { name: /Again/ }).first()).toBeEnabled();
  await expect(page.getByRole("button", { name: /Good/ }).first()).toBeEnabled();
  await expect(page.getByRole("button", { name: /Easy/ }).first()).toBeEnabled();

  await page.getByRole("button", { name: /Good/ }).first().click();
  await expect(page.locator("#reviewTodayBody")).toContainText("Review Complete");
  await expect(page.locator(".reviewSessionOverview")).toContainText("Progress: 1 / 1");
  await expect(page.locator(".reviewCompletionStats")).toContainText("Good");

  expect(fatalConsole).toEqual([]);
});

test("AI deck panel opens without calling a real AI service", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await page.getByRole("button", { name: "AI Deck", exact: true }).click();
  await page.locator("#aiDeckBtn").click();

  await expect(page.locator("#learningStudio")).toBeVisible();
  await expect(page.locator("#aiDeckText")).toBeVisible();
  await expect(page.locator("#aiDeckGenerateBtn")).toBeVisible();

  expect(fatalConsole).toEqual([]);
});

test("AI deck rate limit message clears loading state", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    aiDeckStatus: 429,
    aiDeckResponse: {
      error: "Rate limit exceeded",
      message: "Too many AI requests. Please try again later.",
      retryAfterSeconds: 45
    }
  });

  await page.getByRole("button", { name: "AI Deck", exact: true }).click();
  await page.locator("#aiDeckBtn").click();
  await page.locator("#aiDeckText").fill("Critical thinking improves concentration during academic reading.");
  await page.locator("#aiDeckGenerateBtn").click();

  await expect(page.locator("#aiDeckStatus")).toContainText("Daily AI limit reached");
  await expect(page.locator("#aiDeckSource")).toContainText("Rate limited");
  await expect(page.locator("#aiDeckGenerateBtn")).not.toHaveText("Generating...");
  await expect(page.locator("#aiDeckList")).toContainText("No generated words yet");

  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("AI deck malformed response does not freeze the panel", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    aiDeckRawBody: "not-json",
    aiDeckContentType: "text/plain"
  });

  await page.getByRole("button", { name: "AI Deck", exact: true }).click();
  await page.locator("#aiDeckBtn").click();
  await page.locator("#aiDeckText").fill("Useful vocabulary appears in this short passage.");
  await page.locator("#aiDeckGenerateBtn").click();

  await expect(page.locator("#aiDeckStatus")).toContainText("AI response could not be processed");
  await expect(page.locator("#aiDeckSource")).toContainText("Unavailable");
  await expect(page.locator("#aiDeckGenerateBtn")).not.toHaveText("Generating...");
  await expect(page.locator("#aiDeckList")).toContainText("No generated words yet");

  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("curated deck list renders and imports without duplicating words", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await page.getByRole("button", { name: "Studio" }).click();
  await page.locator("#studioBtn").click();
  await expect(page.locator("#learningStudio")).toBeVisible();
  await page.locator(".studioTab[data-studio-tab='decks']").click();

  await expect(page.locator("#topicDeckGrid")).toContainText("IELTS Essentials");
  await expect(page.locator("#topicDeckGrid")).toContainText("starter pick");

  await page.locator("#curatedTopicSelect").selectOption("toeic");
  await page.locator("#curatedLevelSelect").selectOption("Any");
  await page.locator("#curatedCountSelect").selectOption("10");
  await page.locator("#curatedGenerateBtn").click();

  await expect(page.locator("#curatedDeckStatus")).toContainText("Generated 10 reliable TOEIC Essentials words");
  await expect(page.locator("#curatedDeckList .aiDeckField--eng input").first()).toHaveValue("invoice");

  await page.locator("#curatedImportBtn").click();
  await expect(page.locator("#curatedDeckStatus")).toContainText("Imported 10 new words");
  await page.locator("#curatedImportBtn").click();
  await expect(page.locator("#curatedDeckStatus")).toContainText("No new words imported");

  await expect.poll(async () => page.evaluate(() => {
    const words = JSON.parse(localStorage.getItem("quizAccount:local-guest:vocab") || "[]");
    return words.filter(word => word.tag === "toeic").length;
  })).toBe(10);

  expect(fatalConsole).toEqual([]);
});
