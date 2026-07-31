import { fail, pass, redactedPresence } from "./lib.mjs";

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
  "SPRING_PROFILES_ACTIVE"
];

const findings = [];
const mode = process.argv.includes("--expect-invalid") ? "expect-invalid" : "normal";

for (const name of required) {
  if (!process.env[name] || !String(process.env[name]).trim()) {
    findings.push({ variable: name, message: "Required variable is missing." });
  }
}

function value(name) {
  return String(process.env[name] || "").trim();
}

function requireExact(name, expected) {
  if (value(name).toLowerCase() !== expected) {
    findings.push({ variable: name, message: `Expected ${expected}.` });
  }
}

function requireHttpsUrl(name) {
  const raw = value(name);
  if (!/^https:\/\//i.test(raw)) {
    findings.push({ variable: name, message: "Production URL must use HTTPS." });
  }
  if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(raw)) {
    findings.push({ variable: name, message: "Production URL must not use localhost, placeholder, or example domain." });
  }
}

requireHttpsUrl("FRONTEND_URL");
requireExact("JPA_DDL_AUTO", "validate");
requireExact("FLYWAY_ENABLED", "true");
requireExact("FLYWAY_BASELINE_ON_MIGRATE", "false");
requireExact("SESSION_COOKIE_SECURE", "true");

const profile = value("SPRING_PROFILES_ACTIVE").toLowerCase();
if (!["prod", "production"].includes(profile)) {
  findings.push({ variable: "SPRING_PROFILES_ACTIVE", message: "Steady-state release gate expects prod or production profile." });
}

const sameSite = value("SESSION_COOKIE_SAME_SITE").toLowerCase();
if (!["none", "lax", "strict"].includes(sameSite)) {
  findings.push({ variable: "SESSION_COOKIE_SAME_SITE", message: "Must be one of none/lax/strict." });
}
if (sameSite === "none" && value("SESSION_COOKIE_SECURE").toLowerCase() !== "true") {
  findings.push({ variable: "SESSION_COOKIE_SECURE", message: "SameSite=None requires Secure cookies." });
}

const corsOrigins = value("CORS_ALLOWED_ORIGINS").split(",").map((item) => item.trim()).filter(Boolean);
if (!corsOrigins.length) {
  findings.push({ variable: "CORS_ALLOWED_ORIGINS", message: "At least one trusted origin is required." });
}
for (const origin of corsOrigins) {
  if (origin === "*" || origin.includes("*")) {
    findings.push({ variable: "CORS_ALLOWED_ORIGINS", message: "Wildcard CORS origin is forbidden." });
  }
  if (!/^https:\/\//i.test(origin)) {
    findings.push({ variable: "CORS_ALLOWED_ORIGINS", message: "Production CORS origin must use HTTPS." });
  }
  if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(origin)) {
    findings.push({ variable: "CORS_ALLOWED_ORIGINS", message: "Production CORS origin must not be local or placeholder." });
  }
}

const databaseUrl = value("DATABASE_URL");
if (!/^jdbc:postgresql:\/\//i.test(databaseUrl)) {
  findings.push({ variable: "DATABASE_URL", message: "Production database URL must be JDBC PostgreSQL." });
}
if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(databaseUrl)) {
  findings.push({ variable: "DATABASE_URL", message: "Production database URL must not be local or placeholder." });
}

for (const secretName of ["DATABASE_PASSWORD", "GOOGLE_CLIENT_SECRET"]) {
  const secret = value(secretName);
  if (secret.length < 12 || /^(changeme|password|secret|test|placeholder)$/i.test(secret)) {
    findings.push({ variable: secretName, message: "Secret is missing or appears to be a weak default." });
  }
}

const csrfEnabledByCode = true;
if (!csrfEnabledByCode) {
  findings.push({ variable: "CSRF", message: "CSRF must remain enabled by SecurityConfig." });
}

const details = {
  checkedVariables: required.map(redactedPresence),
  findingCount: findings.length,
  findings
};

if (mode === "expect-invalid") {
  if (findings.length) {
    pass(control, { ...details, expectedInvalidFixture: true });
  } else {
    fail(control, { ...details, expectedInvalidFixture: true, message: "Invalid fixture unexpectedly passed." });
  }
} else if (findings.length) {
  fail(control, details);
} else {
  pass(control, details);
}
