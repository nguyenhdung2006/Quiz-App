// App polish layer: preview guide, search, backup, and small UX helpers.
(function () {
const AUTH_API_ORIGIN = "http://localhost:8080";
let cloudSyncReady = false;
let cloudSyncTimer = null;
let applyingCloudSnapshot = false;
let latestProgressSummary = null;
let latestAchievements = [];

const STARTER_WORDS = [
{ eng: "resilient", vie: "kien cuong", pos: "adj", tag: "mindset", example: "She stayed resilient after the hard exam.", note: "Useful for school and life." },
{ eng: "curious", vie: "to mo", pos: "adj", tag: "mindset", example: "A curious learner asks better questions.", note: "Good learning attitude." },
{ eng: "focus", vie: "tap trung", pos: "v", tag: "study", example: "Focus on one small step first.", note: "Can be noun or verb." },
{ eng: "review", vie: "on lai", pos: "v", tag: "study", example: "Review the hard words tomorrow.", note: "Core spaced repetition action." },
{ eng: "progress", vie: "tien bo", pos: "n", tag: "study", example: "Small progress still counts.", note: "Motivation word." },
{ eng: "attempt", vie: "co gang thu", pos: "v", tag: "exam", example: "Attempt every question calmly.", note: "Try, not necessarily succeed." },
{ eng: "evidence", vie: "bang chung", pos: "n", tag: "exam", example: "Use evidence to support your answer.", note: "Common in essays." },
{ eng: "compare", vie: "so sanh", pos: "v", tag: "exam", example: "Compare the two ideas clearly.", note: "Task verb." },
{ eng: "habit", vie: "thoi quen", pos: "n", tag: "daily", example: "A tiny habit can become powerful.", note: "Daily routine." },
{ eng: "calm", vie: "binh tinh", pos: "adj", tag: "daily", example: "Stay calm before answering.", note: "Mood and behavior." }
];

function getVocab() {
return typeof vocab !== "undefined" && Array.isArray(vocab) ? vocab : [];
}

function getWrongWords() {
return typeof wrongWords !== "undefined" && Array.isArray(wrongWords) ? wrongWords : [];
}

function setData(nextVocab, nextWrongWords) {
vocab = nextVocab;
wrongWords = nextWrongWords;
save();
renderTable();
renderMistakeTable();
updateStats();
}

function toServerWord(word) {
let clean = normalizeWord(word);
return {
id: clean.id,
eng: clean.eng,
vie: clean.vie,
pos: clean.pos,
tag: clean.tag,
example: clean.example,
note: clean.note,
favorite: clean.favorite,
mastered: clean.mastered,
stats: {
...clean.stats,
lastReviewed: clean.stats.lastReviewed || null,
nextReview: clean.stats.nextReview || null
}
};
}

function fromServerWord(word) {
return normalizeWord({
id: word?.id || null,
eng: word?.eng,
vie: word?.vie,
pos: word?.pos,
tag: word?.tag,
example: word?.example,
note: word?.note,
favorite: word?.favorite,
mastered: word?.mastered,
stats: word?.stats
});
}

function profilePayload() {
let profile = getEditableProfile();
return {
name: profile.name,
avatar: profile.avatar,
birthday: profile.birthday || null,
gender: profile.gender || "",
goal: profile.goal || "",
bio: profile.bio || ""
};
}

function applyServerSnapshot(snapshot) {
if (!snapshot) return;

applyingCloudSnapshot = true;
try {
if (snapshot.profile) applyProfile(snapshot.profile);
if (Array.isArray(snapshot.vocab)) vocab = snapshot.vocab.map(fromServerWord).filter(w => w.eng && w.vie);
if (Array.isArray(snapshot.wrongWords)) wrongWords = snapshot.wrongWords.map(fromServerWord).filter(w => w.eng && w.vie);
if (snapshot.progress) latestProgressSummary = snapshot.progress;
if (Array.isArray(snapshot.achievements)) latestAchievements = snapshot.achievements;
save();
refreshAccountData();
} finally {
applyingCloudSnapshot = false;
}
}

async function syncCloudNow() {
if (!cloudSyncReady || applyingCloudSnapshot) return;

try {
let response = await fetch(`${AUTH_API_ORIGIN}/api/sync`, {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
profile: profilePayload(),
vocab: getVocab().map(toServerWord),
wrongWords: getWrongWords().map(toServerWord)
})
});

if (!response.ok) return;
applyServerSnapshot(await response.json());
} catch (error) {
// Local mode stays usable when the backend is offline.
}
}

