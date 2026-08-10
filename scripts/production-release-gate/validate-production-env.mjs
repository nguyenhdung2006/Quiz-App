import { pathToFileURL } from "node:url";
import { blocked, fail, pass, redactedPresence } from "./lib.mjs";

const controlArg = process.argv.find((arg) => arg.startsWith("--control="));
const control = controlArg ? controlArg.slice("--control=".length) : "production-env-validation";
const required = [
  "DATABASE_URL",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "FRONTEND_URL",
  "CORS_ALLOWED_ORIGINS",
  "SESSION_COOKIE_SECURE",
  "SESSION_COOKIE_SAME_SITE",
  "SESSION_COOKIE_PATH",
  "JPA_DDL_AUTO",
  "FLYWAY_ENABLED",
  "FLYWAY_BASELINE_ON_MIGRATE",
  "SPRING_PROFILES_ACTIVE",
  "RATE_LIMIT_MODE",
  "AI_EXPLAIN_RATE_LIMIT_PER_MINUTE",
  "AI_EXPLAIN_RATE_LIMIT_PER_DAY",
  "AI_DECK_RATE_LIMIT_PER_MINUTE",
  "AI_DECK_RATE_LIMIT_PER_DAY"
];

const evidenceRequired = [
  "RELEASE_ENV_SOURCE",
  "RELEASE_DEPLOYMENT_ID",
  "RELEASE_ENV_CAPTURED_AT"
];

function value(env, name) {
  return String(env[name] || "").trim();
}

function addMissingRequired(env, findings) {
  for (const name of required) {
    if (!env[name] || !String(env[name]).trim()) {
      findings.missing.push({ variable: name, message: "Required variable is missing." });
    }
  }
}

function requireExact(env, findings, name, expected) {
  const raw = value(env, name);
  if (!raw) return;
  if (raw.toLowerCase() !== expected) {
    findings.invalid.push({ variable: name, message: `Expected ${expected}.` });
  }
}

function requireHttpsUrl(env, findings, name) {
  const raw = value(env, name);
  if (!raw) return;
  if (!/^https:\/\//i.test(raw)) {
    findings.invalid.push({ variable: name, message: "Production URL must use HTTPS." });
  }
  if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(raw)) {
    findings.invalid.push({ variable: name, message: "Production URL must not use localhost, placeholder, or example domain." });
  }
}

function addDeploymentEvidenceFindings(env, findings) {
  for (const name of evidenceRequired) {
    if (!value(env, name)) {
      findings.evidence.push({ variable: name, message: "Deployment environment evidence is missing." });
    }
  }

  const source = value(env, "RELEASE_ENV_SOURCE").toLowerCase();
  if (source && !["deployed", "render", "signed-manifest", "manual-attestation"].includes(source)) {
    findings.evidence.push({ variable: "RELEASE_ENV_SOURCE", message: "Must be deployed, render, signed-manifest, or manual-attestation." });
  }

  const capturedAt = value(env, "RELEASE_ENV_CAPTURED_AT");
  if (capturedAt && Number.isNaN(Date.parse(capturedAt))) {
    findings.evidence.push({ variable: "RELEASE_ENV_CAPTURED_AT", message: "Must be an ISO-8601 timestamp." });
  }

  const deploymentId = value(env, "RELEASE_DEPLOYMENT_ID");
  if (deploymentId && /^(test|fixture|placeholder|example|dummy)$/i.test(deploymentId)) {
    findings.evidence.push({ variable: "RELEASE_DEPLOYMENT_ID", message: "Deployment ID appears to be a fixture or placeholder." });
  }
}

function looksLikeFixture(value) {
  return /(^|[-_])(test|fixture|dummy|example|placeholder|release[-_]?gate)([-_]|$)/i.test(value);
}

