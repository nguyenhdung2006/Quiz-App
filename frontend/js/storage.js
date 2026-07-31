const QUIZ_GUEST_ACCOUNT_ID = "local-guest";
const QUIZ_PROFILE_CACHE_KEY = "quizUserProfile";
const QUIZ_ACCOUNT_PREFIX = "quizAccount";
const QUIZ_GUEST_MIGRATION_KEY = "quizGuestDataMigrated";
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
} catch (error) {
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

function save() {
let accountId = getCurrentAccountId();
localStorage.setItem(accountStorageKey("vocab", accountId), JSON.stringify(vocab));
localStorage.setItem(accountStorageKey("wrongWords", accountId), JSON.stringify(wrongWords));
}
