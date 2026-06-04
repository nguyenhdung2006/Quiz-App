(function () {
const overrides = window.QUIZ_APP_CONFIG || {};
const configuredOrigin = overrides.apiOrigin || overrides.backendUrl || "http://localhost:8080";
const apiOrigin = String(configuredOrigin).replace(/\/$/, "");

window.QUIZ_APP_CONFIG = {
...overrides,
apiOrigin,
backendUrl: apiOrigin
};

window.quizApiOrigin = function () {
return window.QUIZ_APP_CONFIG.apiOrigin;
};
})();
