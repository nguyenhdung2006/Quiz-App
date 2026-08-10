import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gitIdentity, reportDir } from "./lib.mjs";

const expectedControls = [
  "source-integrity",
  "secret-scan",
  "backend-full-test",
  "security-regression-tests",
  "observability-rate-limit-controls",
  "frontend-static-build",
  "frontend-playwright-smoke",
  "flyway-rehearsal",
  "two-device-sync",
  "production-env-validator-self-test",
  "production-env-validation",
  "production-env-invalid-fixture",
  "backup-rollback-readiness",
  "staging-smoke"
];

function readControl(name, controlsDir, commitSha) {
  const path = join(controlsDir, `${name}.json`);
  if (!existsSync(path)) {
    return {
      name,
      status: "NOT_RUN",
      reason: "No control status file was produced."
    };
  }
  const control = JSON.parse(readFileSync(path, "utf8"));
  if (!control.commitSha || control.commitSha !== commitSha) {
    return {
      name,
      status: "BLOCKED",
      reason: "Control artifact is stale or not tied to the current release candidate commit.",
      expectedCommitSha: commitSha,
      artifactCommitSha: control.commitSha || null,
      artifactGeneratedAt: control.generatedAt || null,
      artifactStatus: control.status || null
    };
  }
  return control;
}

export function generateReleaseGateReport(options = {}) {
  const outputDir = options.reportDir || reportDir;
  const controlsDir = join(outputDir, "controls");
  mkdirSync(controlsDir, { recursive: true });
  const identity = options.identity || gitIdentity();
  const commitSha = identity.commitSha;
  const branch = identity.branch;
  const controls = expectedControls.map((name) => readControl(name, controlsDir, commitSha));
  const finalConclusion = controls.every((control) => control.status === "PASS") ? "GO" : "NO-GO";
  const generatedAt = new Date().toISOString();
  const environment = process.env.GITHUB_ACTIONS ? "github-actions" : "local";

  const markdown = [
    "# Production Release Gate Report",
    "",
    `- Commit SHA: ${commitSha}`,
    `- Branch: ${branch}`,
    `- Generated at: ${generatedAt}`,
    `- Environment: ${environment}`,
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
    "- Control artifacts must be generated for the same commit SHA as the report.",
    ""
  ].join("\n");

  const report = {
    commitSha,
    branch,
    generatedAt,
    environment,
    conclusion: finalConclusion,
    controls
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "production-release-gate-report.md"), markdown, "utf8");
  writeFileSync(join(outputDir, "production-release-gate-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  return { markdown, report };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = generateReleaseGateReport();
  console.log(result.markdown);
  if (result.report.conclusion !== "GO") {
    process.exitCode = 1;
  }
}
