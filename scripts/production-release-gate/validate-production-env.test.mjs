import assert from "node:assert/strict";
import { evaluateProductionEnv } from "./validate-production-env.mjs";

const databasePasswordName = "DATABASE_PASSWORD";
const googleClientSecretName = "GOOGLE_CLIENT_SECRET";

function test(name, fn) {
  fn();
  console.log(`[PASS] ${name}`);
}

function safeFixtureEnv(overrides = {}) {
  return {
    DATABASE_URL: "jdbc:postgresql://aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
    DATABASE_USERNAME: "release_gate_user",
    DATABASE_PASSWORD: "release-gate-password-value",
    GOOGLE_CLIENT_ID: "release-gate-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "release-gate-oauth-secret-value",
    FRONTEND_URL: "https://quiz-app-rust-iota-39.vercel.app",
    OAUTH_SUCCESS_REDIRECT_URI: "https://quiz-app-rust-iota-39.vercel.app/index.html",
    CORS_ALLOWED_ORIGINS: "https://quiz-app-rust-iota-39.vercel.app",
    SESSION_COOKIE_SECURE: "true",
    SESSION_COOKIE_SAME_SITE: "none",
    SESSION_COOKIE_PATH: "/",
    JPA_DDL_AUTO: "validate",
    FLYWAY_ENABLED: "true",
    FLYWAY_BASELINE_ON_MIGRATE: "false",
    SPRING_PROFILES_ACTIVE: "prod",
    RATE_LIMIT_MODE: "in-memory",
    AI_EXPLAIN_RATE_LIMIT_PER_MINUTE: "10",
    AI_EXPLAIN_RATE_LIMIT_PER_DAY: "100",
    AI_DECK_RATE_LIMIT_PER_MINUTE: "3",
    AI_DECK_RATE_LIMIT_PER_DAY: "20",
    MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE: "health,info,metrics",
    LOGGING_LEVEL_ROOT: "INFO",
    ...overrides
  };
}

function productionEnv(overrides = {}) {
  return safeFixtureEnv({
    DATABASE_USERNAME: "wordarena_prod_app",
    [databasePasswordName]: "nonpublic-prod-secret-value",
    GOOGLE_CLIENT_ID: "1234567890-prod.apps.googleusercontent.com",
    [googleClientSecretName]: "nonpublic-google-secret-value",
    RELEASE_ENV_SOURCE: "deployed",
    RELEASE_DEPLOYMENT_ID: "render-srv-20260811-abc123",
    RELEASE_ENV_CAPTURED_AT: "2026-08-11T00:00:00.000Z",
    ...overrides
  });
}

test("safe fixture is blocked as production evidence in normal mode", () => {
  const result = evaluateProductionEnv(safeFixtureEnv());

  assert.equal(result.status, "FAIL");
  assert.ok(result.details.findings.some((finding) => finding.variable === "DATABASE_PASSWORD"));
  assert.ok(result.details.findings.some((finding) => finding.variable === "RELEASE_ENV_SOURCE"));
});

test("safe fixture passes only as validator self-test", () => {
  const result = evaluateProductionEnv(safeFixtureEnv(), { mode: "self-test" });

  assert.equal(result.status, "PASS");
  assert.equal(result.details.validatorSelfTest, true);
});

test("missing local production env is blocked, not passed", () => {
  const result = evaluateProductionEnv({});

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.details.findings.some((finding) => finding.variable === "DATABASE_URL"));
  assert.ok(result.details.findings.some((finding) => finding.variable === "RELEASE_DEPLOYMENT_ID"));
});

test("valid deployed env with redacted evidence passes without secret values", () => {
  const env = productionEnv();
  const result = evaluateProductionEnv(env);
  const serialized = JSON.stringify(result.details);

  assert.equal(result.status, "PASS");
  assert.equal(result.details.deploymentEvidence.deploymentIdPresent, true);
  assert.equal(serialized.includes(env[databasePasswordName]), false);
  assert.equal(serialized.includes(env[googleClientSecretName]), false);
});

test("placeholder or unsafe values fail even with deployment evidence", () => {
  const result = evaluateProductionEnv(productionEnv({
    DATABASE_URL: "jdbc:h2:mem:test",
    FRONTEND_URL: "http://localhost:5500",
    CORS_ALLOWED_ORIGINS: "*",
    DATABASE_PASSWORD: "password"
  }));

  assert.equal(result.status, "FAIL");
  assert.ok(result.details.findings.some((finding) => finding.variable === "DATABASE_URL"));
  assert.ok(result.details.findings.some((finding) => finding.variable === "CORS_ALLOWED_ORIGINS"));
});

test("cross-site session and OAuth redirect contract fails closed", () => {
  const result = evaluateProductionEnv(productionEnv({
    OAUTH_SUCCESS_REDIRECT_URI: "https://attacker.invalid/index.html",
    SESSION_COOKIE_SAME_SITE: "lax",
    SESSION_COOKIE_PATH: "/app"
  }));

  assert.equal(result.status, "FAIL");
  assert.ok(result.details.findings.some((finding) => finding.variable === "OAUTH_SUCCESS_REDIRECT_URI"));
  assert.ok(result.details.findings.some((finding) => finding.variable === "SESSION_COOKIE_SAME_SITE"));
  assert.ok(result.details.findings.some((finding) => finding.variable === "SESSION_COOKIE_PATH"));
});

test("invalid fixture mode passes only when the validator finds problems", () => {
  const result = evaluateProductionEnv(safeFixtureEnv({
    DATABASE_URL: "jdbc:h2:mem:test",
    DATABASE_PASSWORD: "password"
  }), { mode: "expect-invalid" });

  assert.equal(result.status, "PASS");
  assert.equal(result.details.expectedInvalidFixture, true);
});
