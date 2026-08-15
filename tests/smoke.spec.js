const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const frontendDir = path.join(__dirname, "..", "frontend");

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

test("frontend html has no inline event handlers or javascript urls", async () => {
  const htmlFiles = ["index.html", "login.html"];
  const findings = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(frontendDir, file), "utf8");
    const checks = [
      { label: "inline event handler", regex: /\son[a-z]+\s*=/gi },
      { label: "inline style attribute", regex: /\sstyle\s*=/gi },
      { label: "javascript url", regex: /javascript:/gi },
      { label: "inline script block", regex: /<script\b(?![^>]*\bsrc=)[^>]*>/gi }
    ];
    for (const check of checks) {
      for (const match of html.matchAll(check.regex)) {
        findings.push(`${file}: ${check.label}: ${match[0]}`);
      }
    }
  }
  expect(findings).toEqual([]);
});

test("Vercel public root redirects only to the login entry", async () => {
  const config = JSON.parse(fs.readFileSync(
    path.join(frontendDir, "vercel.json"),
    "utf8"
  ));
  expect(config.redirects).toContainEqual({
    source: "/",
    destination: "/login.html",
    permanent: false
  });
});

test("fresh public root opens the login landing page instead of the app shell", async ({ page }) => {
  await page.route("http://localhost:8080/api/me", route => route.fulfill({
    json: { authenticated: false }
  }));

  await page.goto("http://127.0.0.1:4173/");

  await expect(page).toHaveURL("http://127.0.0.1:4173/frontend/login.html");
  await expect(page.getByRole("heading", { name: "WordArena", exact: true })).toBeVisible();
  await expect(page.locator("#googleLoginBtn")).toHaveAttribute("href", /\/oauth2\/authorization\/google$/);
  await expect(page.locator("#home")).toHaveCount(0);
  await expect(page.locator(".appSidebar")).toHaveCount(0);
});

test("explicit login page keeps the public landing and Google login entry", async ({ page }) => {
  await page.route("http://localhost:8080/api/me", route => route.fulfill({
    json: { authenticated: false }
  }));

  await page.goto("login.html");

  await expect(page).toHaveURL(/\/frontend\/login\.html$/);
  await expect(page.getByRole("heading", { name: "WordArena", exact: true })).toBeVisible();
  await expect(page.locator("#googleLoginBtn")).toHaveAttribute("href", /\/oauth2\/authorization\/google$/);
  await expect(page.locator("#home")).toHaveCount(0);
  await expect(page.locator(".appSidebar")).toHaveCount(0);
});

async function preparePage(page, options = {}) {
  const fatalConsole = [];
  const syncBodies = [];
  const deleteRequests = [];
  let meRequestCount = 0;
  let snapshotRequestCount = 0;
  const profile = options.profile || {
    name: "Smoke Tester",
    email: "",
    avatar: "images/icon.png"
  };
  const accountId = String(profile.email || "").trim().toLowerCase() || "local-guest";
  const baseCloudSnapshot = options.cloudSnapshot || {
    profile,
    vocab: [],
    wrongWords: [],
    progress: {},
    achievements: [],
    quizHistory: []
  };
  const normalizeSnapshot = (snapshot) => ({
    ...snapshot,
    revision: options.revision ?? snapshot.revision ?? 0
  });
  const cloudSnapshots = Array.isArray(options.cloudSnapshots) && options.cloudSnapshots.length
    ? options.cloudSnapshots.map(normalizeSnapshot)
    : [normalizeSnapshot(baseCloudSnapshot)];
  const cloudSnapshot = cloudSnapshots[0];

  page.on("console", (message) => {
    if (message.type() === "error") fatalConsole.push(message.text());
  });
  page.on("pageerror", (error) => fatalConsole.push(error.message));

  await page.route("http://localhost:8080/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/api/csrf")) {
      await route.fulfill({
        json: {
          headerName: "X-XSRF-TOKEN",
          parameterName: "_csrf",
          token: "smoke-csrf-token"
        }
      });
      return;
    }
    if (url.endsWith("/api/me")) {
      meRequestCount++;
      const response = Array.isArray(options.meResponses)
        ? options.meResponses[Math.min(meRequestCount - 1, options.meResponses.length - 1)]
        : null;
      if (response) {
        await route.fulfill({
          status: response.status || 200,
          contentType: response.contentType || "application/json",
          body: response.body !== undefined
            ? response.body
            : JSON.stringify(response.json || {})
        });
        return;
      }
      await route.fulfill({
        json: options.authenticated
          ? { authenticated: true, ...profile }
          : { authenticated: false }
      });
      return;
    }
    if (url.endsWith("/api/snapshot")) {
      snapshotRequestCount++;
      if (options.snapshotFails || (options.snapshotFailsAfter && snapshotRequestCount > options.snapshotFailsAfter)) {
        await route.fulfill({
          status: options.snapshotStatus || 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Snapshot unavailable." })
        });
        return;
      }
      await route.fulfill({
        json: cloudSnapshots[Math.min(snapshotRequestCount - 1, cloudSnapshots.length - 1)]
      });
      return;
    }
    if (url.endsWith("/api/sync")) {
      syncBodies.push(route.request().postDataJSON());
      if (options.syncConflict) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "SYNC_REVISION_CONFLICT",
            message: "Cloud data changed. Please refresh sync state.",
            expectedRevision: route.request().postDataJSON()?.expectedRevision,
            currentRevision: options.conflictRevision ?? ((cloudSnapshot.revision || 0) + 1)
          })
        });
        return;
      }
      let body = syncBodies[syncBodies.length - 1] || {};
      await route.fulfill({
        json: options.syncResponse || {
          syncContractVersion: 2,
          revision: (cloudSnapshot.revision || 0) + syncBodies.length,
          profile: { ...(cloudSnapshot.profile || profile), ...(body.profile || {}) },
          vocab: body.vocab || [],
          tombstones: (body.deletions || []).map(item => ({
            wordUid: item.wordUid,
            deletedAt: "2026-01-01T00:00:00.000Z",
            deletedRevision: (cloudSnapshot.revision || 0) + syncBodies.length
          })),
          wrongWords: body.wrongWords || [],
          progress: {},
          achievements: [],
          quizHistory: []
        }
      });
      return;
    }
    if (method === "DELETE" && url.includes("/api/vocab/")) {
      deleteRequests.push(url);
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
    window.QUIZ_APP_CONFIG = {
      apiOrigin: "http://localhost:8080",
      staleRecoveryEnabled: Boolean(seed.staleRecoveryEnabled)
    };
    if (seed.fixedNow) {
      const RealDate = Date;
      const fixedTime = new RealDate(seed.fixedNow).getTime();
      Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [fixedTime]));
        }

        static now() {
          return fixedTime;
        }

        static parse(value) {
          return RealDate.parse(value);
        }

        static UTC(...args) {
          return RealDate.UTC(...args);
        }
      };
    }
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
    if (seed.syncMeta) {
      localStorage.setItem(`quizAccount:${accountId}:cloudSyncMeta`, JSON.stringify(seed.syncMeta));
    }
  }, {
    profile,
    vocab: options.vocab || [],
    wrongWords: options.wrongWords || [],
    pendingDeletes: options.pendingDeletes || null,
    syncMeta: options.syncMeta || null,
    fixedNow: options.fixedNow || null,
    staleRecoveryEnabled: options.staleRecoveryEnabled || false
  });

  await page.goto("index.html");
  await expect(page.getByRole("heading", { name: "WordArena" })).toBeVisible();
  Object.defineProperty(fatalConsole, "syncBodies", { value: syncBodies });
  Object.defineProperty(fatalConsole, "deleteRequests", { value: deleteRequests });
  Object.defineProperty(fatalConsole, "accountId", { value: accountId });
  Object.defineProperty(fatalConsole, "meRequestCount", { get: () => meRequestCount });
  Object.defineProperty(fatalConsole, "snapshotRequestCount", { get: () => snapshotRequestCount });
  return fatalConsole;
}

