import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
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

const requiredEvidenceFields = [
  "Source backup reference",
  "Backup verification",
  "Restore verification",
  "Flyway/app verification",
  "Health smoke",
  "Result"
];

const incompleteEvidencePattern = /\b(partial|not verified|not run|not available|blocked|fail|failed|missing|unavailable|no backup|no sanitized backup|not full)\b/i;

function parseEvidenceTable(content) {
  const fields = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || /^\|\s*-+/.test(trimmed)) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length >= 2 && cells[0] && cells[1] && cells[0].toLowerCase() !== "field") {
      fields.set(cells[0].toLowerCase(), cells[1]);
    }
  }
  return fields;
}

export function evaluateRestoreEvidenceContent(content) {
  const fields = parseEvidenceTable(content);
  const missingFields = requiredEvidenceFields.filter((field) => !fields.has(field.toLowerCase()));
  const incompleteFields = [];

  for (const field of requiredEvidenceFields) {
    const value = fields.get(field.toLowerCase()) || "";
    if (field === "Result") {
      if (!/^pass\b/i.test(value) || incompleteEvidencePattern.test(value)) {
        incompleteFields.push({ field, value });
      }
      continue;
    }
    if (!value || incompleteEvidencePattern.test(value)) {
      incompleteFields.push({ field, value });
    }
  }

  return {
    ok: missingFields.length === 0 && incompleteFields.length === 0,
    missingFields,
    incompleteFields,
    requiredEvidenceFields
  };
}

export function evaluateBackupRollbackReadiness(env = process.env) {
  const missingDocs = requiredDocs.filter((path) => !existsSync(path));
  const content = requiredDocs
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8").toLowerCase())
    .join("\n");
  const missingTerms = requiredTerms.filter((term) => !content.includes(term));
  const restoreEvidenceFile = env.RELEASE_RESTORE_REHEARSAL_EVIDENCE_FILE || "docs/restore-rehearsal-evidence.md";
  const evidenceExists = existsSync(restoreEvidenceFile);
  const evidenceResult = evidenceExists
    ? evaluateRestoreEvidenceContent(readFileSync(restoreEvidenceFile, "utf8"))
    : {
      ok: false,
      missingFields: requiredEvidenceFields,
      incompleteFields: [],
      requiredEvidenceFields
    };

  if (missingDocs.length || missingTerms.length || !evidenceExists || !evidenceResult.ok) {
    return {
      status: "BLOCKED",
      details: {
        reason: "Backup/rollback readiness is not proven by complete restore rehearsal evidence.",
        missingDocs,
        missingTerms,
        missingEvidence: evidenceExists ? [] : [restoreEvidenceFile],
        restoreEvidence: restoreEvidenceFile,
        evidence: evidenceResult,
        requiredEvidence: [
          "backup command before migration",
          "backup verification",
          "restore rehearsal on non-production",
          "application rollback steps",
          "database rollback or forward-fix policy",
          "owner",
          "rollback trigger criteria",
          "restored application health smoke"
        ]
      }
    };
  }

  return {
    status: "PASS",
    details: {
      docs: requiredDocs,
      restoreEvidence: restoreEvidenceFile
    }
  };
}

export function runBackupRollbackReadiness(env = process.env) {
  const result = evaluateBackupRollbackReadiness(env);
  if (result.status === "PASS") {
    pass(control, result.details);
  } else {
    blocked(control, result.details);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBackupRollbackReadiness();
}
