/* global markWordHard, markWordKnown, save, vocab:writable */
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

test("Vercel frontend defines compatible production security headers", async () => {
  const config = JSON.parse(fs.readFileSync(
    path.join(frontendDir, "vercel.json"),
    "utf8"
  ));
  const globalHeaders = config.headers?.find(entry => entry.source === "/(.*)")?.headers || [];
  const values = Object.fromEntries(globalHeaders.map(header => [header.key, header.value]));

  expect(values["X-Content-Type-Options"]).toBe("nosniff");
  expect(values["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(values["Permissions-Policy"]).toBeTruthy();
  expect(values["Content-Security-Policy"]).toContain("default-src 'self'");
  expect(values["Content-Security-Policy"]).toContain("script-src 'self'");
  expect(values["Content-Security-Policy"]).toContain("style-src 'self' 'unsafe-inline'");
  expect(values["Content-Security-Policy"]).toContain("https://quiz-app-xd9m.onrender.com");
  expect(values["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
  expect(values["Content-Security-Policy"]).not.toContain("script-src 'self' 'unsafe-inline'");
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
  const reviewBodies = [];
  const knownBodies = [];
  const aiDeckRequests = [];
  const attemptCreateBodies = [];
  const attemptSubmitRequests = [];
  const legacyQuizRequests = [];
  let meRequestCount = 0;
  let snapshotRequestCount = 0;
  let attemptSubmitCount = 0;
  const profile = options.profile || {
    name: "Smoke Tester",
    email: "",
    avatar: "images/icon.png"
  };
  let activeProfile = profile;
  let sessionAuthenticated = Boolean(options.authenticated);
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
        json: sessionAuthenticated
          ? { authenticated: true, ...activeProfile }
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
        json: options.mutableSession
          ? {
              ...cloudSnapshots[Math.min(snapshotRequestCount - 1, cloudSnapshots.length - 1)],
              profile: activeProfile
            }
          : cloudSnapshots[Math.min(snapshotRequestCount - 1, cloudSnapshots.length - 1)]
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
    if (url.endsWith("/api/quiz/attempts")) {
      const body = route.request().postDataJSON();
      attemptCreateBodies.push(body);
      if (options.attemptCreateStatus) {
        await route.fulfill({
          status: options.attemptCreateStatus,
          contentType: "application/json",
          body: JSON.stringify({ message: "Attempt unavailable." })
        });
        return;
      }
      const sourceWords = [
        ...(options.cloudSnapshot?.vocab || []),
        ...(options.vocab || [])
      ];
      await route.fulfill({
        json: {
          attemptId: options.attemptId || `10000000-0000-4000-8000-${String(attemptCreateBodies.length).padStart(12, "0")}`,
          quizMode: body.quizMode,
          challengeSeconds: body.challengeSeconds,
          createdAt: "2026-08-26T00:00:00Z",
          expiresAt: "2026-08-27T00:00:00Z",
          items: body.items.map((item, ordinal) => {
            const word = sourceWords.find(candidate => Number(candidate.id) === Number(item.wordId)) || {};
            return {
              ordinal,
              wordId: item.wordId,
              wordUid: word.wordUid || null,
              questionMode: item.questionMode,
              prompt: item.questionMode === "eng" ? word.eng : word.vie
            };
          })
        }
      });
      return;
    }
    if (url.includes("/api/quiz/attempts/") && url.endsWith("/submit")) {
      attemptSubmitCount++;
      const requestRecord = {
        url,
        body: route.request().postData(),
        json: route.request().postDataJSON()
      };
      attemptSubmitRequests.push(requestRecord);
      const configured = options.attemptSubmitResponses?.[
        Math.min(attemptSubmitCount - 1, options.attemptSubmitResponses.length - 1)
      ];
      if (configured?.abort) {
        await route.abort("connectionreset");
        return;
      }
      if (configured?.status && configured.status !== 200) {
        await route.fulfill({
          status: configured.status,
          contentType: "application/json",
          body: JSON.stringify({ message: "Submit unavailable." })
        });
        return;
      }
      const total = requestRecord.json.answers.length;
      const outcome = configured?.outcome || options.attemptOutcome || {
        quizHistoryId: 77,
        totalQuestions: total,
        correctAnswers: total,
        wrongAnswers: 0,
        score: 10,
        maxCombo: total,
        awardedQuizXp: total * 16,
        awardedAchievementXp: 20,
        resultingSyncRevision: options.attemptOutcomeRevision ?? 8
      };
      const snapshot = configured?.snapshot || options.attemptSnapshot || {
        ...cloudSnapshot,
        revision: configured?.snapshotRevision ?? options.attemptSnapshotRevision ?? outcome.resultingSyncRevision
      };
      const revision = configured?.headerRevision ?? options.attemptHeaderRevision ?? snapshot.revision;
      await route.fulfill({
        headers: {
          "X-Sync-Revision": String(revision),
          "Access-Control-Expose-Headers": "X-Sync-Revision"
        },
        json: {
          attemptId: url.split("/").at(-2),
          replayed: Boolean(configured?.replayed),
          outcome,
          snapshot
        }
      });
      return;
    }
    if (url.endsWith("/api/quiz-results")) {
      legacyQuizRequests.push({ url, body: route.request().postData() });
      await route.fulfill({ status: 410, json: { error: "QUIZ_RESULT_ENDPOINT_RETIRED" } });
      return;
    }
    if (method === "DELETE" && url.includes("/api/vocab/")) {
      deleteRequests.push(url);
      await route.fulfill({
        status: options.deleteFails ? 500 : 204,
        headers: options.deleteRevision == null
          ? {}
          : {
              "X-Sync-Revision": String(options.deleteRevision),
              "Access-Control-Expose-Headers": "X-Sync-Revision"
            },
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
    if (url.endsWith("/api/review/known")) {
      knownBodies.push(route.request().postDataJSON());
      await route.fulfill({
        headers: options.knownRevision == null
          ? {}
          : {
              "X-Sync-Revision": String(options.knownRevision),
              "Access-Control-Expose-Headers": "X-Sync-Revision"
            },
        json: options.knownResponse || {
          wordId: 1,
          mastery: 60,
          streak: 2,
          nextReview: new Date(Date.now() + 3 * 86400000).toISOString(),
          message: "Known state saved."
        }
      });
      return;
    }
    if (url.endsWith("/api/review/answer")) {
      reviewBodies.push(route.request().postDataJSON());
      await route.fulfill({
        headers: options.reviewRevision == null
          ? {}
          : {
              "X-Sync-Revision": String(options.reviewRevision),
              "Access-Control-Expose-Headers": "X-Sync-Revision"
            },
        json: options.reviewResponse || {
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
      aiDeckRequests.push({
        method,
        headers: route.request().headers(),
        body: route.request().postDataJSON()
      });
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

  if (options.mutableSession) {
    await page.route("http://localhost:8080/logout", async (route) => {
      sessionAuthenticated = false;
      await route.fulfill({ status: 204, body: "" });
    });
  }

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
    const alreadySeeded = sessionStorage.getItem("__quizSmokeStorageSeeded") === "true";
    if (!seed.preserveStorageOnNavigation || !alreadySeeded) {
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
      Object.entries(seed.extraStorage || {}).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      sessionStorage.setItem("__quizSmokeStorageSeeded", "true");
    }
  }, {
    profile,
    vocab: options.vocab || [],
    wrongWords: options.wrongWords || [],
    pendingDeletes: options.pendingDeletes || null,
    syncMeta: options.syncMeta || null,
    extraStorage: options.extraStorage || null,
    preserveStorageOnNavigation: Boolean(options.preserveStorageOnNavigation),
    fixedNow: options.fixedNow || null,
    staleRecoveryEnabled: options.staleRecoveryEnabled || false
  });

  await page.goto("index.html");
  await expect(page.getByRole("heading", { name: "WordArena" })).toBeVisible();
  Object.defineProperty(fatalConsole, "syncBodies", { value: syncBodies });
  Object.defineProperty(fatalConsole, "deleteRequests", { value: deleteRequests });
  Object.defineProperty(fatalConsole, "reviewBodies", { value: reviewBodies });
  Object.defineProperty(fatalConsole, "knownBodies", { value: knownBodies });
  Object.defineProperty(fatalConsole, "aiDeckRequests", { value: aiDeckRequests });
  Object.defineProperty(fatalConsole, "attemptCreateBodies", { value: attemptCreateBodies });
  Object.defineProperty(fatalConsole, "attemptSubmitRequests", { value: attemptSubmitRequests });
  Object.defineProperty(fatalConsole, "legacyQuizRequests", { value: legacyQuizRequests });
  Object.defineProperty(fatalConsole, "accountId", { value: accountId });
  Object.defineProperty(fatalConsole, "meRequestCount", { get: () => meRequestCount });
  Object.defineProperty(fatalConsole, "snapshotRequestCount", { get: () => snapshotRequestCount });
  Object.defineProperty(fatalConsole, "setSession", {
    value: (nextProfile) => {
      activeProfile = nextProfile;
      sessionAuthenticated = true;
    }
  });
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

async function openLearningStudio(page, tab = "profile") {
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await page.locator("#studioBtn").click();
  await expect(page.locator("#learningStudio")).toBeVisible();
  if (tab !== "profile") {
    await page.locator(`.studioTab[data-studio-tab='${tab}']`).click();
  }
}

function studioBadge(page, name) {
  return page.locator("#badgeGallery .badgeCard").filter({ hasText: name });
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

test("profile editor traps keyboard focus, closes with Escape, and restores the profile trigger", async ({ page }) => {
  const fatalConsole = await preparePage(page);
  const profileTrigger = page.locator("#profileTrigger");

  await profileTrigger.click();
  await page.locator("#profileSettingsBtn").click();
  await expect(page.locator("#profileEditor")).toBeVisible();
  await expect(page.locator("#profileEditorCloseBtn")).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Save Profile" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#profileEditorCloseBtn")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator("#profileEditor")).toBeHidden();
  await expect(profileTrigger).toBeFocused();

  await profileTrigger.click();
  await page.locator("#profileSettingsBtn").click();
  await expect(page.locator("#profileEditorCloseBtn")).toBeFocused();
  await page.locator("#profileEditorCloseBtn").click();
  await expect(page.locator("#profileEditor")).toBeHidden();
  await expect(profileTrigger).toBeFocused();
  expect(fatalConsole).toEqual([]);
});

test("How it works modal moves focus inside, traps Tab, and restores its opener", async ({ page }) => {
  const fatalConsole = await preparePage(page);
  const opener = page.locator("#previewBtn");

  await opener.click();
  await expect(page.locator("#appPreview")).toBeVisible();
  await expect(page.locator("#previewCloseBtn")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#previewCloseBtn")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#previewCloseBtn")).toBeFocused();

  await page.locator("#previewCloseBtn").click();
  await expect(page.locator("#appPreview")).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await expect(page.locator("#previewCloseBtn")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#appPreview")).toBeHidden();
  await expect(opener).toBeFocused();
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

test("application does not cancel normal contextmenu events", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  const contextMenuResult = await page.locator(".appMain").evaluate((element) => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2
    });
    const dispatched = element.dispatchEvent(event);
    return { defaultPrevented: event.defaultPrevented, dispatched };
  });

  expect(contextMenuResult).toEqual({ defaultPrevented: false, dispatched: true });
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

test("data UI actions dispatch once by click and keyboard while preserving active-page state", async ({ page }) => {
  const fatalConsole = await preparePage(page);
  await page.evaluate(() => {
    const originalOpenChallengeMenu = window.openChallengeMenu;
    window.__dataUiActionCalls = { openChallenge: 0, challengeSeconds: [] };
    window.openChallengeMenu = () => {
      window.__dataUiActionCalls.openChallenge++;
      originalOpenChallengeMenu();
    };
    window.startChallenge = seconds => {
      window.__dataUiActionCalls.challengeSeconds.push(seconds);
    };
  });

  const vocabularyNav = page.locator(".appNavBtn[data-app-page='vocabulary']");
  const dashboardNav = page.locator(".appNavBtn[data-app-page='dashboard']");
  const openChallengeAction = page.locator("[data-ui-action='open-challenge-menu']");

  await vocabularyNav.click();
  await expect(vocabularyNav).toHaveAttribute("aria-current", "page");
  await dashboardNav.click();
  await expect(dashboardNav).toHaveAttribute("aria-current", "page");

  await openChallengeAction.click();
  await expect(page.locator("#challengeMenu")).toBeVisible();
  expect(await page.evaluate(() => window.__dataUiActionCalls.openChallenge)).toBe(1);
  await page.locator("[data-ui-action='close-challenge-menu']").click();

  await openChallengeAction.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#challengeMenu")).toBeVisible();
  expect(await page.evaluate(() => window.__dataUiActionCalls.openChallenge)).toBe(2);
  await page.locator("[data-ui-action='start-challenge'][data-challenge-seconds='15']").click();
  expect(await page.evaluate(() => window.__dataUiActionCalls.challengeSeconds)).toEqual([15]);

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

test("toast dismissal uses CSS class state without inline styles", async ({ page }) => {
  const fatalConsole = await preparePage(page);
  await page.clock.install();

  await page.locator("#exportBtn").click();

  const toast = page.locator(".toast").filter({ hasText: "Exported backup JSON." });
  await expect(toast).toBeVisible();
  await expect(toast).not.toHaveAttribute("style", /.*/);

  await page.clock.fastForward(2200);
  await expect(toast).toHaveClass(/is-hiding/);
  await expect(toast).not.toHaveAttribute("style", /.*/);

  await page.clock.fastForward(220);
  await expect(toast).toHaveCount(0);

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

test("successful direct delete advances the next sync revision without hiding real conflicts", async ({ page }) => {
  const profile = { name: "Revision Client", email: "revision-client@example.com", avatar: "images/icon.png" };
  const localWord = {
    ...word("delete revision", "xoa revision", "sync", 120),
    id: 1,
    wordUid: "00000000-0000-4000-8000-000000001201"
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    revision: 5,
    deleteRevision: 7,
    vocab: [localWord],
    cloudSnapshot: {
      revision: 5,
      profile,
      vocab: [localWord],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.quizCloud.state().lastKnownRevision)).toBe(6);
  fatalConsole.syncBodies.length = 0;

  await page.evaluate(async () => {
    const target = vocab[0];
    vocab = [];
    save();
    await window.quizCloud.deleteWord(target);
    await window.quizCloud.syncNow();
  });

  expect(fatalConsole.deleteRequests).toHaveLength(1);
  expect(fatalConsole.syncBodies.at(-1).expectedRevision).toBe(7);

  await page.evaluate(() => {
    window.quizCloud.rememberResponseRevision({
      ok: true,
      headers: { get: () => "6" }
    });
    window.quizCloud.rememberResponseRevision({
      ok: false,
      headers: { get: () => "99" }
    });
  });
  expect(await page.evaluate(() => window.quizCloud.state().lastKnownRevision)).toBe(7);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("Mark known and Mark hard send intent only and apply server-authoritative learning state", async ({ page }) => {
  const profile = { name: "Learning Intent", email: "learning-intent@example.com", avatar: "images/icon.png" };
  const baseWord = {
    ...word("intent word", "tu y dinh", "review", 121),
    id: 1,
    wordUid: "00000000-0000-4000-8000-000000001202"
  };
  const knownWord = {
    ...baseWord,
    stats: { ...baseWord.stats, seen: 1, correct: 1, streak: 2, bestStreak: 2, masteryLevel: 3 },
    mastered: false
  };
  const hardWord = {
    ...knownWord,
    stats: { ...knownWord.stats, seen: 2, wrong: 1, streak: 0, masteryLevel: 2 },
    mastered: false
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    revision: 5,
    knownRevision: 8,
    reviewRevision: 9,
    knownResponse: {
      wordId: 1,
      mastery: 60,
      streak: 2,
      nextReview: new Date(Date.now() + 3 * 86400000).toISOString(),
      message: "Known state saved.",
      word: knownWord
    },
    reviewResponse: {
      wordId: 1,
      mastery: 40,
      streak: 0,
      nextReview: new Date(Date.now() + 86400000).toISOString(),
      message: "Review this word again tomorrow.",
      word: hardWord
    },
    vocab: [baseWord],
    cloudSnapshot: {
      revision: 5,
      profile,
      vocab: [baseWord],
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  fatalConsole.syncBodies.length = 0;

  await page.evaluate(() => markWordKnown(0));
  await expect.poll(() => fatalConsole.knownBodies.length).toBe(1);
  expect(fatalConsole.knownBodies[0]).toEqual({ wordId: 1 });
  let state = await readImportStorage(page, fatalConsole.accountId);
  expect(state.vocab[0].stats.streak).toBe(2);
  expect(state.vocab[0].stats.masteryLevel).toBe(3);

  await page.evaluate(() => markWordHard(0));
  await expect.poll(() => fatalConsole.reviewBodies.length).toBe(1);
  expect(fatalConsole.reviewBodies[0]).toEqual({ wordId: 1, correct: false, mode: "mark-hard" });
  state = await readImportStorage(page, fatalConsole.accountId);
  expect(state.vocab[0].stats.wrong).toBe(1);
  expect(state.wrongWords).toHaveLength(1);

  await page.evaluate(() => window.quizCloud.syncNow());
  expect(fatalConsole.syncBodies.at(-1).expectedRevision).toBe(9);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("Clear Mastered syncs only mastered wrong-bank identities and keeps unrelated mistakes", async ({ page }) => {
  const profile = { name: "Wrong Bank", email: "wrong-bank-clear@example.com", avatar: "images/icon.png" };
  const mastered = {
    ...word("mastered mistake", "loi da thuoc", "review", 122),
    id: 1,
    wordUid: "00000000-0000-4000-8000-000000001203",
    mastered: true,
    stats: { ...word("x", "x", "review", 122).stats, streak: 5, bestStreak: 5, masteryLevel: 5 }
  };
  const active = {
    ...word("active mistake", "loi con lai", "review", 123),
    id: 2,
    wordUid: "00000000-0000-4000-8000-000000001204"
  };
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    profile,
    revision: 10,
    vocab: [mastered, active],
    wrongWords: [mastered, active],
    cloudSnapshot: {
      revision: 10,
      profile,
      vocab: [mastered, active],
      wrongWords: [mastered, active],
      progress: {},
      achievements: [],
      quizHistory: []
    }
  });
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await expect.poll(() => fatalConsole.syncBodies.length).toBeGreaterThan(0);
  fatalConsole.syncBodies.length = 0;
  page.once("dialog", dialog => dialog.accept());

  await page.locator("[data-ui-action='open-mistake-screen']").click();
  await page.locator("[data-ui-action='clear-mastered']").click();
  await expect.poll(() => fatalConsole.syncBodies.length).toBe(1);

  const body = fatalConsole.syncBodies[0];
  expect(body.expectedRevision).toBe(11);
  expect(body.wrongWordDeletions).toEqual([{ wordUid: mastered.wordUid }]);
  expect(body.wrongWordDeletions).not.toContainEqual({ wordUid: active.wordUid });
  const state = await readImportStorage(page, fatalConsole.accountId);
  expect(state.wrongWords.map(item => item.eng)).toEqual(["active mistake"]);
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

async function completeFourQuestionQuiz(page) {
  for (let question = 0; question < 4; question++) {
    await page.locator("#answers .answer").first().click();
    if (question < 3) await page.locator(".nextBtn").click();
  }
  await page.locator(".submitBtn").click();
  await expect(page.locator("#resultScreen")).toBeVisible();
}

function authenticatedQuizOptions(overrides = {}) {
  const profile = {
    name: "Attempt Tester",
    email: "attempt-tester@example.com",
    avatar: "images/icon.png"
  };
  return {
    authenticated: true,
    profile,
    vocab: sampleWords,
    revision: 5,
    cloudSnapshot: {
      profile,
      vocab: sampleWords,
      wrongWords: [],
      progress: {},
      achievements: [],
      quizHistory: [],
      revision: 5
    },
    ...overrides
  };
}

async function readQuizLearningState(page) {
  return page.evaluate(() => {
    const prefix = `quizAccount:${window.getCurrentAccountId()}:`;
    const read = key => JSON.parse(localStorage.getItem(prefix + key) || "[]");
    const learning = words => words.map(({ id, mastered, stats }) => ({ id, mastered, stats }))
      .sort((left, right) => left.id - right.id);
    return {
      vocab: learning(read("vocab")),
      wrongWords: learning(read("wrongWords")),
      history: read("quizHistory"),
      profile: JSON.parse(localStorage.getItem("quizUserProfile") || "{}"),
      revision: window.quizCloud.state().lastKnownRevision
    };
  });
}

async function completeQuizWithOneWrongAnswer(page) {
  for (let ordinal = 0; ordinal < 4; ordinal++) {
    const prompt = await page.locator("#question .keyword").textContent();
    const item = sampleWords.find(candidate => candidate.eng === prompt || candidate.vie === prompt);
    const correct = item.eng === prompt ? item.vie : item.eng;
    const choices = page.locator("#answers .answer");
    const labels = (await choices.allTextContents()).map(label => label.replace(/^\d+\. /, ""));
    const choice = labels.findIndex(label => item.id === 4 ? label !== correct : label === correct);
    expect(choice).toBeGreaterThanOrEqual(0);
    await choices.nth(choice).click();
    if (ordinal < 3) await page.locator(".nextBtn").click();
  }
  await page.locator(".submitBtn").click();
  await expect(page.locator("#resultScreen")).toBeVisible();
}

test("pending issued quiz retains local learning effects exactly once", async ({ page }) => {
  const fatalConsole = await preparePage(page, authenticatedQuizOptions({
    fixedNow: "2026-08-28T00:00:00.000Z",
    attemptSubmitResponses: [{ status: 503 }]
  }));
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  const before = await readQuizLearningState(page);
  const syncCount = fatalConsole.syncBodies.length;
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeQuizWithOneWrongAnswer(page);
  await expect.poll(() => page.evaluate(() => window.WordArenaQuizAttemptClient.state()?.status)).toBe("pending");
  const after = await readQuizLearningState(page);
  await test.info().attach("pending-local-learning-before-after", {
    body: JSON.stringify({ before, after }), contentType: "application/json"
  });
  expect(after.history).toHaveLength(1);
  expect(after.history[0]).toMatchObject({ totalQuestions: 4, correctAnswers: 3, wrongAnswers: 1 });
  expect(after.revision).toBe(before.revision);
  expect(after.profile).toEqual(before.profile);
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptSubmitRequests).toHaveLength(2);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
  expect(after.vocab.map(item => item.stats.seen)).toEqual([1, 1, 1, 1]);
  expect(after.vocab.map(item => item.stats.correct)).toEqual([1, 1, 1, 0]);
  expect(after.vocab.map(item => item.stats.wrong)).toEqual([0, 0, 0, 1]);
  expect(after.vocab.map(item => item.stats.streak)).toEqual([1, 1, 1, 0]);
  expect(after.vocab.map(item => item.stats.masteryLevel)).toEqual([1, 1, 1, 0]);
  expect(after.vocab.map(item => item.stats.nextReview)).toEqual([
    "2026-08-31T00:00:00.000Z", "2026-08-31T00:00:00.000Z",
    "2026-08-31T00:00:00.000Z", "2026-08-29T00:00:00.000Z"
  ]);
  expect(after.wrongWords.map(item => item.id)).toEqual([4]);
  await page.evaluate(async () => {
    window.finishQuiz();
    await window.WordArenaQuizAttemptClient.retryActiveSubmission();
  });
  expect(await readQuizLearningState(page)).toEqual(after);
  expect(fatalConsole.syncBodies).toHaveLength(syncCount);
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptSubmitRequests).toHaveLength(3);
  expect(new Set(fatalConsole.attemptSubmitRequests.map(item => item.body)).size).toBe(1);
  expect(new Set(fatalConsole.attemptSubmitRequests.map(item => item.url)).size).toBe(1);
});

function learningReconciliationOptions(overrides = {}) {
  const seededWords = sampleWords.map(item => ({
    ...item,
    wordUid: `20000000-0000-4000-8000-${String(item.id).padStart(12, "0")}`,
    updatedAt: "2026-08-20T00:00:00.000Z",
    mastered: item.id === 4,
    stats: { ...item.stats, seen: 4, correct: 4, streak: 4, bestStreak: 4, masteryLevel: 4 }
  }));
  const profile = { ...authenticatedQuizOptions().profile, xp: 100, level: 1 };
  const cloudSnapshot = {
    ...authenticatedQuizOptions().cloudSnapshot,
    profile,
    vocab: seededWords,
    wrongWords: [seededWords[0]]
  };
  // Deliberately different from browser answers, and older than the local completion timestamp.
  // Authoritative learning must win even when the editable-field merge prefers the local word.
  const serverWords = seededWords.map(item => ({
    ...item,
    updatedAt: "2026-08-27T23:59:59.000Z",
    mastered: item.id !== 2,
    stats: {
      seen: 5, correct: item.id === 2 ? 4 : 5, wrong: item.id === 2 ? 1 : 0,
      streak: item.id === 2 ? 0 : 5, bestStreak: item.id === 2 ? 4 : 5,
      masteryLevel: item.id === 2 ? 3 : 5,
      lastReviewed: "2026-08-27T23:59:59.000Z", nextReview: "2026-09-01T00:00:00.000Z"
    }
  }));
  const outcome = {
    quizHistoryId: 91, totalQuestions: 4, correctAnswers: 3, wrongAnswers: 1,
    score: 7.5, maxCombo: 2, awardedQuizXp: 46, awardedAchievementXp: 20, resultingSyncRevision: 8
  };
  const snapshot = {
    ...cloudSnapshot,
    profile: { ...profile, xp: 166 },
    vocab: serverWords,
    wrongWords: [serverWords[1]],
    quizHistory: [{ id: 91, totalQuestions: 4, correctAnswers: 3, wrongAnswers: 1, score: 7.5, maxCombo: 2 }],
    revision: 8
  };
  return authenticatedQuizOptions({
    profile, vocab: seededWords, wrongWords: cloudSnapshot.wrongWords, cloudSnapshot,
    fixedNow: "2026-08-28T00:00:00.000Z", attemptOutcome: outcome,
    attemptSnapshot: snapshot, syncResponse: cloudSnapshot, ...overrides
  });
}

function expectAuthoritativeLearning(state, snapshot) {
  const learning = words => words.map(({ id, mastered, stats }) => ({ id, mastered, stats }))
    .sort((left, right) => left.id - right.id);
  expect(state.vocab).toEqual(learning(snapshot.vocab));
  expect(state.wrongWords).toEqual(learning(snapshot.wrongWords));
  expect(state.history).toHaveLength(1);
  expect(state.history[0]).toMatchObject({ totalQuestions: 4, correctAnswers: 3, wrongAnswers: 1, score: 7.5, maxCombo: 2 });
  expect(state.profile.xp).toBe(snapshot.profile.xp);
  expect(state.revision).toBe(snapshot.revision);
}

test("successful issued quiz reconciles local learning and wrong bank to the server snapshot", async ({ page }) => {
  const options = learningReconciliationOptions();
  const fatalConsole = await preparePage(page, options);
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeQuizWithOneWrongAnswer(page);
  await expect(page.locator("#cloudSyncStatus")).toContainText("Quiz saved securely");
  expectAuthoritativeLearning(await readQuizLearningState(page), options.attemptSnapshot);
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptSubmitRequests).toHaveLength(1);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
});

for (const lostResponse of [false, true]) {
  test(`pending local learning reconciles on ${lostResponse ? "lost-response replay" : "retry success"} without doubling`, async ({ page }) => {
    const options = learningReconciliationOptions({
      attemptSubmitResponses: [
        lostResponse ? { abort: true } : { status: 503 },
        { status: 503 },
        { replayed: lostResponse }
      ]
    });
    const fatalConsole = await preparePage(page, options);
    await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
    const before = await readQuizLearningState(page);
    // A normal sync after the Retry button is a no-op at the same server revision.
    options.syncResponse = options.attemptSnapshot;
    await page.getByRole("button", { name: "Start Quiz" }).last().click();
    await expect(page.locator("#quizScreen")).toBeVisible();
    await completeQuizWithOneWrongAnswer(page);
    await expect.poll(() => page.evaluate(() => window.WordArenaQuizAttemptClient.state()?.status)).toBe("pending");
    const pending = await readQuizLearningState(page);
    expect(pending.vocab.map(item => item.stats.seen)).toEqual(before.vocab.map(item => item.stats.seen + 1));
    expect(pending.wrongWords.map(item => item.id)).toContain(4);
    expect(pending.history).toHaveLength(1);
    expect(pending.profile.xp).toBe(before.profile.xp);
    expect(pending.revision).toBe(before.revision);
    const attempt = await page.evaluate(() => window.WordArenaQuizAttemptClient.state());
    await page.getByRole("button", { name: "Retry Sync", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.WordArenaQuizAttemptClient.state()?.status)).toBe("consumed");
    await expect(page.locator("#syncRetryBtn")).toBeEnabled();
    expectAuthoritativeLearning(await readQuizLearningState(page), options.attemptSnapshot);
    const consumed = await page.evaluate(() => window.WordArenaQuizAttemptClient.state());
    expect(consumed.attemptId).toBe(attempt.attemptId);
    expect(consumed.lastResponse.outcome).toEqual(options.attemptOutcome);
    expect(consumed.lastResponse.replayed).toBe(lostResponse);
    expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
    expect(fatalConsole.attemptSubmitRequests).toHaveLength(3);
    expect(new Set(fatalConsole.attemptSubmitRequests.map(item => item.body)).size).toBe(1);
    expect(new Set(fatalConsole.attemptSubmitRequests.map(item => item.url)).size).toBe(1);
    expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
  });
}

for (const practice of [false, true]) {
  test(`pending quiz preserves local-only learning semantics (${practice ? "wrong practice" : "standard"})`, async ({ page, browser }) => {
    const options = learningReconciliationOptions({ attemptSubmitResponses: [{ status: 503 }] });
    const fatalConsole = await preparePage(page, options);
    await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
    const start = target => target.evaluate(isPractice => window.startWordSetQuiz(
      window.readAccountArray("vocab"), "eng", { practice: isPractice, kind: isPractice ? "wrong-practice" : "quiz" }
    ), practice);
    await start(page);
    await expect(page.locator("#quizScreen")).toBeVisible();
    await completeQuizWithOneWrongAnswer(page);
    await expect.poll(() => page.evaluate(() => window.WordArenaQuizAttemptClient.state()?.status)).toBe("pending");
    const pending = await readQuizLearningState(page);

    const localPage = await browser.newPage();
    try {
      const localRequests = await preparePage(localPage, { ...options, authenticated: false });
      await expect.poll(() => localPage.evaluate(() => window.quizCloud.isReady())).toBe(false);
      await start(localPage);
      await expect(localPage.locator("#quizScreen")).toBeVisible();
      await completeQuizWithOneWrongAnswer(localPage);
      const local = await readQuizLearningState(localPage);
      expect(pending.vocab).toEqual(local.vocab);
      expect(pending.wrongWords).toEqual(local.wrongWords);
      expect(pending.history).toHaveLength(1);
      expect(local.history).toHaveLength(1);
      expect(pending.vocab.map(item => item.mastered)).toEqual([true, true, true, false]);
      expect(pending.vocab.map(item => item.stats.streak)).toEqual([5, 5, 5, 0]);
      expect(pending.vocab.map(item => item.stats.masteryLevel)).toEqual([5, 5, 5, 3]);
      expect(pending.wrongWords.find(item => item.id === 1).mastered).toBe(practice);
      expect(localRequests.attemptCreateBodies).toHaveLength(0);
      expect(localRequests.attemptSubmitRequests).toHaveLength(0);
      expect(localRequests.legacyQuizRequests).toHaveLength(0);
    } finally {
      await localPage.close();
    }
    expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
    expect(fatalConsole.attemptSubmitRequests).toHaveLength(2);
    expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
  });
}

test("quiz local fallback is not applied after the issuing account changes", async ({ page }) => {
  const fatalConsole = await preparePage(page, learningReconciliationOptions());
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  // The storage-switch save schedules ordinary sync; isolate this quiz boundary from that unrelated response.
  await page.route("**/api/sync", route => route.fulfill({ status: 503, json: {} }));
  await page.evaluate(() => window.switchAccountStorage({ email: "other-account@example.com", name: "Other" }));
  const before = await readQuizLearningState(page);
  await completeQuizWithOneWrongAnswer(page);
  expect(await readQuizLearningState(page)).toEqual(before);
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptSubmitRequests).toHaveLength(0);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
});

test("logout preserves completed local learning and cancels late attempt delivery", async ({ page }) => {
  const fatalConsole = await preparePage(page, learningReconciliationOptions({ mutableSession: true }));
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  let releaseSubmit;
  const submitGate = new Promise(resolve => { releaseSubmit = resolve; });
  let submitReceived = false;
  await page.route("**/api/quiz/attempts/*/submit", async route => {
    submitReceived = true;
    await submitGate;
    await route.fallback();
  });
  let releaseLogout;
  const logoutGate = new Promise(resolve => { releaseLogout = resolve; });
  await page.route("http://localhost:8080/logout", async route => {
    await logoutGate;
    await route.fallback();
  });
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeQuizWithOneWrongAnswer(page);
  await expect.poll(() => submitReceived).toBe(true);
  const completed = await readQuizLearningState(page);
  expect(completed.vocab.map(item => item.stats.seen)).toEqual([5, 5, 5, 5]);
  await page.locator("#profileTrigger").click();
  await page.locator("#profileLogoutBtn").click();
  expect(await page.evaluate(() => window.WordArenaQuizAttemptClient.state())).toBeNull();
  const oldResponse = page.waitForResponse(response => response.url().endsWith("/submit"));
  releaseSubmit();
  await (await oldResponse).finished();
  expect(await readQuizLearningState(page)).toEqual(completed);
  releaseLogout();
  await expect(page).toHaveURL(/login\.html\?loggedOut=true$/);
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptSubmitRequests).toHaveLength(1);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
});

test("online quiz issues once, binds issued items, and applies authoritative outcome", async ({ page }) => {
  const options = authenticatedQuizOptions({
    attemptOutcome: {
      quizHistoryId: 91,
      totalQuestions: 4,
      correctAnswers: 3,
      wrongAnswers: 1,
      score: 7.5,
      maxCombo: 2,
      awardedQuizXp: 46,
      awardedAchievementXp: 20,
      resultingSyncRevision: 8
    },
    attemptSnapshotRevision: 8,
    attemptHeaderRevision: 8
  });
  const fatalConsole = await preparePage(page, options);
  await expect.poll(() => page.evaluate(() => window.quizCloud.isReady())).toBe(true);

  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptCreateBodies[0].items).toHaveLength(4);
  const firstIssued = fatalConsole.attemptCreateBodies[0].items[0];
  const issuedWord = sampleWords.find(item => item.id === firstIssued.wordId);
  await expect(page.locator("#question")).toContainText(
    firstIssued.questionMode === "eng" ? issuedWord.eng : issuedWord.vie
  );

  await completeFourQuestionQuiz(page);
  await expect.poll(() => fatalConsole.attemptSubmitRequests.length).toBe(1);
  expect(fatalConsole.attemptSubmitRequests[0].url).toContain(
    "/api/quiz/attempts/10000000-0000-4000-8000-000000000001/submit"
  );
  expect(fatalConsole.attemptSubmitRequests[0].json.answers.map(item => item.ordinal)).toEqual([0, 1, 2, 3]);
  await expect(page.locator("#rCorrect")).toHaveText("3/4");
  await expect(page.locator("#score")).toHaveText("7.5 / 10");
  await expect.poll(() => page.evaluate(() => window.quizCloud.state().lastKnownRevision)).toBe(8);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("lost submit response retries the same attempt and byte-identical payload", async ({ page }) => {
  const fatalConsole = await preparePage(page, authenticatedQuizOptions({
    attemptSubmitResponses: [
      { abort: true },
      { replayed: true, headerRevision: 6, snapshotRevision: 6 }
    ],
    attemptOutcomeRevision: 6
  }));
  await expect.poll(() => page.evaluate(() => window.quizCloud.isReady())).toBe(true);

  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeFourQuestionQuiz(page);

  await expect.poll(() => fatalConsole.attemptSubmitRequests.length).toBe(2);
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptSubmitRequests[0].url).toBe(fatalConsole.attemptSubmitRequests[1].url);
  expect(fatalConsole.attemptSubmitRequests[0].body).toBe(fatalConsole.attemptSubmitRequests[1].body);
  await expect.poll(() => page.evaluate(() => window.WordArenaQuizAttemptClient.state()?.status)).toBe("consumed");
  const historyLength = await page.evaluate(() => {
    const key = "quizAccount:attempt-tester@example.com:quizHistory";
    return JSON.parse(localStorage.getItem(key) || "[]").length;
  });
  expect(historyLength).toBe(1);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
});

test("attempt creation failure keeps a local-only quiz without legacy fallback", async ({ page }) => {
  const fatalConsole = await preparePage(page, authenticatedQuizOptions({ attemptCreateStatus: 503 }));
  await expect.poll(() => page.evaluate(() => window.quizCloud.isReady())).toBe(true);

  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await page.locator("#answers .answer").first().click();

  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.attemptSubmitRequests).toHaveLength(0);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
  expect(await page.evaluate(() => window.WordArenaQuizAttemptClient.state())).toBeNull();
  await expect(page.locator("#cloudSyncStatus")).toContainText("local-only");
});

test("submit failure retains the original active attempt and never reissues", async ({ page }) => {
  const fatalConsole = await preparePage(page, authenticatedQuizOptions({
    attemptSubmitResponses: [{ status: 503 }, { status: 503 }, { status: 503 }]
  }));
  await expect.poll(() => page.evaluate(() => window.quizCloud.isReady())).toBe(true);

  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeFourQuestionQuiz(page);

  await expect.poll(() => fatalConsole.attemptSubmitRequests.length).toBe(2);
  const pending = await page.evaluate(() => window.WordArenaQuizAttemptClient.state());
  expect(pending.status).toBe("pending");
  expect(pending.attemptId).toBe("10000000-0000-4000-8000-000000000001");
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
});

test("stale exact-replay response cannot regress the remembered sync revision", async ({ page }) => {
  const fatalConsole = await preparePage(page, authenticatedQuizOptions({
    revision: 7,
    cloudSnapshot: {
      ...authenticatedQuizOptions().cloudSnapshot,
      revision: 7
    },
    attemptSubmitResponses: [
      { abort: true },
      { replayed: true, headerRevision: 4, snapshotRevision: 4 }
    ],
    attemptOutcomeRevision: 4
  }));
  await expect.poll(() => page.evaluate(() => window.quizCloud.state().lastKnownRevision)).toBeGreaterThanOrEqual(7);
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  const revisionBeforeReplay = await page.evaluate(() => window.quizCloud.state().lastKnownRevision);

  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeFourQuestionQuiz(page);

  await expect.poll(() => fatalConsole.attemptSubmitRequests.length).toBe(2);
  await expect.poll(() => page.evaluate(() => window.quizCloud.state().lastKnownRevision)).toBe(revisionBeforeReplay);
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
});

test("late submit response cannot consume or overwrite a replacement quiz", async ({ page }) => {
  const fatalConsole = await preparePage(page, authenticatedQuizOptions());
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  let releaseSubmit;
  const gate = new Promise(resolve => { releaseSubmit = resolve; });
  let submitReceived = false;
  await page.route("**/api/quiz/attempts/*/submit", async route => {
    submitReceived = true;
    await gate;
    await route.fallback();
  });
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeFourQuestionQuiz(page);
  await expect.poll(() => submitReceived).toBe(true);
  await page.evaluate(() => window.goHome());
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  const replacement = await page.evaluate(() => window.WordArenaQuizAttemptClient.state());
  expect(replacement.attemptId).toBe("10000000-0000-4000-8000-000000000002");
  const oldResponse = page.waitForResponse(response => response.url().includes("000000000001/submit"));
  releaseSubmit();
  await (await oldResponse).finished();
  await completeFourQuestionQuiz(page);
  await expect.poll(() => fatalConsole.attemptSubmitRequests.length).toBe(2);
  expect(fatalConsole.attemptSubmitRequests[1].url).toContain(`${replacement.attemptId}/submit`);
  await expect.poll(() => page.evaluate(() => window.WordArenaQuizAttemptClient.state()?.status)).toBe("consumed");
  expect(fatalConsole.attemptCreateBodies).toHaveLength(2);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("late quiz outcome cannot write into a different account", async ({ page }) => {
  const fatalConsole = await preparePage(page, authenticatedQuizOptions());
  await expect(page.locator("#cloudSyncStatus")).toContainText("Synced");
  let releaseSubmit;
  const gate = new Promise(resolve => { releaseSubmit = resolve; });
  let submitReceived = false;
  await page.route("**/api/quiz/attempts/*/submit", async route => {
    submitReceived = true;
    await gate;
    await route.fallback();
  });
  await page.getByRole("button", { name: "Start Quiz" }).last().click();
  await expect(page.locator("#quizScreen")).toBeVisible();
  await completeFourQuestionQuiz(page);
  await expect.poll(() => submitReceived).toBe(true);
  await page.evaluate(() => window.switchAccountStorage({ email: "other-account@example.com", name: "Other Account" }));
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  releaseSubmit();
  await expect.poll(() => page.evaluate(() => window.WordArenaQuizAttemptClient.state()?.status)).toBe("consumed");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
  expect(await page.evaluate(() => window.getCurrentAccountId())).toBe("other-account@example.com");
  expect(fatalConsole.attemptCreateBodies).toHaveLength(1);
  expect(fatalConsole.legacyQuizRequests).toHaveLength(0);
});

test("production frontend contains no legacy quiz-result submission", async () => {
  const files = fs.readdirSync(path.join(frontendDir, "js"))
    .filter(file => file.endsWith(".js"));
  const references = files.filter(file => fs.readFileSync(path.join(frontendDir, "js", file), "utf8")
    .includes("/api/quiz-results"));
  expect(references).toEqual([]);
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

test("learning studio storage remains isolated across account logout and relogin", async ({ page }) => {
  const profileA = {
    name: "Storage User A",
    email: "User.A@Example.com",
    avatar: "images/icon.png"
  };
  const profileB = {
    name: "Storage User B",
    email: "user.b@example.com",
    avatar: "images/icon.png"
  };
  const accountA = "user.a@example.com";
  const accountB = "user.b@example.com";
  const fatalConsole = await preparePage(page, {
    authenticated: true,
    mutableSession: true,
    preserveStorageOnNavigation: true,
    snapshotFails: true,
    profile: profileA
  });

  await openLearningStudio(page, "decks");
  await page.locator("#topicDeckGrid .topicDeckCard").first().getByRole("button", { name: "Import Deck" }).click();
  const accountAState = await page.evaluate((accountId) => ({
    deckImported: localStorage.getItem(`quizAccount:${accountId}:deckImported`),
    vocab: localStorage.getItem(`quizAccount:${accountId}:vocab`)
  }), accountA);
  expect(accountAState.deckImported).toBe("true");
  expect(JSON.parse(accountAState.vocab)).not.toHaveLength(0);

  await page.keyboard.press("Escape");
  await page.locator("#profileTrigger").click();
  await page.locator("#profileLogoutBtn").click();
  await expect(page).toHaveURL(/login\.html\?loggedOut=true$/);

  fatalConsole.setSession(profileB);
  await page.goto("index.html");
  await expect(page.getByRole("heading", { name: "WordArena" })).toBeVisible();
  await openLearningStudio(page, "badges");
  await expect(studioBadge(page, "Deck Builder")).toContainText("Locked");
  const accountBState = await page.evaluate(({ accountAId, accountBId }) => ({
    accountADeckImported: localStorage.getItem(`quizAccount:${accountAId}:deckImported`),
    accountAVocab: localStorage.getItem(`quizAccount:${accountAId}:vocab`),
    accountBDeckImported: localStorage.getItem(`quizAccount:${accountBId}:deckImported`),
    accountBVocab: localStorage.getItem(`quizAccount:${accountBId}:vocab`)
  }), { accountAId: accountA, accountBId: accountB });
  expect(accountBState.accountADeckImported).toBe(accountAState.deckImported);
  expect(accountBState.accountAVocab).toBe(accountAState.vocab);
  expect(accountBState.accountBDeckImported).toBeNull();
  expect(JSON.parse(accountBState.accountBVocab || "[]")).toEqual([]);

  await page.keyboard.press("Escape");
  await page.locator("#profileTrigger").click();
  await page.locator("#profileLogoutBtn").click();
  await expect(page).toHaveURL(/login\.html\?loggedOut=true$/);

  fatalConsole.setSession(profileA);
  await page.goto("index.html");
  await expect(page.getByRole("heading", { name: "WordArena" })).toBeVisible();
  await openLearningStudio(page, "badges");
  await expect(studioBadge(page, "Deck Builder")).toContainText("Unlocked");
  const restoredAState = await page.evaluate((accountId) => ({
    deckImported: localStorage.getItem(`quizAccount:${accountId}:deckImported`),
    vocab: localStorage.getItem(`quizAccount:${accountId}:vocab`)
  }), accountA);
  expect(restoredAState).toEqual(accountAState);

  expect(fatalConsole.filter(message => !message.includes("Failed to load resource"))).toEqual([]);
});

test("learning studio local state survives an offline reload without schema changes", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    preserveStorageOnNavigation: true
  });

  await openLearningStudio(page, "decks");
  await page.locator("#topicDeckGrid .topicDeckCard").first().getByRole("button", { name: "Import Deck" }).click();
  const beforeReload = await page.evaluate(() => ({
    deckImported: localStorage.getItem("quizAccount:local-guest:deckImported"),
    vocab: localStorage.getItem("quizAccount:local-guest:vocab")
  }));
  expect(beforeReload.deckImported).toBe("true");
  expect(JSON.parse(beforeReload.vocab)).not.toHaveLength(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "WordArena" })).toBeVisible();
  await openLearningStudio(page, "badges");
  await expect(studioBadge(page, "Deck Builder")).toContainText("Unlocked");
  const afterReload = await page.evaluate(() => ({
    deckImported: localStorage.getItem("quizAccount:local-guest:deckImported"),
    vocab: localStorage.getItem("quizAccount:local-guest:vocab")
  }));
  expect(afterReload).toEqual(beforeReload);

  expect(fatalConsole).toEqual([]);
});

test("learning studio handles missing account storage with existing empty fallbacks", async ({ page }) => {
  const fatalConsole = await preparePage(page);

  await openLearningStudio(page, "history");
  await expect(page.locator("#historySummary")).toHaveText("No rounds yet");
  await expect(page.locator("#historyList")).toContainText("Finish a quiz or focus session");
  await page.locator(".studioTab[data-studio-tab='badges']").click();
  await expect(studioBadge(page, "Calm Focus")).toContainText("Locked");
  await expect(studioBadge(page, "Deck Builder")).toContainText("Locked");
  const stored = await page.evaluate(() => ({
    history: localStorage.getItem("quizAccount:local-guest:quizHistory"),
    focusStarted: localStorage.getItem("quizAccount:local-guest:focusStarted"),
    deckImported: localStorage.getItem("quizAccount:local-guest:deckImported")
  }));
  expect(stored).toEqual({ history: null, focusStarted: null, deckImported: null });

  expect(fatalConsole).toEqual([]);
});

test("learning studio preserves malformed JSON and exact flag fallback semantics", async ({ page }) => {
  const malformedHistory = "{not-json";
  const fatalConsole = await preparePage(page, {
    extraStorage: {
      "quizAccount:local-guest:quizHistory": malformedHistory,
      "quizAccount:local-guest:focusStarted": "TRUE",
      "quizAccount:local-guest:deckImported": "false"
    }
  });

  await openLearningStudio(page, "history");
  await expect(page.locator("#historySummary")).toHaveText("No rounds yet");
  await expect(page.locator("#historyList")).toContainText("Finish a quiz or focus session");
  await page.locator(".studioTab[data-studio-tab='badges']").click();
  await expect(studioBadge(page, "Calm Focus")).toContainText("Locked");
  await expect(studioBadge(page, "Deck Builder")).toContainText("Locked");
  expect(await page.evaluate(() => localStorage.getItem("quizAccount:local-guest:quizHistory"))).toBe(malformedHistory);

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

test("AI deck successful request preserves request semantics and renders generated words", async ({ page }) => {
  const fatalConsole = await preparePage(page, {
    aiDeckResponse: {
      source: "openai",
      items: [
        {
          english: "concentrate",
          vietnameseMeaning: "tập trung",
          partOfSpeech: "v",
          level: "B1",
          exampleSentence: "Students concentrate during focused practice.",
          tag: "study",
          source: "mock"
        }
      ]
    }
  });

  await page.getByRole("button", { name: "AI Deck", exact: true }).click();
  await page.locator("#aiDeckBtn").click();
  await page.locator("#aiDeckText").fill("Students concentrate during focused practice.");
  await page.locator("#aiDeckTargetLevel").selectOption("B1");
  await page.locator("#aiDeckMaxWords").selectOption("10");
  await page.locator("#aiDeckGenerateBtn").click();

  await expect(page.locator("#aiDeckStatus")).toContainText("Generated 1 B1 vocabulary items");
  await expect(page.locator("#aiDeckSource")).toContainText("AI Generated");
  await expect(page.locator("#aiDeckList .aiDeckField--eng input")).toHaveValue("concentrate");
  expect(fatalConsole.aiDeckRequests).toHaveLength(1);
  expect(fatalConsole.aiDeckRequests[0]).toMatchObject({
    method: "POST",
    body: {
      text: "Students concentrate during focused practice.",
      targetLevel: "B1",
      maxWords: 10
    }
  });
  expect(fatalConsole.aiDeckRequests[0].headers["content-type"]).toContain("application/json");
  expect(fatalConsole.aiDeckRequests[0].headers["x-xsrf-token"]).toBe("smoke-csrf-token");
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