function scheduleCloudSync() {
if (!cloudSyncReady || applyingCloudSnapshot) return;
clearTimeout(cloudSyncTimer);
cloudSyncTimer = setTimeout(syncCloudNow, 700);
}

async function requestJson(path, options = {}) {
if (!cloudSyncReady || applyingCloudSnapshot) return null;

try {
let response = await fetch(`${AUTH_API_ORIGIN}${path}`, {
credentials: "include",
headers: { "Content-Type": "application/json", ...(options.headers || {}) },
...options
});

if (!response.ok) return null;
if (response.status === 204) return {};
return await response.json();
} catch (error) {
return null;
}
}

async function createCloudWord(word) {
let created = await requestJson("/api/vocab", {
method: "POST",
body: JSON.stringify(toServerWord(word))
});
return created ? fromServerWord(created) : null;
}

async function updateCloudWord(word) {
let clean = toServerWord(word);
if (!clean.id) return null;

let updated = await requestJson(`/api/vocab/${clean.id}`, {
method: "PUT",
body: JSON.stringify(clean)
});
return updated ? fromServerWord(updated) : null;
}

async function deleteCloudWord(word) {
let id = word?.id;
if (!id) return null;

return requestJson(`/api/vocab/${id}`, { method: "DELETE" });
}

async function importCloudSamples() {
let snapshot = await requestJson("/api/admin/sample-words", { method: "POST" });
if (!snapshot) return false;
applyServerSnapshot(snapshot);
return true;
}

window.quizCloud = {
createWord: createCloudWord,
updateWord: updateCloudWord,
deleteWord: deleteCloudWord,
importSamples: importCloudSamples,
syncNow: syncCloudNow,
isReady: () => cloudSyncReady
};

async function submitCloudQuizResult() {
if (!cloudSyncReady || !Array.isArray(quizData) || quizData.length === 0) return;

try {
let reviewAnswers = quizData.map((item, i) => {
let word = normalizeWord(item.word);
let correctAnswer = item.mode === "eng" ? word.vie : word.eng;
let selectedAnswer = answers[i] || "";
return {
eng: word.eng,
questionMode: item.mode,
selectedAnswer,
correctAnswer,
correct: selectedAnswer === correctAnswer
};
});

let response = await fetch(`${AUTH_API_ORIGIN}/api/quiz-results`, {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
quizMode: window.currentQuizKind || modeSelect?.value || currentMode || "mixed",
challengeSeconds: isChallengeMode ? questionTime : null,
totalQuestions: quizData.length,
correctAnswers: correctCount,
wrongAnswers: quizData.length - correctCount,
score: quizData.length ? Number((correctCount / quizData.length * 10).toFixed(2)) : 0,
maxCombo,
answers: reviewAnswers
})
});

if (response.ok) applyServerSnapshot(await response.json());
} catch (error) {
// Quiz result remains saved locally even if cloud sync cannot be reached.
}
}

function updateStats() {
let topWords = document.getElementById("totalWordsTop");
let topWrong = document.getElementById("totalWrongWordsTop");
let dueToday = document.getElementById("dueTodayTop");
let weeklyCorrect = document.getElementById("weeklyCorrectTop");

if (topWords) topWords.textContent = String(getVocab().length);
if (topWrong) topWrong.textContent = String(getWrongWords().length);
if (dueToday) dueToday.textContent = String(getDueTodayCount());
if (weeklyCorrect) weeklyCorrect.textContent = String(getWeeklyCorrectCount());
updateProfilePanel();
renderLeaderboard();
}

