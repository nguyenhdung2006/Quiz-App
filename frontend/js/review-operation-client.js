(function (global) {
"use strict";
const pending = new Map();
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
let generation = 0;
let hydrationBlockedAccount = null;
const PENDING_KEY = "pendingReviewOperations";
const account = () => global.getCurrentAccountId?.() || "local-guest";
const origin = () => global.quizApiOrigin?.() || "";
const fetchApi = (...args) => (global.quizApiFetch || global.fetch.bind(global))(...args);
const current = op => op.generation === generation && op.account === account() && pending.get(op.key) === op;

function storageKey(accountId = account()) {
return typeof global.accountStorageKey === "function"
? global.accountStorageKey(PENDING_KEY, accountId)
: `quizAccount:${accountId}:${PENDING_KEY}`;
}
function persist(accountId = account()) {
let durable = [...pending.values()].filter(op => op.account === accountId).map(op => ({
id: op.id, key: op.key, wordId: op.wordId, action: op.action, body: op.body,
path: op.path, account: op.account, localApplied: true, rejected: op.rejected || null,
error: op.error || null
}));
try {
if (durable.length) global.localStorage?.setItem(storageKey(accountId), JSON.stringify(durable));
else global.localStorage?.removeItem(storageKey(accountId));
} catch (_error) {
notice();
}
}
function hydrate() {
let currentAccount = account();
if (hydrationBlockedAccount && hydrationBlockedAccount !== currentAccount) hydrationBlockedAccount = null;
if (hydrationBlockedAccount === currentAccount) return;
let stored;
try { stored = JSON.parse(global.localStorage?.getItem(storageKey(currentAccount)) || "[]"); }
catch (_error) { return; }
if (!Array.isArray(stored)) return;
for (let item of stored) {
if (item?.account !== currentAccount || !item.id || !item.key || !item.body || !item.path) continue;
if (!pending.has(item.key)) {
pending.set(item.key, {
...item, generation, local: null, accept: null, localApplied: true, inFlight: null
});
}
}
}
function reset() {
hydrationBlockedAccount = account();
generation++;
pending.clear();
global.reviewToday?.reset?.();
}
function context() { return { account: account(), generation }; }
function isCurrent(token) { return token.account === account() && token.generation === generation; }
function notice() {
global.WordArenaSyncStatus?.render?.("Review saved locally; Retry Review or Retry Sync to confirm the same operation.", "warn");
}
function localOnce(op) {
if (!current(op) || op.localApplied) return;
op.localApplied = true;
op.local?.();
persist(op.account);
}
function latestEnough(revision) {
let latest = global.quizCloud?.state?.().lastKnownRevision;
return Number.isSafeInteger(revision) && (latest == null || revision >= Number(latest));
}

async function reconcileRejection(op) {
try {
let response = await fetchApi(`${origin()}/api/snapshot`);
if (!current(op)) return { cancelled: true };
if (!response.ok) throw new Error("Review reconciliation unavailable");
let snapshot = await response.json();
if (!current(op)) return { cancelled: true };
if (!Array.isArray(snapshot.vocab) || !Array.isArray(snapshot.wrongWords)
|| !latestEnough(snapshot.revision)) throw new Error("Stale review read model");
global.quizCloud?.rememberResponseRevision?.(response);
let word = snapshot.vocab.find(word => Number(word.id) === op.wordId);
// A rejected command for an unsynced local word is not a server deletion.
// Only a successful ledger replay with word:null proves a previously accepted target was deleted.
if (word) {
op.accept?.({ word,
inWrongBank: snapshot.wrongWords.some(word => Number(word.id) === op.wordId), revision: snapshot.revision });
}
pending.delete(op.key);
persist(op.account);
return { rejected: true, status: op.rejected, error: op.error };
} catch (_error) {
if (!current(op)) return { cancelled: true };
notice();
return { rejected: true, pending: true, status: op.rejected, error: op.error };
}
}

async function send(op) {
if (!current(op)) return { cancelled: true };
if (op.rejected) return reconcileRejection(op);
for (let attempt = 0; attempt < 2; attempt++) {
try {
let response = await fetchApi(`${origin()}${op.path}`, {
method: "POST", headers: { "Content-Type": "application/json" }, body: op.body
});
if (!current(op)) return { cancelled: true };
if (!response.ok) {
if (RETRYABLE.has(response.status)) throw new Error("Review outcome unknown");
op.rejected = response.status;
try { op.error = (await response.json()).error; } catch (_error) { /* status still fails closed */ }
persist(op.account);
if (!current(op)) return { cancelled: true };
return reconcileRejection(op);
}
let body = await response.json();
if (!current(op)) return { cancelled: true };
if (body?.outcome?.operationId !== op.id || Number(body.outcome.wordId) !== op.wordId
|| body.outcome.action !== op.action || typeof body.replayed !== "boolean"
|| !Object.hasOwn(body, "word") || (body.word && Number(body.word.id) !== op.wordId)
|| typeof body.inWrongBank !== "boolean" || !latestEnough(body.revision)
|| String(body.revision) !== response.headers.get("X-Sync-Revision")) {
throw new Error("Invalid or stale review response");
}
global.quizCloud?.rememberResponseRevision?.(response);
op.accept?.(body);
pending.delete(op.key);
persist(op.account);
return { ok: true, body };
} catch (_error) {
if (!current(op)) return { cancelled: true };
localOnce(op);
}
}
notice();
return { pending: true, local: op.localApplied };
}

function retry(op) {
if (!current(op)) return Promise.resolve({ cancelled: true });
if (op.inFlight) return op.inFlight;
op.inFlight = send(op).finally(() => { op.inFlight = null; });
return op.inFlight;
}

async function run({ wordId, action, correct, local, accept, online = true }) {
hydrate();
let key = String(wordId);
let existing = pending.get(key);
if (existing && !current(existing)) { pending.delete(key); existing = null; }
// Until the unknown operation is resolved, another click on this word retries it;
// it cannot manufacture a replacement command or apply local learning twice.
if (existing) return { ...await retry(existing), reused: true };
if (!["review", "known", "mark-hard"].includes(action)) return { rejected: true };
if (!online || !global.quizCloud?.isReady?.() || !Number.isSafeInteger(Number(wordId)) || Number(wordId) <= 0) {
local?.();
return { local: true };
}
if (!global.crypto?.randomUUID) {
local?.();
return { local: true }; // Never send an insecure identity fallback.
}
let id = global.crypto.randomUUID();
let payload = action === "known" ? { operationId: id, wordId: Number(wordId) }
: { operationId: id, wordId: Number(wordId), correct: action === "mark-hard" ? false : correct, mode: action };
let op = { id, key, wordId: Number(wordId), action, body: JSON.stringify(payload),
path: action === "known" ? "/api/review/known" : "/api/review/answer",
account: account(), generation, local, accept, localApplied: false, inFlight: null };
pending.set(key, op);
persist(op.account);
if (action !== "review") localOnce(op); // Existing Known/Hard optimistic semantics.
return retry(op);
}

async function retryPending() {
hydrate();
let results = [];
for (let op of [...pending.values()]) if (current(op)) results.push(await retry(op));
return results;
}
function hasPending(wordId) { hydrate(); let op = pending.get(String(wordId)); return Boolean(op && current(op)); }
function pendingCount() { hydrate(); return [...pending.values()].filter(current).length; }
global.WordArenaReviewOperationClient = Object.freeze({ run, retryPending, hasPending, pendingCount, reset, context, isCurrent });
global.addEventListener("storage", event => { if (event.key === "quizUserProfile" || event.key === null) reset(); });
})(window);
