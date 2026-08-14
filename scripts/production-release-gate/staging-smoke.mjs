import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { blocked, fail, pass } from "./lib.mjs";

const control = "staging-smoke";
const required = ["STAGING_BACKEND_URL", "STAGING_FRONTEND_URL", "STAGING_TEST_USER_HINT"];
const defaultEvidenceFile = "docs/staging-auth-smoke-evidence.md";
const requiredEvidenceFields = [
  "Smoke date/time",
  "Commit",
  "Environment",
  "Operator",
  "Staging frontend URL",
  "Staging backend URL",
  "Health smoke",
  "CSRF smoke",
  "OAuth/auth smoke",
  "Vocabulary CRUD smoke",
  "Sync smoke",
  "Delete/tombstone smoke",
  "Logout smoke",
  "RTO/RPO notes",
  "Result"
];
const smokeEvidenceFields = new Set([
  "Health smoke",
  "CSRF smoke",
  "OAuth/auth smoke",
  "Vocabulary CRUD smoke",
  "Sync smoke",
  "Delete/tombstone smoke",
  "Logout smoke"
]);
const incompleteEvidencePattern = /\b(partial|not verified|not run|not available|blocked|fail|failed|missing|unavailable|not full|manual only|todo|unknown)\b/i;

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

export function evaluateStagingAuthSmokeEvidenceContent(content) {
  const fields = parseEvidenceTable(content);
  const missingFields = requiredEvidenceFields.filter((field) => !fields.has(field.toLowerCase()));
  const incompleteFields = [];

  for (const field of requiredEvidenceFields) {
    const value = fields.get(field.toLowerCase()) || "";
    if (!value || incompleteEvidencePattern.test(value)) {
      incompleteFields.push({ field, reason: "missing-or-incomplete" });
      continue;
    }
    if ((field === "Result" || smokeEvidenceFields.has(field)) && !/^pass\b/i.test(value)) {
      incompleteFields.push({ field, reason: "must-start-with-pass" });
    }
  }

  return {
    ok: missingFields.length === 0 && incompleteFields.length === 0,
    missingFields,
    incompleteFields,
    requiredEvidenceFields
  };
}

function evaluateEvidenceFile(path) {
  if (!existsSync(path)) {
    return {
      ok: false,
      missingEvidence: [path],
      missingFields: requiredEvidenceFields,
      incompleteFields: [],
      requiredEvidenceFields
    };
  }
  return {
    missingEvidence: [],
    ...evaluateStagingAuthSmokeEvidenceContent(readFileSync(path, "utf8"))
  };
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

async function checkJson(fetchImpl, backendUrl, path) {
  const response = await fetchImpl(`${backendUrl}${path}`, { redirect: "manual" });
  return {
    path,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    setCookie: response.headers.has("set-cookie")
  };
}

export async function evaluateStagingSmoke(env = process.env, fetchImpl = fetch) {
  const missing = required.filter((name) => !env[name] || !String(env[name]).trim());
  const evidenceFile = env.STAGING_AUTH_SMOKE_EVIDENCE_FILE || defaultEvidenceFile;
  const evidence = evaluateEvidenceFile(evidenceFile);
  if (missing.length) {
    return {
      status: "BLOCKED",
      details: {
        reason: "Staging smoke requires configured staging URLs, non-secret test identity metadata, and authenticated smoke evidence.",
        missingVariables: missing,
        authSmokeEvidence: evidenceFile,
        evidence
      }
    };
  }

  const backendUrl = normalizeUrl(env.STAGING_BACKEND_URL);
  const frontendUrl = normalizeUrl(env.STAGING_FRONTEND_URL);
  const findings = [];

  for (const [name, url] of [["STAGING_BACKEND_URL", backendUrl], ["STAGING_FRONTEND_URL", frontendUrl]]) {
    if (!/^https:\/\//i.test(url)) {
      findings.push({ variable: name, message: "Staging URL must use HTTPS." });
    }
    if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(url)) {
      findings.push({ variable: name, message: "Staging URL must not be local or placeholder." });
    }
  }

  try {
    const health = await checkJson(fetchImpl, backendUrl, "/api/health");
    if (health.status < 200 || health.status >= 300) {
      findings.push({ path: health.path, message: `Unexpected status ${health.status}.` });
    }

    const csrf = await checkJson(fetchImpl, backendUrl, "/api/csrf");
    if (csrf.status < 200 || csrf.status >= 300 || !csrf.contentType.includes("application/json")) {
      findings.push({ path: csrf.path, message: "CSRF endpoint did not return JSON success." });
    }
    if (!csrf.setCookie) {
      findings.push({ path: csrf.path, message: "CSRF endpoint did not issue a cookie." });
    }

    const frontend = await fetchImpl(frontendUrl, { redirect: "manual" });
    if (frontend.status < 200 || frontend.status >= 400) {
      findings.push({ variable: "STAGING_FRONTEND_URL", message: `Frontend returned status ${frontend.status}.` });
    }
  } catch (error) {
    findings.push({ message: "Staging smoke request failed.", error: String(error.message || error) });
  }

  if (findings.length) {
    return { status: "FAIL", details: { findings } };
  }

  if (!evidence.ok) {
    return {
      status: "BLOCKED",
      details: {
        reason: "Authenticated staging smoke is not proven by complete evidence.",
        checked: ["/api/health", "/api/csrf", "frontend root"],
        authSmokeEvidence: evidenceFile,
        evidence
      }
    };
  }

  return {
    status: "PASS",
    details: {
      checked: ["/api/health", "/api/csrf", "frontend root"],
      authSmokeEvidence: evidenceFile
    }
  };
}

export async function runStagingSmoke(env = process.env, fetchImpl = fetch) {
  const result = await evaluateStagingSmoke(env, fetchImpl);
  if (result.status === "PASS") {
    pass(control, result.details);
  } else if (result.status === "BLOCKED") {
    blocked(control, result.details);
  } else {
    fail(control, result.details);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runStagingSmoke();
}