function getTotalCorrect() {
return getVocab().reduce((sum, word) => sum + Number(word?.stats?.correct || 0), 0);
}

function getMasteredCount(words = getVocab()) {
return words.filter(word => {
if (word.mastered) return true;
if (typeof getMasteryLabel === "function") return getMasteryLabel(word) === "Mastered";
return false;
}).length;
}

function getProfileXp(words = getVocab()) {
return words.length * 25 + getTotalCorrect() * 12 + getMasteredCount(words) * 50;
}

function getBestStreak() {
let streaks = getVocab().map(word => Number(word?.stats?.bestStreak || word?.stats?.streak || 0));
return streaks.length ? Math.max(...streaks, 0) : 0;
}

function getDueTodayCount() {
let now = Date.now();
return getVocab().filter(word => {
let nextReview = word?.stats?.nextReview;
if (!nextReview) return Number(word?.stats?.seen || 0) > 0 && !word.mastered;
let due = new Date(nextReview).getTime();
return !Number.isNaN(due) && due <= now;
}).length;
}

function getQuizHistory() {
try {
let raw = localStorage.getItem(accountStorageKey("quizHistory"));
let parsed = raw ? JSON.parse(raw) : [];
return Array.isArray(parsed) ? parsed : [];
} catch (error) {
return [];
}
}

function saveQuizHistory(history) {
localStorage.setItem(accountStorageKey("quizHistory"), JSON.stringify(history.slice(-80)));
}

function getWeeklyCorrectCount() {
if (latestProgressSummary?.weeklyCorrectAnswers != null) {
return latestProgressSummary.weeklyCorrectAnswers;
}

let cutoff = Date.now() - 7 * 86400000;
return getQuizHistory()
.filter(item => new Date(item.createdAt).getTime() >= cutoff)
.reduce((sum, item) => sum + Number(item.correctAnswers || 0), 0);
}

function recordLocalQuizHistory() {
if (!Array.isArray(quizData) || quizData.length === 0) return;

let history = getQuizHistory();
history.push({
createdAt: new Date().toISOString(),
quizMode: window.currentQuizKind || modeSelect?.value || currentMode || "mixed",
challengeSeconds: isChallengeMode ? questionTime : null,
totalQuestions: quizData.length,
correctAnswers: correctCount,
wrongAnswers: quizData.length - correctCount,
score: quizData.length ? Number((correctCount / quizData.length * 10).toFixed(2)) : 0,
maxCombo
});
saveQuizHistory(history);
}

function updateProfilePanel() {
let words = getVocab();
let mastered = getMasteredCount(words);
let xp = getProfileXp(words);
let level = Math.max(1, Math.floor(xp / 250) + 1);
let levelProgress = Math.min(100, Math.round((xp % 250) / 250 * 100));
let mastery = words.length ? Math.round(mastered / words.length * 100) : 0;

let profileLevel = document.getElementById("profileLevel");
let profileXp = document.getElementById("profileXp");
let profileXpBar = document.getElementById("profileXpBar");
let profileStreak = document.getElementById("profileStreak");
let profileMastery = document.getElementById("profileMastery");
let profileAchievements = document.getElementById("profileAchievements");

if (profileLevel) profileLevel.textContent = String(level);
if (profileXp) profileXp.textContent = String(xp);
if (profileXpBar) profileXpBar.style.width = levelProgress + "%";
if (profileStreak) profileStreak.textContent = String(getBestStreak());
if (profileMastery) profileMastery.textContent = mastery + "%";
if (profileAchievements) {
let fallbackBadges = 3 + Math.min(4, Math.floor(words.length / 10));
profileAchievements.textContent = String(latestAchievements.length || fallbackBadges);
}
}

