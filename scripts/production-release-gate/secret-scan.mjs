import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fail, pass, reportDir, writeJson } from "./lib.mjs";

const control = "secret-scan";
const findings = [];
const ignoredDirs = new Set([".git", "node_modules", "target", "backend/target", "playwright-report", "test-results", "release-gate-artifacts", "archive"]);
const allowedSecretLikeFiles = new Set([".env.example", ".env.production.example", "backend/.env.example", "backend/config/oauth2-google.example.yml"]);
const maxFileBytes = 1024 * 1024;

const filePatterns = [
  /^\.env(\..+)?$/,
  /client_secret_.*\.json$/i,
  /id_rsa$/i,
  /private[-_]?key/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i
];

const contentPatterns = [
  { name: "private-key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/ },
  { name: "github-token", regex: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { name: "google-oauth-secret", regex: /GOCSPX-[A-Za-z0-9_-]{20,}/ },
  { name: "openai-key", regex: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "password-assignment", regex: /(password|secret|token|api[_-]?key)\s*[:=]\s*["']?(?!changeme|placeholder|replace-with|your-|release-gate|test|example|false|true)[A-Za-z0-9_./+=-]{16,}/i }
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
    if ([...ignoredDirs].some((ignored) => normalized === ignored || normalized.startsWith(`${ignored}/`))) {
      continue;
    }
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }
    const relative = normalized;
    if (!allowedSecretLikeFiles.has(relative) && filePatterns.some((pattern) => pattern.test(entry))) {
      findings.push({ severity: "critical", file: relative, rule: "secret-like-filename" });
    }
    if (stats.size > maxFileBytes) continue;
    if (allowedSecretLikeFiles.has(relative) || relative.startsWith("tests/")) {
      continue;
    }
    let content = "";
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const rule of contentPatterns) {
      if (rule.regex.test(content)) {
        findings.push({ severity: "critical", file: relative, rule: rule.name });
      }
    }
  }
}

walk(".");
writeJson(join(reportDir, "secret-scan.json"), { findingCount: findings.length, findings });

if (findings.length) {
  fail(control, { findingCount: findings.length, findings });
} else {
  pass(control, { findingCount: 0 });
}
