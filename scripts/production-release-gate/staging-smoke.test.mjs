import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  evaluateStagingAuthSmokeEvidenceContent,
  evaluateStagingSmoke
} from "./staging-smoke.mjs";

const completeEvidence = `
# Staging Auth Smoke Evidence

| Field | Evidence |
| --- | --- |
| Smoke date/time | 2026-08-14T00:00:00.000Z |
| Commit | d6c7526cfae67216be5c8a5ba45a46fe9b7050aa |
| Environment | staging disposable Render/Supabase |
| Operator | release operator |
| Staging frontend URL | redacted staging frontend HTTPS URL |
| Staging backend URL | redacted staging backend HTTPS URL |
| Health smoke | PASS: /api/health returned 2xx |
| CSRF smoke | PASS: /api/csrf returned JSON and cookie |
| OAuth/auth smoke | PASS: Google OAuth test identity reached authenticated /api/me |
| Vocabulary CRUD smoke | PASS: audit-smoke word created, read, and updated |
| Sync smoke | PASS: audit-smoke sync completed with expected revision |
| Delete/tombstone smoke | PASS: audit-smoke delete produced tombstone and no resurrection |
| Logout smoke | PASS: logout returned 204 and cleared session |
| RTO/RPO notes | Restore duration and backup coverage recorded in release evidence |
| Result | PASS: staging authenticated smoke completed |
`;

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function withTempEvidence(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), "wordarena-staging-smoke-"));
  try {
    const file = join(dir, "evidence.md");
    writeFileSync(file, content, "utf8");
    return await fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function env(overrides = {}) {
  return {
    STAGING_BACKEND_URL: "https://staging-api.wordarena.test",
    STAGING_FRONTEND_URL: "https://staging.wordarena.test",
    STAGING_TEST_USER_HINT: "audit-smoke-test-user",
    ...overrides
  };
}

function mockFetch(url) {
  const headers = new Headers();
  if (url.endsWith("/api/csrf")) {
    headers.set("content-type", "application/json");
    headers.set("set-cookie", "XSRF-TOKEN=redacted");
  } else if (url.endsWith("/api/health")) {
    headers.set("content-type", "application/json");
  } else {
    headers.set("content-type", "text/html");
  }
  return Promise.resolve(new Response("{}", { status: 200, headers }));
}

test("complete authenticated staging evidence passes schema", () => {
  assert.equal(evaluateStagingAuthSmokeEvidenceContent(completeEvidence).ok, true);
});

test("partial authenticated staging evidence is blocked", () => {
  const result = evaluateStagingAuthSmokeEvidenceContent(completeEvidence.replace(
    "PASS: Google OAuth test identity reached authenticated /api/me",
    "NOT RUN: Google OAuth test identity was unavailable"
  ));

  assert.equal(result.ok, false);
  assert.deepEqual(result.incompleteFields.map((item) => item.field), ["OAuth/auth smoke"]);
});

test("missing staging variables block without network evidence", async () => {
  const result = await evaluateStagingSmoke({}, mockFetch);

  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.details.missingVariables, [
    "STAGING_BACKEND_URL",
    "STAGING_FRONTEND_URL",
    "STAGING_TEST_USER_HINT"
  ]);
});

test("basic smoke cannot pass without authenticated evidence", async () => {
  const result = await evaluateStagingSmoke(env(), mockFetch);

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.details.authSmokeEvidence, "docs/staging-auth-smoke-evidence.md");
});

test("basic smoke plus authenticated evidence passes", async () => {
  await withTempEvidence(completeEvidence, async (file) => {
    const result = await evaluateStagingSmoke(env({ STAGING_AUTH_SMOKE_EVIDENCE_FILE: file }), mockFetch);

    assert.equal(result.status, "PASS");
    assert.equal(result.details.authSmokeEvidence, file);
  });
});

for (const { name, fn } of tests) {
  await fn();
  console.log(`[PASS] ${name}`);
}