function renderLeaderboard() {
let list = document.getElementById("leaderboardList");
if (!list) return;

let xp = getProfileXp();
let currentPlayer = getCurrentPlayer();
let words = getVocab();
let mastered = getMasteredCount(words);
let mastery = words.length ? Math.round(mastered / words.length * 100) : 0;
let weekly = [
{ name: currentPlayer.name || "You", score: xp || 0, tag: "XP" },
{ name: "Best streak", score: getBestStreak(), tag: "combo" },
{ name: "Mastery", score: mastery, tag: "%" },
{ name: "Due today", score: getDueTodayCount(), tag: "words" },
{ name: "Week correct", score: getWeeklyCorrectCount(), tag: "answers" }
];

list.innerHTML = "";
weekly.forEach((player, index) => {
let item = document.createElement("li");

let rank = document.createElement("span");
rank.className = "leaderRank";
rank.textContent = `#${index + 1}`;

let name = document.createElement("strong");
name.textContent = player.name;

let score = document.createElement("span");
score.textContent = `${player.score} ${player.tag}`;

item.append(rank, name, score);
list.appendChild(item);
});
}

function getCurrentPlayer() {
return typeof getCachedProfile === "function" ? getCachedProfile() : {};
}

function cacheCurrentPlayer(profile) {
if (typeof switchAccountStorage === "function") {
return switchAccountStorage(profile);
}

localStorage.setItem("quizUserProfile", JSON.stringify(profile));
return profile;
}

function setText(id, value) {
let element = document.getElementById(id);
if (element) element.textContent = value;
}

function setImage(id, value) {
let element = document.getElementById(id);
if (element && value) element.src = value;
}

function applyProfile(profile) {
let safeProfile = {
name: profile?.name || "Vocabulary Runner",
email: profile?.email || "",
avatar: profile?.avatar || "images/icon.png",
birthday: profile?.birthday || "",
gender: profile?.gender || "",
goal: profile?.goal || "",
bio: profile?.bio || ""
};

safeProfile = cacheCurrentPlayer(safeProfile) || safeProfile;
let identity = safeProfile.email ? `Signed in as ${safeProfile.email}` : "Local guest profile";

setText("profileName", safeProfile.name);
setText("profileNameSmall", safeProfile.name.split(" ")[0] || "Account");
setText("profileMenuName", safeProfile.name);
setText("profileMenuEmail", identity);
setText("profileIdentityLine", identity);
setText("profileEditorAccount", identity);
setImage("profileAvatarSmall", safeProfile.avatar);
setImage("profileMenuAvatar", safeProfile.avatar);
setImage("profileAvatarLarge", safeProfile.avatar);
setImage("profileEditorAvatarPreview", safeProfile.avatar);
renderLeaderboard();
}

function refreshAccountData() {
wrongWords = wrongWords.map(w => ({
...w,
mastered: w.mastered || false
}));

let autoSpeakToggle = document.getElementById("autoSpeakToggle");
if (autoSpeakToggle && typeof accountStorageKey === "function") {
autoSpeak = localStorage.getItem(accountStorageKey("autoSpeak")) === "true";
autoSpeakToggle.checked = autoSpeak;
}

renderTable();
renderMistakeTable();
updateStats();
}

let profileEditorPendingAvatar = "";

async function loadAuthenticatedProfile() {
let cached = getCurrentPlayer();
if (cached.name || cached.email || cached.avatar) {
applyProfile(cached);
}

try {
let response = await fetch(`${AUTH_API_ORIGIN}/api/me`, {
credentials: "include"
});

if (response.status === 401 || response.status === 403) {
window.location.href = `${AUTH_API_ORIGIN}/oauth2/authorization/google`;
return;
}

if (!response.ok) return;

let profile = await response.json();
if (profile?.authenticated) {
applyProfile(profile);
refreshAccountData();
cloudSyncReady = true;
syncCloudNow();
}
} catch (error) {
if (sessionStorage.getItem("backendLoginWarned") !== "true") {
toast("Backend login sync is offline. Local profile and words still work.", "warn", 3200);
sessionStorage.setItem("backendLoginWarned", "true");
}
}
}

