import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { reportDir } from "./lib.mjs";

const controlsDir = join(reportDir, "controls");
mkdirSync(controlsDir, { recursive: true });

const expectedControls = [
  "source-integrity",
  "secret-scan",
  "backend-full-test",
  "security-regression-tests",
  "frontend-static-build",
  "frontend-playwright-smoke",
  "flyway-rehearsal",
  "two-device-sync",
  "production-env-validation",
  "production-env-invalid-fixture",
  "backup-rollback-readiness",
  "staging-smoke"
];

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function gitHeadFallback() {
  try {
    const head = readFileSync(".git/HEAD", "utf8").trim();
    if (head.startsWith("ref: ")) {
      const ref = head.slice("ref: ".length);
      const shaPath = `.git/${ref}`;
      return {
        branch: ref.replace("refs/heads/", ""),
        commitSha: existsSync(shaPath) ? readFileSync(shaPath, "utf8").trim() : "unknown"
      };
    }
    return { branch: "detached", commitSha: head };
  } catch {
    return { branch: "unknown", commitSha: "unknown" };
  }
}

function readControl(name) {
  const path = join(controlsDir, `${name}.json`);
  if (!existsSync(path)) {
    return {
      name,
      status: "NOT_RUN",
      reason: "No control status file was produced."
    };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const controls = expectedControls.map(readControl);
const finalConclusion = controls.every((control) => control.status === "PASS") ? "GO" : "NO-GO";
const generatedAt = new Date().toISOString();
const fallback = gitHeadFallback();
const commitSha = process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]) || fallback.commitSha;
const branch = process.env.GITHUB_REF_NAME || git(["branch", "--show-current"]) || fallback.branch;

const markdown = [
  "# Production Release Gate Report",
  "",
  `- Commit SHA: ${commitSha}`,
  `- Branch: ${branch}`,
  `- Generated at: ${generatedAt}`,
  `- Environment: ${process.env.GITHUB_ACTIONS ? "github-actions" : "local"}`,
  `- Final conclusion: ${finalConclusion}`,
  "",
  "## Controls",
  "",
  "| Control | Status | Evidence |",
  "| --- | --- | --- |",
  ...controls.map((control) => `| ${control.name} | ${control.status} | controls/${control.name}.json |`),
  "",
  "## Rules",
  "",
  "- GO requires every mandatory control to be PASS.",
  "- FAIL, BLOCKED, or NOT_RUN means NO-GO.",
  "- Staging/OAuth/backup restore are not marked PASS unless the configured evidence exists.",
  ""
].join("\n");

mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, "production-release-gate-report.md"), markdown, "utf8");
writeFileSync(join(reportDir, "production-release-gate-report.json"), JSON.stringify({
  commitSha,
  branch,
  generatedAt,
  environment: process.env.GITHUB_ACTIONS ? "github-actions" : "local",
  conclusion: finalConclusion,
  controls
}, null, 2) + "\n", "utf8");

console.log(markdown);
if (finalConclusion !== "GO") {
  process.exitCode = 1;
}
