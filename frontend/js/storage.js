const QUIZ_GUEST_ACCOUNT_ID = "local-guest";
const QUIZ_PROFILE_CACHE_KEY = "quizUserProfile";
const QUIZ_ACCOUNT_PREFIX = "quizAccount";
const QUIZ_GUEST_MIGRATION_KEY = "quizGuestDataMigrated";

function accountIdFromEmail(email) {
let value = String(email || "").trim().toLowerCase();
return value || QUIZ_GUEST_ACCOUNT_ID;
}

function readJson(key, fallback) {
try {
let raw = localStorage.getItem(key);
return raw ? JSON.parse(raw) : fallback;
} catch (error) {
return fallback;
}
}

function getCachedProfile() {
return readJson(QUIZ_PROFILE_CACHE_KEY, {});
}

function getCurrentAccountId() {
return accountIdFromEmail(getCachedProfile().email);
}

function accountStorageKey(key, accountId = getCurrentAccountId()) {
return `${QUIZ_ACCOUNT_PREFIX}:${accountId}:${key}`;
}

function readAccountArray(key, accountId = getCurrentAccountId()) {
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
return readJson(accountStorageKey("profile", accountId), {});
}

function saveAccountProfile(profile, accountId = getCurrentAccountId()) {
localStorage.setItem(accountStorageKey("profile", accountId), JSON.stringify(profile || {}));
}

function switchAccountStorage(profile) {
let nextProfile = profile || {};
let nextAccountId = accountIdFromEmail(nextProfile.email);
let previousAccountId = getCurrentAccountId();

if (previousAccountId !== nextAccountId && typeof save === "function") {
save();
}

let existingProfile = getAccountProfile(nextAccountId);
let mergedProfile = {
...existingProfile,
...nextProfile,
name: nextProfile.name || existingProfile.name || "Vocabulary Runner",
email: nextProfile.email || existingProfile.email || "",
avatar: nextProfile.avatar || existingProfile.avatar || "images/icon.png",
birthday: nextProfile.birthday || existingProfile.birthday || "",
gender: nextProfile.gender || existingProfile.gender || "",
goal: nextProfile.goal || existingProfile.goal || "",
bio: nextProfile.bio || existingProfile.bio || ""
};

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

function save() {
let accountId = getCurrentAccountId();
localStorage.setItem(accountStorageKey("vocab", accountId), JSON.stringify(vocab));
localStorage.setItem(accountStorageKey("wrongWords", accountId), JSON.stringify(wrongWords));
}