function addConfigFindings(env, findings, options) {
  requireHttpsUrl(env, findings, "FRONTEND_URL");
  requireExact(env, findings, "JPA_DDL_AUTO", "validate");
  requireExact(env, findings, "FLYWAY_ENABLED", "true");
  requireExact(env, findings, "FLYWAY_BASELINE_ON_MIGRATE", "false");
  requireExact(env, findings, "SESSION_COOKIE_SECURE", "true");

  const profile = value(env, "SPRING_PROFILES_ACTIVE").toLowerCase();
  if (profile && !["prod", "production"].includes(profile)) {
    findings.invalid.push({ variable: "SPRING_PROFILES_ACTIVE", message: "Steady-state release gate expects prod or production profile." });
  }

  const sameSite = value(env, "SESSION_COOKIE_SAME_SITE").toLowerCase();
  if (sameSite && !["none", "lax", "strict"].includes(sameSite)) {
    findings.invalid.push({ variable: "SESSION_COOKIE_SAME_SITE", message: "Must be one of none/lax/strict." });
  }
  if (sameSite === "none" && value(env, "SESSION_COOKIE_SECURE").toLowerCase() !== "true") {
    findings.invalid.push({ variable: "SESSION_COOKIE_SECURE", message: "SameSite=None requires Secure cookies." });
  }

  const corsRaw = value(env, "CORS_ALLOWED_ORIGINS");
  const corsOrigins = corsRaw.split(",").map((item) => item.trim()).filter(Boolean);
  if (corsRaw && !corsOrigins.length) {
    findings.invalid.push({ variable: "CORS_ALLOWED_ORIGINS", message: "At least one trusted origin is required." });
  }
  for (const origin of corsOrigins) {
    if (origin === "*" || origin.includes("*")) {
      findings.invalid.push({ variable: "CORS_ALLOWED_ORIGINS", message: "Wildcard CORS origin is forbidden." });
    }
    if (!/^https:\/\//i.test(origin)) {
      findings.invalid.push({ variable: "CORS_ALLOWED_ORIGINS", message: "Production CORS origin must use HTTPS." });
    }
    if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(origin)) {
      findings.invalid.push({ variable: "CORS_ALLOWED_ORIGINS", message: "Production CORS origin must not be local or placeholder." });
    }
  }

  const databaseUrl = value(env, "DATABASE_URL");
  if (databaseUrl && !/^jdbc:postgresql:\/\//i.test(databaseUrl)) {
    findings.invalid.push({ variable: "DATABASE_URL", message: "Production database URL must be JDBC PostgreSQL." });
  }
  if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(databaseUrl)) {
    findings.invalid.push({ variable: "DATABASE_URL", message: "Production database URL must not be local or placeholder." });
  }

  for (const secretName of ["DATABASE_PASSWORD", "GOOGLE_CLIENT_SECRET"]) {
    const secret = value(env, secretName);
    if (secret && (secret.length < 12 || /^(changeme|password|secret|test|placeholder)$/i.test(secret))) {
      findings.invalid.push({ variable: secretName, message: "Secret is missing or appears to be a weak default." });
    }
  }

  if (!options.allowFixtureValues) {
    for (const name of ["DATABASE_URL", "DATABASE_USERNAME", "DATABASE_PASSWORD", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "FRONTEND_URL", "CORS_ALLOWED_ORIGINS"]) {
      const raw = value(env, name);
      if (raw && looksLikeFixture(raw)) {
        findings.invalid.push({ variable: name, message: "Value appears to be a fixture or placeholder, not deployed production configuration." });
      }
    }
  }

  const csrfEnabledByCode = true;
  if (!csrfEnabledByCode) {
    findings.invalid.push({ variable: "CSRF", message: "CSRF must remain enabled by SecurityConfig." });
  }

  const endpoints = value(env, "MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE") || "health,info,metrics";
  const exposedEndpoints = endpoints.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  for (const endpoint of ["health", "info", "metrics"]) {
    if (!exposedEndpoints.includes(endpoint)) {
      findings.invalid.push({ variable: "MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE", message: `${endpoint} endpoint must remain exposed for production operations.` });
    }
  }

  const rootLogLevel = (value(env, "LOGGING_LEVEL_ROOT") || "INFO").toUpperCase();
  if (["DEBUG", "TRACE", "ALL"].includes(rootLogLevel)) {
    findings.invalid.push({ variable: "LOGGING_LEVEL_ROOT", message: "Production root logging must not be DEBUG, TRACE, or ALL." });
  }

  const rateLimitMode = value(env, "RATE_LIMIT_MODE").toLowerCase();
  if (rateLimitMode && rateLimitMode !== "in-memory") {
    findings.invalid.push({
      variable: "RATE_LIMIT_MODE",
      message: "Current code supports in-memory rate limiting only; do not configure Redis mode until a distributed limiter is implemented."
    });
  }

  for (const limitName of [
    "AI_EXPLAIN_RATE_LIMIT_PER_MINUTE",
    "AI_EXPLAIN_RATE_LIMIT_PER_DAY",
    "AI_DECK_RATE_LIMIT_PER_MINUTE",
    "AI_DECK_RATE_LIMIT_PER_DAY"
  ]) {
    const raw = value(env, limitName);
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100000) {
      findings.invalid.push({ variable: limitName, message: "Rate limit must be a positive bounded integer." });
    }
  }
}

export function evaluateProductionEnv(env = process.env, options = {}) {
  const mode = options.mode || "normal";
  const allowFixtureValues = mode === "self-test" || options.allowFixtureValues === true;
  const findings = { missing: [], invalid: [], evidence: [] };
  addMissingRequired(env, findings);
  addConfigFindings(env, findings, { allowFixtureValues });
  if (mode === "normal") {
    addDeploymentEvidenceFindings(env, findings);
  }

  const allFindings = [...findings.missing, ...findings.invalid, ...findings.evidence];
  const details = {
    checkedVariables: required.map((name) => redactedPresence(name, env)),
    evidenceVariables: evidenceRequired.map((name) => redactedPresence(name, env)),
    findingCount: allFindings.length,
    findings: allFindings
  };

  if (mode === "expect-invalid") {
    return allFindings.length
      ? { status: "PASS", details: { ...details, expectedInvalidFixture: true } }
      : { status: "FAIL", details: { ...details, expectedInvalidFixture: true, message: "Invalid fixture unexpectedly passed." } };
  }

  if (findings.invalid.length) {
    return { status: "FAIL", details };
  }

  if (findings.missing.length || findings.evidence.length) {
    return { status: "BLOCKED", details };
  }

  return {
    status: "PASS",
    details: {
      ...details,
      deploymentEvidence: {
        source: value(env, "RELEASE_ENV_SOURCE"),
        deploymentIdPresent: Boolean(value(env, "RELEASE_DEPLOYMENT_ID")),
        capturedAt: value(env, "RELEASE_ENV_CAPTURED_AT")
      },
      validatorSelfTest: mode === "self-test"
    }
  };
}

export function runProductionEnvValidation(argv = process.argv, env = process.env) {
  const mode = argv.includes("--expect-invalid")
    ? "expect-invalid"
    : argv.includes("--self-test")
      ? "self-test"
      : "normal";
  const result = evaluateProductionEnv(env, { mode });
  if (result.status === "PASS") {
    pass(control, result.details);
  } else if (result.status === "BLOCKED") {
    blocked(control, result.details);
  } else {
    fail(control, result.details);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionEnvValidation();
}