function getEditableProfile() {
let base = getCurrentPlayer();
let accountProfile = typeof getAccountProfile === "function" ? getAccountProfile() : {};
return {
name: accountProfile.name || base.name || "Vocabulary Runner",
email: accountProfile.email || base.email || "",
avatar: accountProfile.avatar || base.avatar || "images/icon.png",
birthday: accountProfile.birthday || "",
gender: accountProfile.gender || "",
goal: accountProfile.goal || "",
bio: accountProfile.bio || ""
};
}

function populateProfileForm(profile = getEditableProfile()) {
let name = document.getElementById("profileFormName");
let email = document.getElementById("profileFormEmail");
let birthday = document.getElementById("profileFormBirthday");
let gender = document.getElementById("profileFormGender");
let goal = document.getElementById("profileFormGoal");
let bio = document.getElementById("profileFormBio");

if (name) name.value = profile.name || "";
if (email) email.value = profile.email || "local-guest";
if (birthday) birthday.value = profile.birthday || "";
if (gender) gender.value = profile.gender || "";
if (goal) goal.value = profile.goal || "";
if (bio) bio.value = profile.bio || "";
setImage("profileEditorAvatarPreview", profile.avatar || "images/icon.png");
}

function openProfileEditor() {
let overlay = document.getElementById("profileEditor");
if (!overlay) return;

populateProfileForm();
profileEditorPendingAvatar = "";
overlay.classList.remove("hidden");
document.body.classList.add("modalOpen");
}

function closeProfileEditor() {
let overlay = document.getElementById("profileEditor");
if (!overlay) return;

overlay.classList.add("hidden");
document.body.classList.remove("modalOpen");
}

function initProfileEditor() {
let overlay = document.getElementById("profileEditor");
let closeBtn = document.getElementById("profileEditorCloseBtn");
let form = document.getElementById("profileForm");
let pickBtn = document.getElementById("profileAvatarPickBtn");
let fileInput = document.getElementById("profileAvatarInput");
let resetBtn = document.getElementById("profileResetBtn");
let avatarPreview = document.getElementById("profileEditorAvatarPreview");

if (!overlay || !form) return;

closeBtn?.addEventListener("click", closeProfileEditor);
overlay.addEventListener("click", event => {
if (event.target === overlay) closeProfileEditor();
});

pickBtn?.addEventListener("click", () => fileInput?.click());
resetBtn?.addEventListener("click", () => {
profileEditorPendingAvatar = "images/icon.png";
if (avatarPreview) avatarPreview.src = profileEditorPendingAvatar;
});

fileInput?.addEventListener("change", () => {
let file = fileInput.files?.[0];
fileInput.value = "";
if (!file) return;

if (!file.type.startsWith("image/")) {
toast("Please choose an image file.", "warn");
return;
}

let reader = new FileReader();
reader.onload = () => {
profileEditorPendingAvatar = String(reader.result || "");
if (avatarPreview && profileEditorPendingAvatar) avatarPreview.src = profileEditorPendingAvatar;
};
reader.readAsDataURL(file);
});

form.addEventListener("submit", event => {
event.preventDefault();

let current = getEditableProfile();
let nextProfile = {
...current,
name: document.getElementById("profileFormName")?.value.trim() || "Vocabulary Runner",
email: current.email || "",
avatar: profileEditorPendingAvatar || current.avatar || "images/icon.png",
birthday: document.getElementById("profileFormBirthday")?.value || "",
gender: document.getElementById("profileFormGender")?.value || "",
goal: document.getElementById("profileFormGoal")?.value.trim() || "",
bio: document.getElementById("profileFormBio")?.value.trim() || ""
};

profileEditorPendingAvatar = "";
applyProfile(nextProfile);
closeProfileEditor();
toast("Profile saved for this account.", "ok");
});

document.addEventListener("keydown", event => {
if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeProfileEditor();
});
}

