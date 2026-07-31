import { blocked, fail, pass } from "./lib.mjs";

const control = "staging-smoke";
const required = ["STAGING_BACKEND_URL", "STAGING_FRONTEND_URL", "STAGING_TEST_USER_HINT"];
const missing = required.filter((name) => !process.env[name] || !String(process.env[name]).trim());

if (missing.length) {
  blocked(control, {
    reason: "Staging smoke requires configured staging URLs and non-secret test identity metadata.",
    missingVariables: missing
  });
  process.exit();
}

const backendUrl = process.env.STAGING_BACKEND_URL.replace(/\/+$/, "");
const frontendUrl = process.env.STAGING_FRONTEND_URL.replace(/\/+$/, "");
const findings = [];

for (const [name, url] of [["STAGING_BACKEND_URL", backendUrl], ["STAGING_FRONTEND_URL", frontendUrl]]) {
  if (!/^https:\/\//i.test(url)) {
    findings.push({ variable: name, message: "Staging URL must use HTTPS." });
  }
  if (/localhost|127\.0\.0\.1|placeholder|example\.com/i.test(url)) {
    findings.push({ variable: name, message: "Staging URL must not be local or placeholder." });
  }
}

async function checkJson(path) {
  const response = await fetch(`${backendUrl}${path}`, { redirect: "manual" });
  return {
    path,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    setCookie: response.headers.has("set-cookie")
  };
}

try {
  const health = await checkJson("/api/health");
  if (health.status < 200 || health.status >= 300) {
    findings.push({ path: health.path, message: `Unexpected status ${health.status}.` });
  }

  const csrf = await checkJson("/api/csrf");
  if (csrf.status < 200 || csrf.status >= 300 || !csrf.contentType.includes("application/json")) {
    findings.push({ path: csrf.path, message: "CSRF endpoint did not return JSON success." });
  }
  if (!csrf.setCookie) {
    findings.push({ path: csrf.path, message: "CSRF endpoint did not issue a cookie." });
  }

  const frontend = await fetch(frontendUrl, { redirect: "manual" });
  if (frontend.status < 200 || frontend.status >= 400) {
    findings.push({ variable: "STAGING_FRONTEND_URL", message: `Frontend returned status ${frontend.status}.` });
  }
} catch (error) {
  findings.push({ message: "Staging smoke request failed.", error: String(error.message || error) });
}

if (findings.length) {
  fail(control, { findings });
} else {
  pass(control, {
    checked: ["/api/health", "/api/csrf", "frontend root"],
    note: "OAuth browser callback is not marked PASS by this script; it requires a real staging credential/browser run."
  });
}
