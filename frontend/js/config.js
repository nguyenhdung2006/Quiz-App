(function () {
const overrides = window.QUIZ_APP_CONFIG || {};
const productionBackendUrl = "https://quiz-app-xd9m.onrender.com";
const productionFrontendHost = "quiz-app-rust-iota-39.vercel.app";
const host = window.location.hostname || "";
const isVercel = host.includes("vercel.app");
const isProductionFrontend = host === productionFrontendHost || isVercel;
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
