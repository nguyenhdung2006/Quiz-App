(function (global) {
"use strict";

const API_ORIGIN = global.quizApiOrigin ? global.quizApiOrigin() : "";
const API_FETCH = global.quizApiFetch || global.fetch.bind(global);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
let active = null;
let issuing = false;
let generation = 0;

function notice(message, tone) {
global.WordArenaSyncStatus?.render?.(message, tone);
}

function isCloudReady() {
return global.quizCloud?.isReady?.() === true;
}

function validLocalItems(items) {
if (!Array.isArray(items) || !items.length || items.length > 500) return false;
let ids = new Set();
for (let item of items) {
let wordId = Number(item?.wordId);
if (!Number.isSafeInteger(wordId) || wordId <= 0 || ids.has(wordId)) return false;
if (item?.questionMode !== "eng" && item?.questionMode !== "vie") return false;
if (!String(item?.expectedPrompt || "").trim()) return false;
ids.add(wordId);
}
return true;
}

function bindIssuedItems(requestedItems, issuedItems) {
if (!Array.isArray(issuedItems) || issuedItems.length !== requestedItems.length) return null;
let bound = [];
for (let ordinal = 0; ordinal < requestedItems.length; ordinal++) {
let requested = requestedItems[ordinal];
let issued = issuedItems[ordinal];
if (Number(issued?.ordinal) !== ordinal
|| Number(issued?.wordId) !== Number(requested.wordId)
|| issued?.questionMode !== requested.questionMode
|| String(issued?.prompt || "") !== String(requested.expectedPrompt || "")) {
return null;
}
bound.push(Object.freeze({
ordinal,
wordId: Number(issued.wordId),
wordUid: issued.wordUid || null,
questionMode: issued.questionMode,
prompt: issued.prompt
}));
}
return Object.freeze(bound);
}

async function issue(plan) {
if (issuing) return { online: false, reason: "issue-in-progress" };
reset();
let issuedGeneration = generation;
if (!isCloudReady()) return { online: false, reason: "cloud-not-ready" };
if (!validLocalItems(plan?.items)) {
notice("Quiz is local-only; cloud rewards are unavailable for unsynced words.", "warn");
return { online: false, reason: "invalid-or-unsynced-items" };
}

issuing = true;
try {
let response = await API_FETCH(`${API_ORIGIN}/api/quiz/attempts`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
quizMode: plan.quizMode,
challengeSeconds: plan.challengeSeconds ?? null,
items: plan.items.map(item => ({
wordId: Number(item.wordId),
questionMode: item.questionMode
}))
})
});
if (generation !== issuedGeneration) return { online: false, cancelled: true };
if (!response.ok) throw new Error(`Quiz attempt issuance failed with HTTP ${response.status}.`);
let body = await response.json();
if (generation !== issuedGeneration) return { online: false, cancelled: true };
let boundItems = bindIssuedItems(plan.items, body?.items);
if (!body?.attemptId || !boundItems) {
throw new Error("Quiz attempt response did not match the requested quiz.");
}
active = {
attemptId: String(body.attemptId),
items: boundItems,
submissionBody: null,
status: "issued",
lastResponse: null
};
return { online: true, attemptId: active.attemptId, items: active.items };
} catch (error) {
if (generation !== issuedGeneration) return { online: false, cancelled: true };
active = null;
notice("Quiz is local-only; cloud rewards are unavailable.", "warn");
return { online: false, reason: "issue-failed", error };
} finally {
issuing = false;
}
}

async function sendSubmission(attempt) {
if (active !== attempt) return { ok: false, cancelled: true };
if (!attempt?.submissionBody) return { ok: false, reason: "no-active-submission" };
let response;
try {
response = await API_FETCH(`${API_ORIGIN}/api/quiz/attempts/${encodeURIComponent(attempt.attemptId)}/submit`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: attempt.submissionBody
});
} catch (error) {
if (active !== attempt) return { ok: false, cancelled: true };
return { ok: false, retryable: true, error };
}
if (active !== attempt) return { ok: false, cancelled: true };
if (!response.ok) {
return { ok: false, retryable: RETRYABLE_STATUS.has(response.status), status: response.status };
}
let body;
try {
body = await response.json();
} catch (error) {
if (active !== attempt) return { ok: false, cancelled: true };
return { ok: false, retryable: true, error };
}
if (active !== attempt) return { ok: false, cancelled: true };
if (body?.attemptId !== attempt.attemptId) {
return { ok: false, retryable: true, reason: "unexpected-attempt-response" };
}
attempt.status = "consumed";
attempt.lastResponse = body;
return { ok: true, response, body };
}

async function submit(selections) {
if (!active || active.status !== "issued") return { ok: false, reason: "no-issued-attempt" };
let attempt = active;
if (!Array.isArray(selections) || selections.length !== attempt.items.length) {
return { ok: false, reason: "invalid-selections" };
}
attempt.submissionBody = JSON.stringify({
answers: attempt.items.map((item, index) => ({
ordinal: item.ordinal,
selectedAnswer: String(selections[index] ?? "")
}))
});
attempt.status = "submitting";

let first = await sendSubmission(attempt);
if (active !== attempt) return { ok: false, cancelled: true };
if (first.ok) return first;
if (first.retryable) {
attempt.status = "retrying";
let retry = await sendSubmission(attempt);
if (active !== attempt) return { ok: false, cancelled: true };
if (retry.ok) return retry;
first = retry;
}
attempt.status = "pending";
notice("Quiz cloud save is pending. Retry sync to resend the same attempt safely.", "warn");
return first;
}

async function retryActiveSubmission() {
if (!active?.submissionBody || !["pending", "consumed"].includes(active.status)) {
return { ok: false, reason: "no-retryable-submission" };
}
let attempt = active;
attempt.status = "retrying";
let result = await sendSubmission(attempt);
if (active !== attempt) return { ok: false, cancelled: true };
if (!result.ok) {
attempt.status = "pending";
notice("Quiz cloud save is still pending.", "warn");
}
return result;
}

function reset() {
generation++;
active = null;
}

function state() {
return active ? {
attemptId: active.attemptId,
items: active.items,
submissionBody: active.submissionBody,
status: active.status,
lastResponse: active.lastResponse
} : null;
}

global.WordArenaQuizAttemptClient = Object.freeze({ issue, submit, retryActiveSubmission, reset, state });
})(typeof window !== "undefined" ? window : globalThis);
