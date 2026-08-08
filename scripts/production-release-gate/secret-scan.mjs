import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fail, pass, reportDir, writeJson } from "./lib.mjs";

const control = "secret-scan";
const findings = [];
const ignoredDirs = new Set([".git", "node_modules", "target", "backend/target", "playwright-report", "test-results", "release-gate-artifacts", "archive"]);
const allowedSecretLikeFiles = new Set([".env.example", ".env.production.example", "backend/.env.example", "backend/config/oauth2-google.example.yml"]);
const ignoredLocalSecretFiles = new Set(["backend/config/oauth2-google.yml", "backend/src/main/resources/application-local.yml"]);
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
  { name: "password-assignment", regex: /(password|secret|token|api[_-]?key)[^\S\r\n]*[:=][^\S\r\n]*["']?(?!changeme|placeholder|replace-with|your-|release-gate|test|example|false|true)[A-Za-z0-9_./+=-]{16,}/i }
];

function gitScanFiles() {
  try {
    return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function shouldIgnorePath(normalized) {
  return [...ignoredDirs].some((ignored) => normalized === ignored || normalized.startsWith(`${ignored}/`));
}

function isIgnoredLocalSecretPath(relative) {
  const entry = relative.split("/").pop();
  return ignoredLocalSecretFiles.has(relative)
    || /^\.env(\..+)?$/.test(entry)
    || /^client_secret_.*\.json$/i.test(entry);
}

function scanFile(relative, options = {}) {
  const path = relative.replaceAll("/", "\\");
  const entry = relative.split("/").pop();
  if (options.fallbackWalk && isIgnoredLocalSecretPath(relative) && !allowedSecretLikeFiles.has(relative)) {
    return;
  }
  if (shouldIgnorePath(relative) || !existsSync(path)) return;
  const stats = statSync(path);
  if (!stats.isFile()) return;
  if (!allowedSecretLikeFiles.has(relative) && filePatterns.some((pattern) => pattern.test(entry))) {
    findings.push({ severity: "critical", file: relative, rule: "secret-like-filename" });
  }
  if (stats.size > maxFileBytes) return;
  if (allowedSecretLikeFiles.has(relative) || relative.startsWith("tests/")) {
    return;
  }
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const rule of contentPatterns) {
    if (rule.regex.test(content)) {
      findings.push({ severity: "critical", file: relative, rule: rule.name });
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
    if (shouldIgnorePath(normalized)) {
      continue;
    }
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }
    scanFile(normalized, { fallbackWalk: true });
  }
}

const gitFiles = gitScanFiles();
if (gitFiles) {
  gitFiles.forEach(scanFile);
} else {
  walk(".");
}
writeJson(join(reportDir, "secret-scan.json"), { findingCount: findings.length, findings });

if (findings.length) {
  fail(control, { findingCount: findings.length, findings });
} else {
  pass(control, { findingCount: 0 });
}