function initProfileMenu() {
let trigger = document.getElementById("profileTrigger");
let menu = document.getElementById("profileMenu");
let logoutButtons = [
document.getElementById("profileLogoutBtn")
].filter(Boolean);
let settingsBtn = document.getElementById("profileSettingsBtn");

if (!trigger || !menu) return;

function closeMenu() {
menu.classList.add("hidden");
trigger.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
let willOpen = menu.classList.contains("hidden");
menu.classList.toggle("hidden", !willOpen);
trigger.setAttribute("aria-expanded", String(willOpen));
}

trigger.addEventListener("click", event => {
event.stopPropagation();
toggleMenu();
});

document.addEventListener("click", event => {
if (!menu.contains(event.target) && event.target !== trigger) closeMenu();
});

document.addEventListener("keydown", event => {
if (event.key === "Escape") closeMenu();
});

logoutButtons.forEach(button => {
button.addEventListener("click", () => {
localStorage.removeItem("quizUserProfile");
window.location.href = `${AUTH_API_ORIGIN}/logout`;
});
});

settingsBtn?.addEventListener("click", () => {
closeMenu();
openProfileEditor();
});
}

function ensureToastHost() {
let host = document.querySelector(".toastHost");
if (host) return host;

host = document.createElement("div");
host.className = "toastHost";
document.body.appendChild(host);
return host;
}

function toast(message, kind = "ok", ms = 2200) {
let host = ensureToastHost();
let el = document.createElement("div");
el.className = `toast toast--${kind}`;
el.textContent = message;
host.appendChild(el);

setTimeout(() => {
el.style.opacity = "0";
el.style.transform = "translateY(6px)";
el.style.transition = "all 180ms ease";
setTimeout(() => el.remove(), 220);
}, ms);
}

function initSearch() {
let input = document.getElementById("vocabSearch");
let clearBtn = document.getElementById("clearSearch");
let filterControls = [
document.getElementById("filterPos"),
document.getElementById("filterTag"),
document.getElementById("filterMastery"),
document.getElementById("filterFavorites")
].filter(Boolean);

window.vocabFilterQuery = "";

function update() {
window.vocabFilterQuery = (input?.value || "").trim();
renderTable();
}

input?.addEventListener("input", update);
filterControls.forEach(control => control.addEventListener("change", update));
clearBtn?.addEventListener("click", () => {
if (input) {
input.value = "";
input.focus();
}
filterControls.forEach(control => {
if (control.type === "checkbox") control.checked = false;
else control.value = "";
});
update();
});
}