async function activeElementIsInside(page, selector) {
  return page.evaluate((targetSelector) => {
    const root = document.querySelector(targetSelector);
    return Boolean(root && root.contains(document.activeElement));
  }, selector);
}

async function expectNoDocumentHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    htmlClientWidth: document.documentElement.clientWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.htmlClientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
}

async function expectWithinViewport(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function statusDoesNotClipText(page) {
  return page.locator("#cloudSyncStatus").evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clippedInline: element.scrollWidth > element.clientWidth + 1,
      clippedBlock: element.scrollHeight > element.clientHeight + 1,
      whiteSpace: style.whiteSpace,
      ariaLabel: element.getAttribute("aria-label"),
      title: element.getAttribute("title")
    };
  });
}

async function uploadJsonImport(page, payload, filename = "audit-import.json") {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  await page.locator("#importFile").setInputFiles({
    name: filename,
    mimeType: "application/json",
    buffer: Buffer.from(content)
  });
}

async function readImportStorage(page, accountId = "local-guest") {
  return page.evaluate((id) => ({
    vocab: JSON.parse(localStorage.getItem(`quizAccount:${id}:vocab`) || "[]"),
    wrongWords: JSON.parse(localStorage.getItem(`quizAccount:${id}:wrongWords`) || "[]"),
    pendingDeletes: JSON.parse(localStorage.getItem(`quizAccount:${id}:cloudDeleteQueue`) || "[]"),
    syncMeta: JSON.parse(localStorage.getItem(`quizAccount:${id}:cloudSyncMeta`) || "{}")
  }), accountId);
}

async function loadConfigOnly(page) {
  await page.goto("about:blank");
  await page.evaluate(() => {
    window.QUIZ_APP_CONFIG = { apiOrigin: "http://localhost:8080" };
  });
  await page.addScriptTag({ path: "frontend/js/config.js" });
}

