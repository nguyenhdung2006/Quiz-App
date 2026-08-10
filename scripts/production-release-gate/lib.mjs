import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const reportDir = process.env.RELEASE_GATE_REPORT_DIR || "release-gate-artifacts";

export function gitIdentity() {
  const envSha = process.env.GITHUB_SHA || "";
  const envBranch = process.env.GITHUB_REF_NAME || "";
  if (envSha && envBranch) {
    return { commitSha: envSha, branch: envBranch };
  }

  try {
    const head = readFileSync(".git/HEAD", "utf8").trim();
    if (head.startsWith("ref: ")) {
      const ref = head.slice("ref: ".length);
      const shaPath = `.git/${ref}`;
      return {
        commitSha: envSha || (existsSync(shaPath) ? readFileSync(shaPath, "utf8").trim() : "unknown"),
        branch: envBranch || ref.replace("refs/heads/", "")
      };
    }
    return {
      commitSha: envSha || head,
      branch: envBranch || "detached"
    };
  } catch {
    return {
      commitSha: envSha || "unknown",
      branch: envBranch || "unknown"
    };
  }
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function writeJson(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function writeControl(name, status, details = {}) {
  const identity = gitIdentity();
  const control = {
    name,
    status,
    generatedAt: new Date().toISOString(),
    commitSha: identity.commitSha,
    branch: identity.branch,
    ...details
  };
  writeJson(join(reportDir, "controls", `${name}.json`), control);
  return control;
}

export function pass(name, details = {}) {
  console.log(`[PASS] ${name}`);
  writeControl(name, "PASS", details);
}

export function fail(name, details = {}) {
  console.error(`[FAIL] ${name}`);
  writeControl(name, "FAIL", details);
  process.exitCode = 1;
}

export function blocked(name, details = {}) {
  console.error(`[BLOCKED] ${name}`);
  writeControl(name, "BLOCKED", details);
  process.exitCode = 2;
}

export function notRun(name, details = {}) {
  console.error(`[NOT_RUN] ${name}`);
  writeControl(name, "NOT_RUN", details);
}

export function boolEnv(name) {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  return String(raw).trim().toLowerCase();
}

export function redactedPresence(name, env = process.env) {
  return {
    name,
    present: Boolean(env[name] && String(env[name]).trim())
  };
}