function exportData() {
let data = {
version: 1,
exportedAt: new Date().toISOString(),
vocab: getVocab(),
wrongWords: getWrongWords()
};

let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = `vocab-quiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);

toast("Exported backup JSON.", "ok");
}

function cleanWord(word) {
if (!word || typeof word !== "object") return null;

let cleaned = normalizeWord(word);

if (!cleaned.eng || !cleaned.vie) return null;

return cleaned;
}

function normalizeImported(payload) {
if (!payload) return null;

let importedVocab = [];
let importedWrong = [];

if (Array.isArray(payload)) {
importedVocab = payload;
} else if (typeof payload === "object") {
importedVocab = Array.isArray(payload.vocab) ? payload.vocab : [];
importedWrong = Array.isArray(payload.wrongWords) ? payload.wrongWords : [];
} else {
return null;
}

return {
vocab: importedVocab.map(cleanWord).filter(Boolean),
wrongWords: importedWrong.map(cleanWord).filter(Boolean)
};
}

function mergeByEnglish(base, incoming) {
let merged = [...base];
let existing = new Set(base.map(w => String(w.eng || "").toLowerCase()));

incoming.forEach(w => {
let key = String(w.eng || "").toLowerCase();
if (!key || existing.has(key)) return;
existing.add(key);
merged.push(w);
});

return merged;
}

async function importStarterWords() {
if (await window.quizCloud?.importSamples()) {
toast("Imported starter words to your cloud deck.", "ok");
return;
}

let incoming = STARTER_WORDS.map(cleanWord).filter(Boolean);
let before = getVocab().length;
setData(mergeByEnglish(getVocab(), incoming), getWrongWords());
let added = getVocab().length - before;
toast(added ? `Imported ${added} starter words.` : "Starter words are already in this deck.", added ? "ok" : "warn");
syncCloudNow();
}

function initImportExport() {
let exportBtn = document.getElementById("exportBtn");
let importBtn = document.getElementById("importBtn");
let sampleImportBtn = document.getElementById("sampleImportBtn");
let file = document.getElementById("importFile");

exportBtn?.addEventListener("click", exportData);
importBtn?.addEventListener("click", () => file?.click());
sampleImportBtn?.addEventListener("click", importStarterWords);

file?.addEventListener("change", async () => {
let selectedFile = file.files?.[0];
file.value = "";
if (!selectedFile) return;

try {
let text = await selectedFile.text();
let normalized = normalizeImported(JSON.parse(text));

if (!normalized || normalized.vocab.length === 0) {
toast("Import file has no valid vocab.", "warn");
return;
}

let replace = confirm(
`Import ${normalized.vocab.length} words.\n\nOK = Replace current data\nCancel = Merge into current`
);

if (replace) {
setData(normalized.vocab, normalized.wrongWords);
} else {
setData(
mergeByEnglish(getVocab(), normalized.vocab),
mergeByEnglish(getWrongWords(), normalized.wrongWords)
);
}

toast("Imported successfully.", "ok");
} catch (error) {
toast("Import failed. Please use a valid JSON backup.", "err");
}
});
}

function initPreview() {
let overlay = document.getElementById("appPreview");
let openBtn = document.getElementById("previewBtn");
let closeBtn = document.getElementById("previewCloseBtn");

if (!overlay || !openBtn || !closeBtn) return;

function open() {
overlay.classList.remove("hidden");
document.body.classList.add("modalOpen");
}

function close() {
overlay.classList.add("hidden");
document.body.classList.remove("modalOpen");
}

openBtn.addEventListener("click", open);
closeBtn.addEventListener("click", close);

overlay.addEventListener("click", event => {
if (event.target === overlay) close();
});

document.addEventListener("keydown", event => {
if (event.key === "Escape" && !overlay.classList.contains("hidden")) close();
});
}

initSearch();
initImportExport();
initPreview();
initProfileEditor();
initProfileMenu();
loadAuthenticatedProfile();
updateStats();

let originalRenderTable = window.renderTable;
if (typeof originalRenderTable === "function") {
window.renderTable = function (...args) {
let result = originalRenderTable.apply(this, args);
updateStats();
return result;
};
}

let originalRenderMistakeTable = window.renderMistakeTable;
if (typeof originalRenderMistakeTable === "function") {
window.renderMistakeTable = function (...args) {
let result = originalRenderMistakeTable.apply(this, args);
updateStats();
return result;
};
}

let originalSave = window.save;
if (typeof originalSave === "function") {
window.save = function (...args) {
let result = originalSave.apply(this, args);
scheduleCloudSync();
return result;
};
}

let originalFinishQuiz = window.finishQuiz;
if (typeof originalFinishQuiz === "function") {
window.finishQuiz = function (...args) {
let result = originalFinishQuiz.apply(this, args);
recordLocalQuizHistory();
updateStats();
submitCloudQuizResult();
return result;
};
}
})();
