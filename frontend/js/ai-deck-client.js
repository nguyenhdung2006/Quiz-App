(function (global) {
"use strict";

const REQUEST_FAILURE_MESSAGE = "AI deck generation failed. Please try again.";
const RESPONSE_FAILURE_MESSAGE = "AI response could not be processed. Please try again.";
const API_ORIGIN = typeof global.quizApiOrigin === "function" ? global.quizApiOrigin() : "";
const API_FETCH = global.quizApiFetch || global.fetch.bind(global);

async function retrySeconds(response) {
try {
let payload = await response.clone().json();
let retry = Number(payload?.retryAfterSeconds || 0);
return Number.isFinite(retry) && retry > 0 ? retry : 0;
} catch {
return 0;
}
}

async function errorMessage(response) {
if (response.status === 429) {
let retry = await retrySeconds(response);
return retry
? `Daily AI limit reached. Please try again in ${retry}s.`
: "Daily AI limit reached. Please try again later.";
}
if (response.status >= 500) return REQUEST_FAILURE_MESSAGE;

try {
let payload = await response.clone().json();
if (payload?.message) return String(payload.message);
if (payload?.error) return String(payload.error);
} catch {
// Preserve the existing stable fallback for non-JSON error bodies.
}
return RESPONSE_FAILURE_MESSAGE;
}

async function request(text, options = {}) {
let response;
try {
response = await API_FETCH(`${API_ORIGIN}/api/ai/generate-deck`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
text,
targetLevel: options.targetLevel || "Any",
maxWords: options.maxWords || 20
})
});
} catch {
throw new Error(REQUEST_FAILURE_MESSAGE);
}

if (!response.ok) throw new Error(await errorMessage(response));

try {
return await response.json();
} catch {
throw new Error(RESPONSE_FAILURE_MESSAGE);
}
}

global.WordArenaAiDeckClient = Object.freeze({ request });
})(typeof window !== "undefined" ? window : globalThis);
