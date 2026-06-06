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
const isVercel = host.endsWith(".vercel.app");
const isLocalFrontend = localFrontendHosts.has(host);
const isProductionFrontend = productionFrontendHosts.has(host) || isVercel || !isLocalFrontend;
const configuredOrigin = overrides.apiOrigin
|| overrides.backendUrl
|| (isProductionFrontend ? productionBackendUrl : "http://localhost:8080");
const apiOrigin = String(configuredOrigin).replace(/\/$/, "");

window.QUIZ_APP_CONFIG = {
...overrides,
apiOrigin,
backendUrl: apiOrigin,
isProductionFrontend
};

window.quizApiOrigin = function () {
return window.QUIZ_APP_CONFIG.apiOrigin;
};

window.quizIsProductionFrontend = function () {
return Boolean(window.QUIZ_APP_CONFIG.isProductionFrontend);
};
})();
