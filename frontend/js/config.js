(function () {
const overrides = window.QUIZ_APP_CONFIG || {};
const productionBackendUrl = "https://quiz-app-xd9m.onrender.com";
const host = window.location.hostname || "";
const productionFrontendHosts = new Set([
"quiz-app-rust-iota-39.vercel.app",
"wordarena.org",
"www.wordarena.org"
]);
const localFrontendHosts = new Set(["", "localhost", "127.0.0.1", "::1"]);
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfCookieName = "XSRF-TOKEN";
const csrfHeaderName = "X-XSRF-TOKEN";
const isVercel = host.endsWith(".vercel.app");
const isLocalFrontend = localFrontendHosts.has(host);
const isProductionFrontend = productionFrontendHosts.has(host) || isVercel || !isLocalFrontend;
const configuredOrigin = overrides.apiOrigin
|| overrides.backendUrl
|| (isProductionFrontend ? productionBackendUrl : "http://localhost:8080");
const apiOrigin = String(configuredOrigin).replace(/\/$/, "");
let csrfTokenValue = "";
let csrfRefreshInFlight = null;

window.QUIZ_APP_CONFIG = {
...overrides,
apiOrigin,
backendUrl: apiOrigin,
isProductionFrontend
};

function toUrl(value) {
try {
return new URL(value, window.location.href);
} catch (error) {
return null;
}
}

function isTrustedBackendUrl(value) {
let url = toUrl(value);
return Boolean(url && url.origin === apiOrigin);
}

function readCookie(name) {
try {
let prefix = `${encodeURIComponent(name)}=`;
return document.cookie
.split(";")
.map(part => part.trim())
.find(part => part.startsWith(prefix))
?.slice(prefix.length) || "";
} catch (error) {
return "";
}
}

async function refreshCsrfToken() {
if (csrfRefreshInFlight) return csrfRefreshInFlight;

csrfRefreshInFlight = (async () => {
let response = await fetch(`${apiOrigin}/api/csrf`, {
method: "GET",
credentials: "include",
headers: { Accept: "application/json" }
});

if (!response.ok) {
csrfTokenValue = "";
return "";
}

let payload = await response.json().catch(() => null);
csrfTokenValue = String(payload?.token || readCookie(csrfCookieName) || "");
return csrfTokenValue;
})().finally(() => {
csrfRefreshInFlight = null;
});

return csrfRefreshInFlight;
}

async function ensureCsrfToken() {
let cookieToken = readCookie(csrfCookieName);
if (cookieToken) {
csrfTokenValue = cookieToken;
return csrfTokenValue;
}
if (csrfTokenValue) return csrfTokenValue;
return refreshCsrfToken();
}

async function quizApiFetch(input, options = {}) {
let url = toUrl(input);
let trusted = Boolean(url && isTrustedBackendUrl(url.href));
let method = String(options.method || "GET").toUpperCase();
let headers = new Headers(options.headers || {});
let nextOptions = {
...options,
method,
headers
};

if (trusted) {
nextOptions.credentials = "include";
}

if (trusted && unsafeMethods.has(method)) {
let token = await ensureCsrfToken();
if (token) headers.set(csrfHeaderName, token);
}

let response = await fetch(url ? url.href : input, nextOptions);
if (trusted && unsafeMethods.has(method) && response.status === 403) {
csrfTokenValue = "";
}
return response;
}

window.quizApiOrigin = function () {
return window.QUIZ_APP_CONFIG.apiOrigin;
};

window.quizIsProductionFrontend = function () {
return Boolean(window.QUIZ_APP_CONFIG.isProductionFrontend);
};

window.quizApiFetch = quizApiFetch;
window.quizCsrf = {
cookieName: csrfCookieName,
headerName: csrfHeaderName,
refresh: refreshCsrfToken,
clear() {
csrfTokenValue = "";
},
readToken() {
return csrfTokenValue || readCookie(csrfCookieName);
},
isTrustedBackendUrl
};
})();
