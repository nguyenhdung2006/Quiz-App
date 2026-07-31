import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fail, pass, reportDir, writeJson } from "./lib.mjs";

const control = "source-integrity";
const findings = [];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const commitSha = process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]);
const branch = process.env.GITHUB_REF_NAME || git(["branch", "--show-current"]);
const status = git(["status", "--porcelain"]);
if (status) {
  findings.push({
    severity: "high",
    message: "Working tree is dirty before release gate execution.",
    evidence: status.split(/\r?\n/).slice(0, 50)
  });
}

const migrationDir = "backend/src/main/resources/db/migration";
const migrations = existsSync(migrationDir)
  ? readdirSync(migrationDir).filter((file) => /^V\d+__.*\.sql$/.test(file)).sort()
  : [];
const versions = new Map();
for (const file of migrations) {
  const version = file.match(/^V(\d+)__/)[1];
  versions.set(version, [...(versions.get(version) || []), file]);
}
for (const [version, files] of versions.entries()) {
  if (files.length > 1) {
    findings.push({
      severity: "critical",
      message: `Duplicate Flyway migration version V${version}.`,
      files
    });
  }
}

const prodConfigPath = "backend/src/main/resources/application-prod.yml";
if (!existsSync(prodConfigPath)) {
  findings.push({ severity: "critical", message: "Missing production profile config.", file: prodConfigPath });
} else {
  const prodConfig = readFileSync(prodConfigPath, "utf8");
  const dangerousPatterns = [
    { pattern: /ddl-auto:\s*(update|create|create-drop)\b/i, message: "Production Hibernate ddl-auto is mutating schema." },
    { pattern: /enabled:\s*false\b/i, context: /flyway:/i, message: "Production Flyway appears disabled." },
    { pattern: /baseline-on-migrate:\s*true\b/i, message: "Production app profile must not baseline automatically." },
    { pattern: /clean-disabled:\s*false\b/i, message: "Flyway clean must remain disabled." }
  ];
  for (const rule of dangerousPatterns) {
    if (rule.pattern.test(prodConfig) && (!rule.context || rule.context.test(prodConfig))) {
      findings.push({ severity: "critical", message: rule.message, file: prodConfigPath });
    }
  }
}

const forbiddenBuildContext = [
  "playwright-report",
  "test-results",
  "release-gate-artifacts"
].filter((path) => existsSync(path));

writeJson(join(reportDir, "source-integrity-details.json"), {
  commitSha,
  branch,
  migrations: migrations.map((file) => basename(file)),
  forbiddenBuildContext
});

if (forbiddenBuildContext.length) {
  findings.push({
    severity: "medium",
    message: "Generated report/test directories exist in build context. They must be ignored and not committed.",
    paths: forbiddenBuildContext
  });
}

if (findings.length) {
  fail(control, { commitSha, branch, findings });
} else {
  pass(control, { commitSha, branch, migrationCount: migrations.length });
}
