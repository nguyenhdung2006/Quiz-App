import { existsSync, readFileSync } from "node:fs";
import { blocked, pass } from "./lib.mjs";

const control = "backup-rollback-readiness";
const requiredDocs = [
  "docs/DEPLOYMENT.md",
  "docs/PRODUCTION_RELEASE_GATE.md",
  "docs/flyway-baseline-rehearsal.md",
  "docs/deploy.md"
];

const requiredTerms = [
  "backup",
  "restore rehearsal",
  "rollback app",
  "forward-fix",
  "owner",
  "rollback trigger"
];

const missingDocs = requiredDocs.filter((path) => !existsSync(path));
const content = requiredDocs
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8").toLowerCase())
  .join("\n");
const missingTerms = requiredTerms.filter((term) => !content.includes(term));
const restoreEvidenceFile = "docs/restore-rehearsal-evidence.md";
const hasRestoreEvidence = existsSync(restoreEvidenceFile)
  || String(process.env.RELEASE_RESTORE_REHEARSAL_EVIDENCE || "").trim().toLowerCase() === "true";

if (missingDocs.length || missingTerms.length || !hasRestoreEvidence) {
  blocked(control, {
    reason: "Backup/rollback readiness is not proven by concrete docs and rehearsal evidence.",
    missingDocs,
    missingTerms,
    missingEvidence: hasRestoreEvidence ? [] : [restoreEvidenceFile, "RELEASE_RESTORE_REHEARSAL_EVIDENCE=true"],
    requiredEvidence: [
      "backup command before migration",
      "backup verification",
      "restore rehearsal on non-production",
      "application rollback steps",
      "database rollback or forward-fix policy",
      "owner",
      "rollback trigger criteria"
    ]
  });
} else {
  pass(control, {
    docs: requiredDocs,
    restoreEvidence: existsSync(restoreEvidenceFile) ? restoreEvidenceFile : "RELEASE_RESTORE_REHEARSAL_EVIDENCE=true"
  });
}