test("api client adds csrf only to trusted unsafe backend requests", async ({ page }) => {
  await loadConfigOnly(page);

  const calls = await page.evaluate(async () => {
    const seen = [];
    window.fetch = async (url, options = {}) => {
      const headers = Object.fromEntries(new Headers(options.headers || {}).entries());
      seen.push({
        url: String(url),
        method: options.method || "GET",
        credentials: options.credentials || "",
        headers,
        hasBody: Boolean(options.body)
      });

      if (String(url).endsWith("/api/csrf")) {
        return new Response(JSON.stringify({
          headerName: "X-XSRF-TOKEN",
          parameterName: "_csrf",
          token: "token-one"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    await window.quizApiFetch("http://localhost:8080/api/read");
    await window.quizApiFetch("http://localhost:8080/api/write", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Custom": "keep-me" },
      body: JSON.stringify({ ok: true })
    });
    await window.quizApiFetch("http://localhost:8080/api/edit", { method: "PUT" });
    await window.quizApiFetch("https://third-party.example/api/write", { method: "POST" });
    return seen;
  });

  expect(calls.map(call => call.url)).toEqual([
    "http://localhost:8080/api/read",
    "http://localhost:8080/api/csrf",
    "http://localhost:8080/api/write",
    "http://localhost:8080/api/edit",
    "https://third-party.example/api/write"
  ]);
  expect(calls[0]).toMatchObject({ method: "GET", credentials: "include" });
  expect(calls[0].headers["x-xsrf-token"]).toBeUndefined();
  expect(calls[2].headers["x-xsrf-token"]).toBe("token-one");
  expect(calls[2].headers["x-custom"]).toBe("keep-me");
  expect(calls[3].headers["x-xsrf-token"]).toBe("token-one");
  expect(calls[4].credentials).toBe("");
  expect(calls[4].headers["x-xsrf-token"]).toBeUndefined();
});

test("api client preserves FormData headers and does not retry unsafe 403", async ({ page }) => {
  await loadConfigOnly(page);

  const calls = await page.evaluate(async () => {
    const seen = [];
    window.fetch = async (url, options = {}) => {
      const headers = Object.fromEntries(new Headers(options.headers || {}).entries());
      seen.push({
        url: String(url),
        method: options.method || "GET",
        headers,
        bodyType: options.body?.constructor?.name || ""
      });

      if (String(url).endsWith("/api/csrf")) {
        return new Response(JSON.stringify({
          headerName: "X-XSRF-TOKEN",
          parameterName: "_csrf",
          token: "token-form"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ message: "Forbidden." }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    };

    const form = new FormData();
    form.append("file", new Blob(["hello"], { type: "text/plain" }), "hello.txt");
    await window.quizApiFetch("http://localhost:8080/api/upload", {
      method: "POST",
      body: form
    });
    return seen;
  });

  const unsafeCalls = calls.filter(call => call.url.endsWith("/api/upload"));
  expect(unsafeCalls).toHaveLength(1);
  expect(unsafeCalls[0].headers["x-xsrf-token"]).toBe("token-form");
  expect(unsafeCalls[0].headers["content-type"]).toBeUndefined();
  expect(unsafeCalls[0].bodyType).toBe("FormData");
});

test("api client refreshes csrf token after explicit clear", async ({ page }) => {
  await loadConfigOnly(page);

  const writes = await page.evaluate(async () => {
    let tokenIndex = 0;
    const sentTokens = [];
    window.fetch = async (url, options = {}) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/api/csrf")) {
        tokenIndex += 1;
        return new Response(JSON.stringify({
          headerName: "X-XSRF-TOKEN",
          parameterName: "_csrf",
          token: `token-${tokenIndex}`
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      sentTokens.push(new Headers(options.headers || {}).get("X-XSRF-TOKEN"));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    await window.quizApiFetch("http://localhost:8080/api/write", { method: "POST" });
    window.quizCsrf.clear();
    await window.quizApiFetch("http://localhost:8080/api/write", { method: "DELETE" });
    return sentTokens;
  });

  expect(writes).toEqual(["token-1", "token-2"]);
});

test("profile save renders text safely and falls back from unsafe avatar data", async ({ page }) => {
  const profile = {
    name: "<img src=x onerror=alert(1)>",
    email: "profile-ui@example.com",
    avatar: "javascript:alert(1)",
    goal: "Initial goal"
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    cloudSnapshot: {
      profile,
      vocab: [],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#profileAvatarSmall")).toHaveAttribute("src", /images\/icon\.png$/);
  await expect(page.locator("#profileName")).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.locator("#profileName img")).toHaveCount(0);

  await page.locator("#profileTrigger").click();
  await page.locator("#profileSettingsBtn").click();
  await page.locator("#profileFormName").fill("<b>Profile Saver</b>");
  await page.locator("#profileFormGoal").fill("<script>alert(1)</script>");
  await page.getByRole("button", { name: "Save Profile" }).click();

  await expect(page.locator("#profileName")).toHaveText("<b>Profile Saver</b>");
  await expect(page.locator("#profileName b")).toHaveCount(0);
  await expect(page.locator("#profileAvatarLarge")).toHaveAttribute("src", /images\/icon\.png$/);

  const cachedProfile = await page.evaluate(() => JSON.parse(localStorage.getItem("quizUserProfile")));
  expect(cachedProfile.avatar).toBe("images/icon.png");
  expect(cachedProfile.name).toBe("<b>Profile Saver</b>");
  expect(fatalConsole).toEqual([]);
});

test("static app loads without fatal console errors", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await expect(page.locator(".appMain")).toBeVisible();
  await expect(page.locator(".sidebarBrand")).toContainText("WordArena");
  await expect(page.locator(".betaPill")).toContainText("Beta preview");
  await expect(page.locator(".appFooter")).toContainText("WordArena Beta");
  await expect(page.locator(".appFooter")).toContainText("AI-assisted vocabulary learning");
  await expect(page.locator(".appFooter a", { hasText: "Send feedback" })).toHaveAttribute("href", /github\.com\/nguyenhdung2006\/Quiz-App\/issues\/new/);
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

[
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 }
].forEach((viewport) => {
  test(`app shell avoids document overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const fatalConsole = await preparePage(page);

    await expectNoDocumentHorizontalOverflow(page);
    await expectWithinViewport(page, ".appSidebar");
    await expectWithinViewport(page, ".appTopbar");
    await expect(page.locator("#home")).toBeVisible();

    await page.getByRole("button", { name: "Vocabulary", exact: true }).click();
    await expect(page.locator(".appNavBtn[data-app-page='vocabulary']")).toHaveAttribute("aria-current", "page");
    await expectNoDocumentHorizontalOverflow(page);

    if (viewport.width <= 620) {
      await expect(page.locator("#sidebarToolsToggle")).toBeVisible();
      await expect(page.locator("#sidebarToolsPanel")).toBeHidden();
    } else {
      await expect(page.locator("#sidebarToolsToggle")).toBeHidden();
      await expect(page.locator("#sidebarToolsPanel")).toBeVisible();
    }

    expect(fatalConsole).toEqual([]);
  });
});

test("mobile tools menu is reachable by click and keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fatalConsole = await preparePage(page);

  const toggle = page.locator("#sidebarToolsToggle");
  const panel = page.locator("#sidebarToolsPanel");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(page.locator("#exportBtn")).toBeVisible();
  await expect(page.locator("#importBtn")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  expect(fatalConsole).toEqual([]);
});

test("mobile sync status stays readable and vocabulary table scrolls inside its container", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const profile = { name: "Mobile Status", email: "mobile-status@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [{
      ...word("shared-word", "old local meaning", "sync", 61),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      profile,
      vocab: [{
        ...word("shared-word", "new cloud meaning", "sync", 62),
        id: 9001,
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Sync paused to protect your data");
  const statusMetrics = await statusDoesNotClipText(page);
  expect(statusMetrics.clippedInline).toBe(false);
  expect(statusMetrics.clippedBlock).toBe(false);
  expect(statusMetrics.whiteSpace).not.toBe("nowrap");
  expect(statusMetrics.ariaLabel).toBe("Sync paused to protect your data");
  expect(statusMetrics.title).toBe("Sync paused to protect your data");
  await expectNoDocumentHorizontalOverflow(page);

  await page.getByRole("button", { name: "Vocabulary", exact: true }).click();
  const tableMetrics = await page.locator(".table-container[data-app-page-panel='vocabulary']").evaluate((container) => ({
    containerScrolls: container.scrollWidth > container.clientWidth + 1,
    viewportWidth: document.documentElement.clientWidth,
    containerRight: container.getBoundingClientRect().right
  }));
  expect(tableMetrics.containerScrolls).toBe(true);
  expect(tableMetrics.containerRight).toBeLessThanOrEqual(tableMetrics.viewportWidth + 1);
  await expectNoDocumentHorizontalOverflow(page);

  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("mobile profile trigger has a distinct account menu name", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fatalConsole = await preparePage(page, {
    profile: { name: "Mobile Learner", email: "", avatar: "images/icon.png" }
  });

  await expect(page.locator("#profileTrigger")).toHaveAttribute("aria-label", "Open account menu for Mobile Learner");
  await expect(page.getByRole("button", { name: "Open account menu for Mobile Learner" })).toBeVisible();

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

test("malformed JSON and CSV imports do not mutate local vocabulary", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    vocab: [word("keep-local", "giu local", "audit", 101)]
  });
  const before = await readImportStorage(page, fatalConsole.accountId);

  await uploadJsonImport(page, "{not valid json");
  await expect(page.locator("#importReviewDialog")).toBeHidden();
  expect(await readImportStorage(page, fatalConsole.accountId)).toEqual(before);

  await page.getByRole("button", { name: "Studio" }).click();
  await page.locator("#studioBtn").click();
  await page.locator(".studioTab[data-studio-tab='csv']").click();
  await page.locator("#csvImportFile").setInputFiles({
    name: "malformed.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('eng,vie\n"unterminated,khong hop le')
  });
  await expect(page.locator("#csvImportResult")).toContainText("CSV import failed");
  expect(await readImportStorage(page, fatalConsole.accountId)).toEqual(before);
  expect(fatalConsole).toEqual([]);
});

test("large JSON import opens preview without mutating storage", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    vocab: [word("existing", "hien co", "audit", 102)]
  });
  const before = await readImportStorage(page, fatalConsole.accountId);
  const incoming = Array.from({ length: 1200 }, (_, index) =>
    word(`large-${index}`, `nghia-${index}`, "large", index + 2000)
  );

  await uploadJsonImport(page, { vocab: incoming, wrongWords: [] }, "large-import.json");
  await expect(page.locator("#importReviewDialog")).toBeVisible();
  await expect(page.locator("#importIncomingCount")).toHaveText("1200");
  await expect(page.locator("#importMergeFinalCount")).toHaveText("1201");
  expect(await readImportStorage(page, fatalConsole.accountId)).toEqual(before);

  await page.locator("#importCancelBtn").click();
  expect(await readImportStorage(page, fatalConsole.accountId)).toEqual(before);
  expect(fatalConsole).toEqual([]);
});

test("import preview reports duplicates and invalid rows; Escape cancels with no change", async ({ page }) => {
  const localAlpha = { ...word("Alpha", "local meaning", "local", 103), note: "keep-local-note" };
  const fatalConsole = await preparePage(page, { vocab: [localAlpha] });
  const before = await readImportStorage(page, fatalConsole.accountId);

  await uploadJsonImport(page, {
    vocab: [
      { ...word(" alpha ", "incoming meaning", "incoming", 104), note: "incoming-note" },
      word("Beta", "beta meaning", "incoming", 105),
      { eng: "invalid-without-meaning" }
    ],
    wrongWords: []
  });

  await expect(page.locator("#importReviewDialog")).toBeVisible();
  await expect(page.locator("#importDuplicateCount")).toHaveText("1");
  await expect(page.locator("#importInvalidCount")).toHaveText("1");
  await expect(page.locator("#importMergeFinalCount")).toHaveText("2");
  await expect(page.locator("#importReplaceFinalCount")).toHaveText("2");
  await expect(page.locator("#importCancelBtn")).toBeFocused();

  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    expect(await activeElementIsInside(page, "#importReviewDialog")).toBeTruthy();
  }
  await page.keyboard.press("Shift+Tab");
  expect(await activeElementIsInside(page, "#importReviewDialog")).toBeTruthy();

  await page.keyboard.press("Escape");
  await expect(page.locator("#importReviewDialog")).toBeHidden();
  await expect(page.locator("#importBtn")).toBeFocused();
  expect(await readImportStorage(page, fatalConsole.accountId)).toEqual(before);
  expect(fatalConsole).toEqual([]);
});

test("safe merge keeps local fields, adds new words, and preserves sync state", async ({ page }) => {
  const profile = { name: "Merge Import", email: "merge-import@example.com", avatar: "images/icon.png" };
  const localAlpha = { ...word("Alpha", "local meaning", "local", 106), note: "keep-local-note" };
  const pendingDeletes = [{ wordUid: "00000000-0000-4000-8000-000000000999", queuedAt: "2026-08-01T00:00:00.000Z" }];
  const syncMeta = { lastKnownRevision: 22, lastSuccessfulSyncAt: "2026-08-01T00:00:00.000Z" };
  const fatalConsole = await preparePage(page, { profile, vocab: [localAlpha], pendingDeletes, syncMeta });

  await uploadJsonImport(page, {
    vocab: [
      { ...word(" alpha ", "incoming meaning", "incoming", 107), note: "overwrite-attempt" },
      word("Beta", "beta meaning", "incoming", 108)
    ],
    wrongWords: [],
    cloudSync: { meta: { lastKnownRevision: 999 }, pendingDeletes: [] }
  });
  await expect(page.locator("#importMetadataNote")).toContainText("ignores it");
  await page.locator("#importMergeBtn").click();
  await expect(page.locator("#importReviewDialog")).toBeHidden();

  const after = await readImportStorage(page, fatalConsole.accountId);
  expect(after.vocab.map(item => item.eng)).toEqual(["Alpha", "Beta"]);
  expect(after.vocab.find(item => item.eng === "Alpha").note).toBe("keep-local-note");
  expect(after.pendingDeletes).toEqual(pendingDeletes);
  expect(after.syncMeta).toEqual(syncMeta);
  expect(fatalConsole).toEqual([]);
});

test("replace is blocked when the pre-import backup cannot be created", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    vocab: [word("keep-after-backup-fail", "giu lai", "audit", 109)]
  });
  const before = await readImportStorage(page, fatalConsole.accountId);
  await page.evaluate(() => {
    window.QUIZ_TEST_FORCE_EXPORT_FAILURE = true;
  });

  await uploadJsonImport(page, { vocab: [word("blocked-replace", "khong thay", "audit", 110)] });
  await page.locator("#importReplaceBtn").click();

  await expect(page.locator("#importReviewStatus")).toContainText("Backup failed");
  await expect(page.locator("#importReviewDialog")).toBeVisible();
  expect(await readImportStorage(page, fatalConsole.accountId)).toEqual(before);
  expect(fatalConsole).toEqual([]);
});

test("replace downloads backup before committing and preserves sync metadata", async ({ page }) => {
  const profile = { name: "Replace Import", email: "replace-import@example.com", avatar: "images/icon.png" };
  const pendingDeletes = [{ legacyWordId: "77", queuedAt: "2026-08-02T00:00:00.000Z" }];
  const syncMeta = { lastKnownRevision: 31, lastSuccessfulSyncAt: "2026-08-02T00:00:00.000Z" };
  const fatalConsole = await preparePage(page, {
    profile,
    vocab: [word("old-local", "cu", "audit", 111)],
    wrongWords: [word("old-wrong", "sai cu", "audit", 112)],
    pendingDeletes,
    syncMeta
  });

  await page.evaluate((accountId) => {
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (String(this.download).includes("wordarena-pre-import-backup")) {
        window.__auditBackupObservedState = JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng);
      }
      return originalClick.call(this);
    };
  }, fatalConsole.accountId);

  await uploadJsonImport(page, {
    version: 2,
    vocab: [word("new-local", "moi", "audit", 113)],
    wrongWords: [word("new-wrong", "sai moi", "audit", 114)],
    cloudSync: { meta: { lastKnownRevision: 999 }, pendingDeletes: [] }
  });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#importReplaceBtn").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain("wordarena-pre-import-backup");
  expect(await page.evaluate(() => window.__auditBackupObservedState)).toEqual(["old-local"]);
  const after = await readImportStorage(page, fatalConsole.accountId);
  expect(after.vocab.map(item => item.eng)).toEqual(["new-local"]);
  expect(after.wrongWords.map(item => item.eng)).toEqual(["new-wrong"]);
  expect(after.pendingDeletes).toEqual(pendingDeletes);
  expect(after.syncMeta).toEqual(syncMeta);
  expect(fatalConsole).toEqual([]);
});

test("replace quota failure rolls storage back and surfaces a visible error", async ({ page }) => {
  const profile = { name: "Quota Import", email: "quota-import@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    profile,
    vocab: [word("quota-old", "du lieu cu", "audit", 115)],
    wrongWords: [word("quota-old-wrong", "sai cu", "audit", 116)]
  });
  const before = await readImportStorage(page, fatalConsole.accountId);

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    let thrown = false;
    Storage.prototype.setItem = function (key, value) {
      if (!thrown && String(key).endsWith(":wrongWords")) {
        thrown = true;
        const error = new DOMException("Storage quota exceeded", "QuotaExceededError");
        throw error;
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await uploadJsonImport(page, {
    vocab: [word("quota-new", "du lieu moi", "audit", 117)],
    wrongWords: [word("quota-new-wrong", "sai moi", "audit", 118)]
  });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#importReplaceBtn").click();
  await downloadPromise;

  await expect(page.locator("#importReviewStatus")).toContainText("storage is full");
  await expect(page.locator("#importReviewDialog")).toBeVisible();
  expect(await readImportStorage(page, fatalConsole.accountId)).toEqual(before);
  expect(fatalConsole).toEqual([]);
});

for (const width of [320, 390]) {
  test(`import review dialog stays within a ${width}px mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    const fatalConsole = await preparePage(page, {
      vocab: [word("mobile-local", "mobile", "audit", width)]
    });

    await uploadJsonImport(page, {
      vocab: [word("mobile-incoming-with-a-long-name", "mobile incoming", "audit", width + 1)]
    });
    await expect(page.locator("#importReviewDialog")).toBeVisible();
    await expectWithinViewport(page, ".importReviewPanel");
    await expectNoDocumentHorizontalOverflow(page);
    expect(fatalConsole).toEqual([]);
  });
}

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
  expect(fatalConsole.syncBodies.at(-1).expectedRevision).toBe(0);
  expect(fatalConsole).toEqual([]);
});

test("legacy local word is removed by tombstone legacyWordId before sync", async ({ page }) => {
  const profile = { name: "Legacy Tombstone", email: "legacy-tombstone@example.com", avatar: "images/icon.png" };
  const legacyWord = {
    ...word("legacy hello", "xin chao", "legacy", 122),
    id: 123
  };
  delete legacyWord.wordUid;

  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [legacyWord],
    wrongWords: [{ ...legacyWord, mastered: false }],
    cloudSnapshot: {
      revision: 9,
      profile,
      vocab: [],
      tombstones: [{
        wordUid: "00000000-0000-4000-8000-000000001234",
        legacyWordId: 123,
        deletedAt: "2026-01-05T00:00:00.000Z",
        deletedRevision: 9
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(async () => page.evaluate((accountId) => {
    const words = JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]");
    const wrong = JSON.parse(localStorage.getItem(`quizAccount:${accountId}:wrongWords`) || "[]");
    const queue = localStorage.getItem(`quizAccount:${accountId}:cloudDeleteQueue`);
    return { words, wrong, queue };
  }, fatalConsole.accountId)).toEqual({ words: [], wrong: [], queue: null });

  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  expect(fatalConsole.syncBodies.at(-1).vocab.map(item => item.eng)).not.toContain("legacy hello");
  expect(fatalConsole.syncBodies.at(-1).deletions || []).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("sync revision conflict pulls cloud snapshot and retries rebuilt push once", async ({ page }) => {
  const profile = { name: "Conflict Tester", email: "conflict@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [{
      ...word("local-conflict-word", "local", "sync", 70),
      updatedAt: "2026-01-04T00:00:00.000Z"
    }],
    syncConflict: true,
    conflictRevision: 8,
    cloudSnapshot: {
      revision: 7,
      profile,
      vocab: [],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(() => fatalConsole.syncBodies.length).toBe(2);
  expect(fatalConsole.syncBodies[0].expectedRevision).toBe(7);
  expect(fatalConsole.syncBodies[1].expectedRevision).toBe(7);
  await expect.poll(() => fatalConsole.snapshotRequestCount).toBeGreaterThan(1);
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("retry sync button is visible when cloud is unavailable", async ({ page }) => {
  const profile = { name: "Retry Vis", email: "retry-vis@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    snapshotFails: true
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Cloud unavailable");
  await expect(page.locator("#syncRetryBtn")).toBeVisible();
  await expect(page.locator("#syncRetryBtn")).not.toBeDisabled();
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("retry sync button is hidden when sync is healthy", async ({ page }) => {
  const profile = { name: "Healthy Retry", email: "healthy-retry@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await expect(page.locator("#syncRetryBtn")).toBeHidden();
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("full cloud sync push is blocked until snapshot pull succeeds", async ({ page }) => {
  const profile = { name: "Safe Sync", email: "safe-sync@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    snapshotFails: true
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Cloud unavailable");
  await page.evaluate(() => window.quizCloud?.syncNow?.());
  await page.waitForTimeout(300);

  expect(fatalConsole.syncBodies).toHaveLength(0);
  await expect.poll(() => page.evaluate(() => window.quizCloud?.state?.().hasPulledCloudSnapshot)).toBe(false);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale returning device does not push over newer cloud snapshot", async ({ page }) => {
  const profile = { name: "Old Device", email: "old-device@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [{
      ...word("shared-word", "old local meaning", "sync", 61),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      profile,
      vocab: [{
        ...word("shared-word", "new cloud meaning", "sync", 62),
        id: 9001,
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Sync paused to protect your data");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  await expect.poll(() => page.evaluate(() => window.quizCloud?.state?.().hasPulledCloudSnapshot)).toBe(true);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale guard does not trigger before seven day boundary", async ({ page }) => {
  const profile = { name: "Recent Device", email: "recent-device@example.com", avatar: "images/icon.png" };
  const sixDaysAgo = new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString();
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [{
      ...word("recent-local", "local", "sync", 65),
      updatedAt: sixDaysAgo
    }],
    syncMeta: {
      lastSuccessfulSyncAt: sixDaysAgo
    },
    cloudSnapshot: {
      profile,
      vocab: [{
        ...word("recent-cloud", "cloud", "sync", 66),
        updatedAt: new Date().toISOString()
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await expect(page.locator("#staleRecoveryPanel")).toHaveCount(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale guard boundary is strictly greater than seven days", async ({ page }) => {
  const profile = { name: "Boundary Device", email: "boundary-device@example.com", avatar: "images/icon.png" };
  const fixedNow = "2026-01-08T00:00:00.000Z";
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    fixedNow,
    vocab: [{
      ...word("boundary-local", "local", "sync", 67),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      profile,
      vocab: [{
        ...word("boundary-cloud", "cloud", "sync", 68),
        updatedAt: new Date().toISOString()
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await expect(page.locator("#staleRecoveryPanel")).toHaveCount(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale guard preserves local state and retry remains fail-closed", async ({ page }) => {
  const profile = { name: "Stale Retry", email: "stale-retry@example.com", avatar: "images/icon.png" };
  const localWord = {
    ...word("stale-local", "unsynced local", "sync", 69),
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [localWord],
    pendingDeletes: [{
      wordUid: "00000000-0000-4000-8000-000000000701",
      queuedAt: "2026-01-02T00:00:00.000Z",
      attempts: 0,
      lastAttemptAt: null,
      lastStatus: "queued",
      lastError: null
    }],
    deleteFails: true,
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      profile,
      vocab: [{
        ...word("cloud-newer", "new cloud", "sync", 70),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Sync paused to protect your data");
  await page.locator("#syncRetryBtn").click();
  await page.waitForTimeout(300);

  expect(fatalConsole.syncBodies).toHaveLength(0);
  const localState = await page.evaluate((accountId) => ({
    vocab: JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]"),
    queue: JSON.parse(localStorage.getItem(`quizAccount:${accountId}:cloudDeleteQueue`) || "[]")
  }), fatalConsole.accountId);
  expect(localState.vocab.map(item => item.eng)).toContain("stale-local");
  expect(localState.queue).toHaveLength(1);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery feature flag opens panel with unsafe choices disabled", async ({ page }) => {
  const profile = { name: "Recovery Flag", email: "recovery-flag@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [{
      ...word("flag-local", "local", "sync", 71),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 4,
      profile,
      vocab: [{
        ...word("flag-cloud", "cloud", "sync", 72),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#staleRecoveryPanel")).toBeVisible();
  await expect(page.locator("#staleRecoveryMergeBtn")).toBeDisabled();
  await expect(page.locator("#staleRecoveryKeepLocalBtn")).toBeDisabled();
  await expect(page.locator("#staleRecoverySummary")).toContainText("Cloud revision");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery cancel keeps local state and push blocked", async ({ page }) => {
  const profile = { name: "Recovery Cancel", email: "recovery-cancel@example.com", avatar: "images/icon.png" };
  const localWord = {
    ...word("cancel-local", "local remains", "sync", 73),
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [localWord],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 5,
      profile,
      vocab: [{
        ...word("cancel-cloud", "cloud", "sync", 74),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await page.locator("#staleRecoveryCancelBtn").click();
  await expect(page.locator("#staleRecoveryPanel")).toBeHidden();
  await page.locator("#syncRetryBtn").click();
  await page.waitForTimeout(300);

  const words = await page.evaluate((accountId) =>
    JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    fatalConsole.accountId
  );
  expect(words).toContain("cancel-local");
  expect(words).not.toContain("cancel-cloud");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery export succeeds without mutating local data", async ({ page }) => {
  const profile = { name: "Recovery Export", email: "recovery-export@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [{
      ...word("export-local", "local", "sync", 75),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 6,
      profile,
      vocab: [{
        ...word("export-cloud", "cloud", "sync", 76),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#staleRecoveryExportBtn").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain("wordarena-stale-local-backup");
  await expect(page.locator("#staleRecoveryStatus")).toContainText("Local backup download started");
  const words = await page.evaluate((accountId) =>
    JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    fatalConsole.accountId
  );
  expect(words).toContain("export-local");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery export failure keeps local data", async ({ page }) => {
  const profile = { name: "Recovery Export Fail", email: "recovery-export-fail@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [{
      ...word("export-fail-local", "local", "sync", 77),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 7,
      profile,
      vocab: [{
        ...word("export-fail-cloud", "cloud", "sync", 78),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await page.evaluate(() => {
    window.QUIZ_TEST_FORCE_EXPORT_FAILURE = true;
  });
  await page.locator("#staleRecoveryExportBtn").click();

  await expect(page.locator("#staleRecoveryStatus")).toContainText("Backup failed");
  const words = await page.evaluate((accountId) =>
    JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    fatalConsole.accountId
  );
  expect(words).toContain("export-fail-local");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery offline keeps local state and still allows export", async ({ page }) => {
  const profile = { name: "Recovery Offline", email: "recovery-offline@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [{
      ...word("offline-local", "local", "sync", 79),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 8,
      profile,
      vocab: [{
        ...word("offline-cloud", "cloud", "sync", 80),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  });
  await page.locator("#staleRecoveryUseCloudBtn").click();
  await expect(page.locator("#staleRecoveryStatus")).toContainText("offline");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#staleRecoveryExportBtn").click();
  await downloadPromise;

  const words = await page.evaluate((accountId) =>
    JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    fatalConsole.accountId
  );
  expect(words).toContain("offline-local");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery use cloud replaces local only after backup and confirmation", async ({ page }) => {
  const profile = { name: "Recovery Cloud", email: "recovery-cloud@example.com", avatar: "images/icon.png" };
  const deletedUid = "00000000-0000-4000-8000-000000000802";
  const otherAccountKey = "quizAccount:other@example.com:vocab";
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [{
      ...word("use-cloud-local", "local", "sync", 81),
      wordUid: "00000000-0000-4000-8000-000000000801",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    pendingDeletes: [{
      wordUid: "00000000-0000-4000-8000-000000000803",
      queuedAt: "2026-01-02T00:00:00.000Z",
      attempts: 0,
      lastAttemptAt: null,
      lastStatus: "queued",
      lastError: null
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 9,
      profile,
      vocab: [
        {
          ...word("use-cloud-cloud", "cloud", "sync", 82),
          wordUid: "00000000-0000-4000-8000-000000000804",
          updatedAt: "2026-05-01T00:00:00.000Z"
        },
        {
          ...word("deleted-cloud-word", "should not resurrect", "sync", 83),
          wordUid: deletedUid,
          updatedAt: "2026-05-01T00:00:00.000Z"
        }
      ],
      tombstones: [{
        wordUid: deletedUid,
        deletedAt: "2026-05-02T00:00:00.000Z",
        deletedRevision: 9
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await page.evaluate(([key]) => {
    localStorage.setItem(key, JSON.stringify([{ eng: "other-account-word", vie: "other" }]));
  }, [otherAccountKey]);
  page.once("dialog", dialog => dialog.accept());
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#staleRecoveryUseCloudBtn").click();
  await downloadPromise;
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");

  const state = await page.evaluate(([accountId, otherKey]) => ({
    words: JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    queue: localStorage.getItem(`quizAccount:${accountId}:cloudDeleteQueue`),
    other: JSON.parse(localStorage.getItem(otherKey) || "[]").map(item => item.eng)
  }), [fatalConsole.accountId, otherAccountKey]);
  expect(state.words).toEqual(["use-cloud-cloud"]);
  expect(state.queue).toBeNull();
  expect(state.other).toEqual(["other-account-word"]);
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery use cloud fetch failure rolls back local state", async ({ page }) => {
  const profile = { name: "Recovery Fetch Fail", email: "recovery-fetch-fail@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    snapshotFailsAfter: 1,
    profile,
    vocab: [{
      ...word("fetch-fail-local", "local", "sync", 84),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 10,
      profile,
      vocab: [{
        ...word("fetch-fail-cloud", "cloud", "sync", 85),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  page.once("dialog", dialog => dialog.accept());
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#staleRecoveryUseCloudBtn").click();
  await downloadPromise;

  await expect(page.locator("#staleRecoveryStatus")).toContainText("Recovery failed");
  const words = await page.evaluate((accountId) =>
    JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    fatalConsole.accountId
  );
  expect(words).toContain("fetch-fail-local");
  expect(words).not.toContain("fetch-fail-cloud");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery detects cloud revision change before applying", async ({ page }) => {
  const profile = { name: "Recovery Revision", email: "recovery-revision@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [{
      ...word("revision-local", "local", "sync", 86),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshots: [
      {
        revision: 11,
        profile,
        vocab: [{
          ...word("revision-cloud-old", "cloud", "sync", 87),
          updatedAt: "2026-05-01T00:00:00.000Z"
        }],
        wrongWords: [],
        progress: {},
        achievements: [],
        quizHistory: []
      },
      {
        revision: 12,
        profile,
        vocab: [{
          ...word("revision-cloud-new", "cloud", "sync", 88),
          updatedAt: "2026-05-02T00:00:00.000Z"
        }],
        wrongWords: [],
        progress: {},
        achievements: [],
        quizHistory: []
      }
    ]
  });

  page.once("dialog", dialog => dialog.accept());
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#staleRecoveryUseCloudBtn").click();
  await downloadPromise;

  await expect(page.locator("#staleRecoveryStatus")).toContainText("Cloud changed");
  await expect(page.locator("#staleRecoveryPanel")).toBeVisible();
  await expect(page.locator("#staleRecoverySummary")).toContainText("12");
  const words = await page.evaluate((accountId) =>
    JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    fatalConsole.accountId
  );
  expect(words).toContain("revision-local");
  expect(words).not.toContain("revision-cloud-new");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("stale recovery persistence failure keeps local state", async ({ page }) => {
  const profile = { name: "Recovery Persist Fail", email: "recovery-persist-fail@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    staleRecoveryEnabled: true,
    profile,
    vocab: [{
      ...word("persist-fail-local", "local", "sync", 89),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z"
    },
    cloudSnapshot: {
      revision: 13,
      profile,
      vocab: [{
        ...word("persist-fail-cloud", "cloud", "sync", 90),
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    let thrown = false;
    Storage.prototype.setItem = function (key, value) {
      if (!thrown && String(key).includes(":vocab")) {
        thrown = true;
        throw new Error("forced persistence failure");
      }
      return originalSetItem.call(this, key, value);
    };
  });
  page.once("dialog", dialog => dialog.accept());
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#staleRecoveryUseCloudBtn").click();
  await downloadPromise;

  await expect(page.locator("#staleRecoveryStatus")).toContainText("Recovery failed");
  const words = await page.evaluate((accountId) =>
    JSON.parse(localStorage.getItem(`quizAccount:${accountId}:vocab`) || "[]").map(item => item.eng),
    fatalConsole.accountId
  );
  expect(words).toContain("persist-fail-local");
  expect(words).not.toContain("persist-fail-cloud");
  expect(fatalConsole.syncBodies).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("old sync metadata still allows push when cloud is not newer", async ({ page }) => {
  const profile = { name: "Quiet Cloud", email: "quiet-cloud@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    vocab: [{
      ...word("quiet-word", "local meaning", "sync", 63),
      updatedAt: "2026-01-02T00:00:00.000Z"
    }],
    syncMeta: {
      lastSuccessfulSyncAt: "2026-01-02T00:00:00.000Z"
    },
    cloudSnapshot: {
      profile,
      vocab: [{
        ...word("quiet-word", "cloud meaning", "sync", 64),
        id: 9002,
        updatedAt: "2026-01-01T00:00:00.000Z"
      }],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  expect(fatalConsole.syncBodies.at(-1).vocab.map(item => item.eng)).toContain("quiet-word");
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("auth bootstrap retries transient /api/me failure before applying profile", async ({ page }) => {
  const profile = { name: "Retry Tester", email: "retry@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    profile,
    meResponses: [
      { status: 500, json: { message: "Temporary backend error." } },
      { status: 200, json: { authenticated: true, ...profile } }
    ],
    cloudSnapshot: {
      profile,
      vocab: [],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect.poll(() => fatalConsole.meRequestCount).toBe(2);
  await expect(page.locator("#profileMenuEmail")).toContainText("retry@example.com");
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  expect(page.url()).toContain("index.html");
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("failed direct cloud delete is carried by full sync deletions", async ({ page }) => {
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

  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  expect(fatalConsole.deleteRequests.some(url => url.includes("/api/vocab/uid/"))).toBeTruthy();
  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  expect(fatalConsole.syncBodies.at(-1).deletions).toHaveLength(1);
  expect(fatalConsole.syncBodies.at(-1).deletions[0].wordUid).toBeTruthy();
  const rawQueue = await page.evaluate((accountId) => {
    return localStorage.getItem(`quizAccount:${accountId}:cloudDeleteQueue`);
  }, fatalConsole.accountId);
  expect(rawQueue).toBeNull();
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("successful pending cloud delete clears migrated queue item", async ({ page }) => {
  const profile = { name: "Delete Success", email: "delete-success@example.com", avatar: "images/icon.png" };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    pendingDeletes: ["456"],
    cloudSnapshot: {
      profile,
      vocab: [],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  expect(fatalConsole.deleteRequests.filter(url => url.includes("/api/vocab/456"))).toHaveLength(1);
  const rawQueue = await page.evaluate((accountId) => {
    return localStorage.getItem(`quizAccount:${accountId}:cloudDeleteQueue`);
  }, fatalConsole.accountId);
  expect(rawQueue).toBeNull();
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("delete queue dedupes and respects retry backoff after repeated failures", async ({ page }) => {
  const profile = { name: "Delete Backoff", email: "delete-backoff@example.com", avatar: "images/icon.png" };
  const now = new Date().toISOString();
  const wordUid = "00000000-0000-4000-8000-000000000789";
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    pendingDeletes: [
      {
        wordUid,
        queuedAt: now,
        attempts: 2,
        lastAttemptAt: new Date().toISOString(),
        lastStatus: "failed",
        lastError: "HTTP 500"
      },
      {
        wordUid,
        attempts: 1
      }
    ],
    cloudSnapshot: {
      profile,
      vocab: [],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });

  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  expect(fatalConsole.deleteRequests.filter(url => url.includes(wordUid))).toHaveLength(0);
  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  expect(fatalConsole.syncBodies.at(-1).deletions).toHaveLength(1);
  expect(fatalConsole.syncBodies.at(-1).deletions[0].wordUid).toBe(wordUid);
  const rawQueue = await page.evaluate((accountId) => {
    return localStorage.getItem(`quizAccount:${accountId}:cloudDeleteQueue`);
  }, fatalConsole.accountId);
  expect(rawQueue).toBeNull();
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

test("quiz controls and result tones avoid inline style state", async ({ page }) => {
  const fatalConsole = await preparePage(page, { vocab: sampleWords });

  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Start Quiz" }).last().click();

  const timer = page.locator("#timer");
  const back = page.locator(".backQuestionBtn");
  const submit = page.locator(".submitBtn");
  const next = page.locator(".nextBtn");

  await expect(timer).toHaveAttribute("hidden", "");
  await expect(back).toHaveAttribute("hidden", "");
  await expect(submit).toHaveAttribute("hidden", "");
  await expect(next).not.toHaveAttribute("hidden", "");

  for (let question = 0; question < sampleWords.length; question++) {
    await page.locator("#answers .answer").first().click();
    if (question < sampleWords.length - 1) {
      await next.click();
    }
  }

  await expect(submit).not.toHaveAttribute("hidden", "");
  await expect(next).toHaveAttribute("hidden", "");
  await submit.click();

  await expect(page.locator("#resultScreen")).toBeVisible();
  await expect(page.locator("#score")).not.toHaveAttribute("style", /color/i);
  await expect(page.locator("#comment")).toHaveAttribute("data-grade", /^(A\+?|B\+?|C\+?|D\+?|F)$/);
  await expect(page.locator("#comment")).not.toHaveAttribute("style", /color/i);
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

test("learning studio modal traps focus, closes with Escape, and restores focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fatalConsole = await preparePage(page);

  await page.getByRole("button", { name: "Studio" }).click();
  await page.locator("#studioBtn").click();

  const modal = page.locator("#learningStudio");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("role", "dialog");
  await expect(modal).toHaveAttribute("aria-modal", "true");
  await expect(modal).toHaveAttribute("aria-labelledby", "studioTitle");
  await expect(modal).toHaveAttribute("aria-describedby", "studioDescription");
  await expect(page.locator("#studioCloseBtn")).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  expect(await activeElementIsInside(page, "#learningStudio")).toBeTruthy();

  await page.keyboard.press("Tab");
  await expect(page.locator("#studioCloseBtn")).toBeFocused();

  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await activeElementIsInside(page, "#learningStudio")).toBeTruthy();
  }

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(page.locator("#studioBtn")).toBeFocused();

  expect(fatalConsole).toEqual([]);
});

test("learning studio tabs expose ARIA state and keyboard navigation", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await page.getByRole("button", { name: "Studio" }).click();
  await page.locator("#studioBtn").click();

  const tablist = page.locator(".studioTabs");
  await expect(tablist).toHaveAttribute("role", "tablist");
  await expect(tablist.getByRole("tab")).toHaveCount(7);

  const profileTab = page.locator(".studioTab[data-studio-tab='profile']");
  const historyTab = page.locator(".studioTab[data-studio-tab='history']");
  const csvTab = page.locator(".studioTab[data-studio-tab='csv']");
  await expect(profileTab).toHaveAttribute("aria-selected", "true");
  await expect(profileTab).toHaveAttribute("aria-controls", "studioViewProfile");
  await expect(page.locator("#studioViewProfile")).toHaveAttribute("role", "tabpanel");
  await expect(page.locator("#studioViewProfile")).toHaveAttribute("aria-labelledby", await profileTab.getAttribute("id"));
  await expect(page.locator("#studioViewProfile")).toBeVisible();
  await expect(page.locator("#studioViewHistory")).toBeHidden();

  await profileTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(historyTab).toBeFocused();
  await expect(historyTab).toHaveAttribute("aria-selected", "true");
  await expect(historyTab).toHaveAttribute("tabindex", "0");
  await expect(profileTab).toHaveAttribute("tabindex", "-1");
  await expect(page.locator("#studioViewHistory")).toBeVisible();
  await expect(page.locator("#studioViewProfile")).toBeHidden();

  await page.keyboard.press("End");
  await expect(csvTab).toBeFocused();
  await expect(csvTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#studioViewCsv")).toBeVisible();

  await page.keyboard.press("Home");
  await expect(profileTab).toBeFocused();
  await expect(profileTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#studioViewProfile")).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(csvTab).toBeFocused();
  await expect(page.locator("#studioViewCsv")).toBeVisible();

  expect(fatalConsole).toEqual([]);
});

test("AI deck panel opens without calling a real AI service", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await page.getByRole("button", { name: "AI Deck", exact: true }).click();
  await expect(page.locator(".aiDeckWorkspace .trustNote")).toContainText("AI suggestions are drafts");
  await page.locator("#aiDeckBtn").click();

  await expect(page.locator("#learningStudio")).toBeVisible();
  await expect(page.locator("#aiDeckText")).toBeVisible();
  await expect(page.locator("#aiDeckGenerateBtn")).toBeVisible();
  await expect(page.locator(".trustNote--studio")).toContainText("edit every generated word");

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
  await expect(page.locator("#aiDeckRetryBtn")).toBeVisible();

  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("AI deck rate limit retry button triggers new generation", async ({ page }) => {
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
  await page.locator("#aiDeckText").fill("Another passage for retry testing.");
  await page.locator("#aiDeckGenerateBtn").click();

  await expect(page.locator("#aiDeckStatus")).toContainText("Daily AI limit reached");
  await expect(page.locator("#aiDeckRetryBtn")).toBeVisible();
  await expect(page.locator("#aiDeckRetryBtn")).not.toBeDisabled();

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
  await expect(page.locator("#aiDeckRetryBtn")).toBeVisible();

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
