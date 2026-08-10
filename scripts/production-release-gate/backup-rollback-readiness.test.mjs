import assert from "node:assert/strict";
import { evaluateRestoreEvidenceContent } from "./backup-rollback-readiness.mjs";

const completePassEvidence = `
# Restore Rehearsal Evidence

| Field | Evidence |
| --- | --- |
| Source backup reference | sanitized-backup-2026-08-10.dump sha256:abc123 |
| Backup verification | PASS: checksum and dump listing verified before restore |
| Restore verification | PASS: restored sanitized dump into non-production PostgreSQL |
| Flyway/app verification | PASS: Flyway validate and application startup completed |
| Health smoke | PASS: restored app server returned healthy /api/health |
| Result | PASS: backup restore, app startup, and health smoke completed |
`;

function test(name, fn) {
  fn();
  console.log(`[PASS] ${name}`);
}

test("complete restore evidence passes", () => {
  assert.equal(evaluateRestoreEvidenceContent(completePassEvidence).ok, true);
});

test("partial evidence is blocked even when it contains PASS words", () => {
  const result = evaluateRestoreEvidenceContent(`
| Field | Evidence |
| --- | --- |
| Source backup reference | Not available; no sanitized backup/dump artifact was provided |
| Backup verification | NOT VERIFIED; no backup artifact was supplied or restored |
| Restore verification | PASS for schema/Flyway/app-start rehearsal |
| Flyway/app verification | PASS: context loads |
| Health smoke | NOT RUN; no restored app server was launched |
| Result | PARTIAL PASS: backup dump restore and health smoke remain not verified |
`);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.incompleteFields.map((item) => item.field),
    ["Source backup reference", "Backup verification", "Health smoke", "Result"]
  );
});

test("failed evidence is blocked", () => {
  const result = evaluateRestoreEvidenceContent(completePassEvidence.replace(
    "PASS: backup restore, app startup, and health smoke completed",
    "FAIL: restored app health check failed"
  ));

  assert.equal(result.ok, false);
  assert.deepEqual(result.incompleteFields.map((item) => item.field), ["Result"]);
});

test("malformed evidence is blocked with missing required fields", () => {
  const result = evaluateRestoreEvidenceContent(`
| Field | Evidence |
| --- | --- |
| Result | PASS |
`);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingFields, [
    "Source backup reference",
    "Backup verification",
    "Restore verification",
    "Flyway/app verification",
    "Health smoke"
  ]);
});
