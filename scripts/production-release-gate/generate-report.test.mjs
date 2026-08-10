import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateReleaseGateReport } from "./generate-report.mjs";

function test(name, fn) {
  fn();
  console.log(`[PASS] ${name}`);
}

function withTempReportDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "wordarena-gate-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeControl(dir, name, payload) {
  const controlsDir = join(dir, "controls");
  writeFileSync(join(controlsDir, `${name}.json`), JSON.stringify(payload, null, 2) + "\n", "utf8");
}

test("report blocks stale PASS controls that are not tied to current commit", () => {
  withTempReportDir((dir) => {
    writeFileSync(join(dir, ".keep"), "", "utf8");
    // Ensure the controls directory exists without relying on shell helpers.
    generateReleaseGateReport({ reportDir: dir, identity: { commitSha: "current-sha", branch: "test" } });
    writeControl(dir, "production-env-validation", {
      name: "production-env-validation",
      status: "PASS",
      generatedAt: "2026-07-31T00:00:00.000Z"
    });

    const { report } = generateReleaseGateReport({
      reportDir: dir,
      identity: { commitSha: "current-sha", branch: "test" }
    });

    const envControl = report.controls.find((control) => control.name === "production-env-validation");
    assert.equal(envControl.status, "BLOCKED");
    assert.equal(envControl.artifactCommitSha, null);
    assert.equal(report.conclusion, "NO-GO");
  });
});

test("report accepts same-commit control artifacts", () => {
  withTempReportDir((dir) => {
    generateReleaseGateReport({ reportDir: dir, identity: { commitSha: "current-sha", branch: "test" } });
    writeControl(dir, "production-env-validation", {
      name: "production-env-validation",
      status: "PASS",
      commitSha: "current-sha",
      branch: "test",
      generatedAt: "2026-08-11T00:00:00.000Z"
    });

    const { report } = generateReleaseGateReport({
      reportDir: dir,
      identity: { commitSha: "current-sha", branch: "test" }
    });

    const envControl = report.controls.find((control) => control.name === "production-env-validation");
    assert.equal(envControl.status, "PASS");
  });
});
