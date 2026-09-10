/* global vocab:writable, wrongWords:writable, normalizeWord, renderTable, renderMistakeTable */
const QUIZ_GUEST_ACCOUNT_ID = "local-guest";
const QUIZ_PROFILE_CACHE_KEY = "quizUserProfile";
const QUIZ_ACCOUNT_PREFIX = "quizAccount";
const QUIZ_GUEST_MIGRATION_KEY = "quizGuestDataMigrated";
const QUIZ_LOCAL_STATE_TRANSACTION = "localStateTxn";
const QUIZ_LOCAL_STATE_SCHEMA_VERSION = 1;
const PROFILE_AVATAR_FALLBACK = "images/icon.png";
const PROFILE_AVATAR_MAX_LENGTH = 100000;
const PROFILE_AVATAR_MAX_FILE_BYTES = 65536;
const PROFILE_AVATAR_SAFE_DATA_PATTERN = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\r\n]+$/i;
const PROFILE_AVATAR_SAFE_RELATIVE_PATTERN = /^(?:\.\/)?[A-Za-z0-9][A-Za-z0-9_./-]*$/;
const PROFILE_AVATAR_SAFE_FILE_TYPES = new Set([
"image/png",
"image/jpeg",
"image/gif",
"image/webp"
]);
const localStateBaselines = new Map();
let localStateSequence = 0;
const localStateTabId = (() => {
try {
let existing = sessionStorage.getItem("wordArenaStateTabId");
if (existing) return existing;
let created = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
sessionStorage.setItem("wordArenaStateTabId", created);
return created;
} catch (_error) {
return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
})();

function accountIdFromEmail(email) {
let value = String(email || "").trim().toLowerCase();
return value || QUIZ_GUEST_ACCOUNT_ID;
}

function readJson(key, fallback) {
try {
let raw = localStorage.getItem(key);
return raw ? JSON.parse(raw) : fallback;
} catch (_error) {
return fallback;
}
}

function safeProfileText(value, maxLength = 160, allowLineBreaks = false) {
let input = String(value || "");
let cleaned = "";
for (let index = 0; index < input.length; index++) {
let code = input.charCodeAt(index);
let char = input[index];
let allowedLineBreak = allowLineBreaks && (char === "\n" || char === "\r" || char === "\t");
if (code >= 32 || allowedLineBreak) cleaned += char;
}
cleaned = cleaned.trim();
return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function isSafeRelativeAvatar(value) {
return Boolean(value)
&& !value.startsWith("/")
&& !value.startsWith("//")
&& !value.includes("\\")
&& !value.includes("..")
&& !value.includes(":")
&& PROFILE_AVATAR_SAFE_RELATIVE_PATTERN.test(value);
}

function safeProfileAvatar(value) {
let candidate = String(value || "").trim();
if (!candidate || candidate.length > PROFILE_AVATAR_MAX_LENGTH) return PROFILE_AVATAR_FALLBACK;

let lower = candidate.toLowerCase();
if (lower.startsWith("data:")) {
return PROFILE_AVATAR_SAFE_DATA_PATTERN.test(candidate) ? candidate : PROFILE_AVATAR_FALLBACK;
}

if (lower.startsWith("https://")) {
try {
let parsed = new URL(candidate);
return parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password
? parsed.href
: PROFILE_AVATAR_FALLBACK;
} catch (_error) {
return PROFILE_AVATAR_FALLBACK;
}
}

return isSafeRelativeAvatar(candidate) ? candidate : PROFILE_AVATAR_FALLBACK;
}

function sanitizeProfile(profile = {}) {
return {
...profile,
name: safeProfileText(profile.name, 120) || "Vocabulary Runner",
email: safeProfileText(profile.email, 254),
avatar: safeProfileAvatar(profile.avatar),
birthday: safeProfileText(profile.birthday, 20),
gender: safeProfileText(profile.gender, 40),
goal: safeProfileText(profile.goal, 160),
bio: safeProfileText(profile.bio, 2000, true)
};
}

function getCachedProfile() {
return sanitizeProfile(readJson(QUIZ_PROFILE_CACHE_KEY, {}));
}

function getCurrentAccountId() {
return accountIdFromEmail(getCachedProfile().email);
}

function accountStorageKey(key, accountId = getCurrentAccountId()) {
return `${QUIZ_ACCOUNT_PREFIX}:${accountId}:${key}`;
}

function readAccountArray(key, accountId = getCurrentAccountId()) {
if (key === "vocab" || key === "wrongWords") {
let state = readCommittedAccountState(accountId);
localStateBaselines.set(accountId, cloneLocalState(state));
return cloneLocalState(state[key]);
}
let value = readJson(accountStorageKey(key, accountId), null);
if (Array.isArray(value)) return value;

if (accountId !== QUIZ_GUEST_ACCOUNT_ID) return [];

let legacy = readJson(key, null);
return Array.isArray(legacy) ? legacy : [];
}

function readLocalArray(key) {
return readAccountArray(key);
}

function getAccountProfile(accountId = getCurrentAccountId()) {
return sanitizeProfile(readJson(accountStorageKey("profile", accountId), {}));
}

function saveAccountProfile(profile, accountId = getCurrentAccountId()) {
localStorage.setItem(accountStorageKey("profile", accountId), JSON.stringify(sanitizeProfile(profile || {})));
}

function switchAccountStorage(profile) {
let nextProfile = sanitizeProfile(profile || {});
let nextAccountId = accountIdFromEmail(nextProfile.email);
let previousAccountId = getCurrentAccountId();
if (previousAccountId !== nextAccountId) {
window.WordArenaQuizAttemptClient?.reset?.();
window.WordArenaReviewOperationClient?.reset?.();
}

if (previousAccountId !== nextAccountId && typeof save === "function") {
save();
}

let existingProfile = sanitizeProfile(getAccountProfile(nextAccountId));
let mergedProfile = sanitizeProfile({
...existingProfile,
...nextProfile,
name: nextProfile.name || existingProfile.name || "Vocabulary Runner",
email: nextProfile.email || existingProfile.email || "",
avatar: safeProfileAvatar(nextProfile.avatar || existingProfile.avatar),
birthday: nextProfile.birthday || existingProfile.birthday || "",
gender: nextProfile.gender || existingProfile.gender || "",
goal: nextProfile.goal || existingProfile.goal || "",
bio: nextProfile.bio || existingProfile.bio || ""
});

localStorage.setItem(QUIZ_PROFILE_CACHE_KEY, JSON.stringify(mergedProfile));
saveAccountProfile(mergedProfile, nextAccountId);

if (previousAccountId !== nextAccountId) {
let hasSavedVocab = localStorage.getItem(accountStorageKey("vocab", nextAccountId)) !== null;
let hasSavedWrong = localStorage.getItem(accountStorageKey("wrongWords", nextAccountId)) !== null;

let canMigrateGuest = previousAccountId === QUIZ_GUEST_ACCOUNT_ID
&& !hasSavedVocab
&& !hasSavedWrong
&& localStorage.getItem(QUIZ_GUEST_MIGRATION_KEY) !== "true";

if (canMigrateGuest) {
localStorage.setItem(accountStorageKey("vocab", nextAccountId), JSON.stringify(vocab));
localStorage.setItem(accountStorageKey("wrongWords", nextAccountId), JSON.stringify(wrongWords));
localStorage.setItem(QUIZ_GUEST_MIGRATION_KEY, "true");
}

vocab = readAccountArray("vocab", nextAccountId).map(normalizeWord).filter(w => w.eng && w.vie);
wrongWords = readAccountArray("wrongWords", nextAccountId).map(normalizeWord).filter(w => w.eng && w.vie);
}

return mergedProfile;
}

function cloneLocalState(value) {
try {
return JSON.parse(JSON.stringify(value));
} catch (_error) {
return Array.isArray(value) ? [] : {};
}
}

function localWordIdentity(word) {
let wordUid = String(word?.wordUid || word?.word_uid || "").trim();
if (wordUid) return `uid:${wordUid}`;
let english = String(word?.eng || "").trim().toLowerCase().replace(/\s+/g, " ");
return english ? `eng:${english}` : "";
}

function localTransactionPrefix(accountId) {
return `${QUIZ_ACCOUNT_PREFIX}:${accountId}:${QUIZ_LOCAL_STATE_TRANSACTION}:`;
}

function localTransactionKey(accountId) {
return `${localTransactionPrefix(accountId)}${localStateTabId}`;
}

function readLegacyAccountState(accountId) {
let legacyVocab = readJson(accountStorageKey("vocab", accountId), null);
let legacyWrong = readJson(accountStorageKey("wrongWords", accountId), null);
if (accountId === QUIZ_GUEST_ACCOUNT_ID) {
if (!Array.isArray(legacyVocab)) legacyVocab = readJson("vocab", []);
if (!Array.isArray(legacyWrong)) legacyWrong = readJson("wrongWords", []);
}
return {
vocab: Array.isArray(legacyVocab) ? legacyVocab : [],
wrongWords: Array.isArray(legacyWrong) ? legacyWrong : []
};
}

function listLocalTransactions(accountId) {
let prefix = localTransactionPrefix(accountId);
let result = [];
try {
for (let index = 0; index < localStorage.length; index++) {
let key = localStorage.key(index);
if (!key?.startsWith(prefix)) continue;
let transaction = readJson(key, null);
if (transaction?.schemaVersion === QUIZ_LOCAL_STATE_SCHEMA_VERSION) result.push(transaction);
}
} catch (_error) {
return [];
}
return result;
}

function applyLocalMutations(base, transactions, collection) {
let records = new Map();
for (let word of base) {
let identity = localWordIdentity(word);
if (identity) records.set(identity, { word: cloneLocalState(word), version: "" });
}
let mutations = transactions.flatMap(transaction => Array.isArray(transaction?.[collection])
? transaction[collection]
: []);
mutations.sort((left, right) => String(left?.version || "").localeCompare(String(right?.version || "")));
for (let mutation of mutations) {
let identity = String(mutation?.identity || "");
if (!identity) continue;
let current = records.get(identity);
if (current && String(current.version || "") > String(mutation.version || "")) continue;
if (mutation.type === "delete") {
records.set(identity, { word: null, version: mutation.version });
continue;
}
if (mutation.type !== "upsert" || !mutation.word) continue;
// A legacy item without wordUid is replaced by its stable-uid migration, not duplicated.
let englishIdentity = localWordIdentity({ eng: mutation.word.eng });
if (identity.startsWith("uid:") && englishIdentity && records.has(englishIdentity)) {
records.delete(englishIdentity);
}
records.set(identity, { word: cloneLocalState(mutation.word), version: mutation.version });
}
return [...records.values()].filter(record => record.word).map(record => record.word);
}

function readCommittedAccountState(accountId = getCurrentAccountId()) {
let base = readLegacyAccountState(accountId);
let transactions = listLocalTransactions(accountId);
return {
vocab: applyLocalMutations(base.vocab, transactions, "vocab"),
wrongWords: applyLocalMutations(base.wrongWords, transactions, "wrongWords")
};
}

function sameLocalValue(left, right) {
return JSON.stringify(left) === JSON.stringify(right);
}

function buildLocalMutations(before, after, version) {
let previous = new Map(before.map(word => [localWordIdentity(word), word]).filter(([identity]) => identity));
let current = new Map(after.map(word => [localWordIdentity(word), word]).filter(([identity]) => identity));
let mutations = [];
for (let [identity, word] of current) {
if (!previous.has(identity) || !sameLocalValue(previous.get(identity), word)) {
mutations.push({ type: "upsert", identity, version, word: cloneLocalState(word) });
}
}
for (let identity of previous.keys()) {
if (!current.has(identity)) mutations.push({ type: "delete", identity, version });
}
return mutations;
}

function mergeTabTransaction(existing, patch) {
let merge = collection => {
let byIdentity = new Map((existing?.[collection] || []).map(item => [item.identity, item]));
for (let item of patch[collection]) byIdentity.set(item.identity, item);
return [...byIdentity.values()];
};
return {
schemaVersion: QUIZ_LOCAL_STATE_SCHEMA_VERSION,
accountId: patch.accountId,
tabId: localStateTabId,
vocab: merge("vocab"),
wrongWords: merge("wrongWords")
};
}

function notifyStorageFailure(error) {
window.__wordArenaStorageError = error?.message || "Browser storage is unavailable.";
try {
window.dispatchEvent(new CustomEvent("wordarena-storage-error", {
detail: { message: error?.message || "Browser storage is unavailable." }
}));
} catch (_dispatchError) {
// Storage failure remains observable through the false return value in restricted environments.
}
}

function save() {
let accountId = getCurrentAccountId();
let baseline = localStateBaselines.get(accountId) || readCommittedAccountState(accountId);
let version = `${String(Date.now()).padStart(16, "0")}:${localStateTabId}:${String(++localStateSequence).padStart(8, "0")}`;
let patch = {
accountId,
vocab: buildLocalMutations(baseline.vocab, vocab, version),
wrongWords: buildLocalMutations(baseline.wrongWords, wrongWords, version)
};
if (!patch.vocab.length && !patch.wrongWords.length) return true;
let key = localTransactionKey(accountId);
let transaction = mergeTabTransaction(readJson(key, null), patch);
try {
// This is the only authoritative write for the logical vocabulary + wrong-bank save.
localStorage.setItem(key, JSON.stringify(transaction));
} catch (error) {
// Preserve the caller's working state. The last committed snapshot remains untouched,
// and the same in-memory changes can be retried after storage becomes available.
notifyStorageFailure(error);
return false;
}
let committed = readCommittedAccountState(accountId);
vocab = committed.vocab;
wrongWords = committed.wrongWords;
localStateBaselines.set(accountId, cloneLocalState(committed));
// Keep old readers usable during migration. These mirrors are never authoritative.
try { localStorage.setItem(accountStorageKey("vocab", accountId), JSON.stringify(committed.vocab)); } catch (_error) { /* noop */ }
try { localStorage.setItem(accountStorageKey("wrongWords", accountId), JSON.stringify(committed.wrongWords)); } catch (_error) { /* noop */ }
window.__wordArenaStorageError = "";
return true;
}

window.addEventListener?.("storage", event => {
let accountId = getCurrentAccountId();
if (!event.key?.startsWith(localTransactionPrefix(accountId))) return;
let committed = readCommittedAccountState(accountId);
vocab = committed.vocab.map(typeof normalizeWord === "function" ? normalizeWord : value => value);
wrongWords = committed.wrongWords.map(typeof normalizeWord === "function" ? normalizeWord : value => value);
localStateBaselines.set(accountId, cloneLocalState(committed));
if (typeof renderTable === "function") renderTable();
if (typeof renderMistakeTable === "function") renderMistakeTable();
});
