// App polish layer: preview guide, search, backup, and small UX helpers.
(function () {
const AUTH_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";
const REQUIRE_AUTH = window.quizIsProductionFrontend ? window.quizIsProductionFrontend() : false;
const CLOUD_DELETE_QUEUE_KEY = "cloudDeleteQueue";
let cloudSyncReady = false;
let cloudSyncTimer = null;
let applyingCloudSnapshot = false;
let latestProgressSummary = null;
let latestAchievements = [];
let cloudSnapshotPulled = false;

const STARTER_WORDS = [
{ eng: "resilient", vie: "kiên cường", pos: "adj", tag: "mindset", ipa: "/ri-ZIL-yuhnt/", level: "B1", context: "learning after difficulty", example: "She stayed resilient after the hard exam.", exampleMeaning: "Cô ấy vẫn kiên cường sau bài kiểm tra khó.", collocation: "resilient learner, remain resilient", synonyms: "strong, tough", antonyms: "fragile", commonMistake: "Do not use resilient for every kind of strong object.", note: "Useful for school and life." },
{ eng: "curious", vie: "tò mò", pos: "adj", tag: "mindset", ipa: "/KYUR-ee-uhs/", level: "A2", context: "learning attitude", example: "A curious learner asks better questions.", exampleMeaning: "Người học tò mò đặt câu hỏi tốt hơn.", collocation: "curious about, curious learner", synonyms: "interested", antonyms: "indifferent", commonMistake: "Curious about something, not curious with something.", note: "Good learning attitude." },
{ eng: "focus", vie: "tập trung", pos: "v", tag: "study", ipa: "/FOH-kuhs/", level: "A2", context: "study action", example: "Focus on one small step first.", exampleMeaning: "Hãy tập trung vào một bước nhỏ trước.", collocation: "focus on, stay focused", synonyms: "concentrate", antonyms: "distract", commonMistake: "Use focus on, not focus in.", note: "Can be noun or verb." },
{ eng: "review", vie: "ôn lại", pos: "v", tag: "study", ipa: "/ri-VYOO/", level: "A2", context: "spaced repetition", example: "Review the hard words tomorrow.", exampleMeaning: "Hãy ôn lại các từ khó vào ngày mai.", collocation: "review notes, review vocabulary", synonyms: "revise", antonyms: "ignore", commonMistake: "In US English, review often means study again.", note: "Core spaced repetition action." },
{ eng: "progress", vie: "tiến bộ", pos: "n", tag: "study", ipa: "/PRAH-gres/", level: "A2", context: "learning result", example: "Small progress still counts.", exampleMeaning: "Tiến bộ nhỏ vẫn đáng được ghi nhận.", collocation: "make progress, steady progress", synonyms: "improvement", antonyms: "decline", commonMistake: "Say make progress, not do progress.", note: "Motivation word." },
{ eng: "attempt", vie: "cố gắng thử", pos: "v", tag: "exam", ipa: "/uh-TEMPT/", level: "B1", context: "exam task", example: "Attempt every question calmly.", exampleMeaning: "Hãy thử làm mọi câu hỏi một cách bình tĩnh.", collocation: "attempt a question, first attempt", synonyms: "try", antonyms: "avoid", commonMistake: "Attempt is more formal than try.", note: "Try, not necessarily succeed." },
{ eng: "evidence", vie: "bằng chứng", pos: "n", tag: "exam", ipa: "/EV-i-duhns/", level: "B1", context: "essay support", example: "Use evidence to support your answer.", exampleMeaning: "Dùng bằng chứng để ủng hộ câu trả lời.", collocation: "strong evidence, provide evidence", synonyms: "proof", antonyms: "claim", commonMistake: "Evidence is usually uncountable.", note: "Common in essays." },
{ eng: "compare", vie: "so sánh", pos: "v", tag: "exam", ipa: "/kuhm-PAIR/", level: "A2", context: "task verb", example: "Compare the two ideas clearly.", exampleMeaning: "Hãy so sánh hai ý tưởng một cách rõ ràng.", collocation: "compare A with B", synonyms: "contrast", antonyms: "separate", commonMistake: "Use compare A with B for general comparison.", note: "Task verb." },
{ eng: "habit", vie: "thói quen", pos: "n", tag: "daily", ipa: "/HAB-it/", level: "A2", context: "daily routine", example: "A tiny habit can become powerful.", exampleMeaning: "Một thói quen nhỏ có thể trở nên mạnh mẽ.", collocation: "build a habit, daily habit", synonyms: "routine", antonyms: "one-time action", commonMistake: "Habit is a repeated action, not one decision.", note: "Daily routine." },
{ eng: "calm", vie: "bình tĩnh", pos: "adj", tag: "daily", ipa: "/kahm/", level: "A2", context: "emotion", example: "Stay calm before answering.", exampleMeaning: "Hãy giữ bình tĩnh trước khi trả lời.", collocation: "stay calm, calm down", synonyms: "relaxed", antonyms: "anxious", commonMistake: "Calm down can sound direct; be careful in polite speech.", note: "Mood and behavior." }
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

function ensureSyncStatus() {
let existing = document.getElementById("cloudSyncStatus");
if (existing) return existing;

let host = document.querySelector(".appTopbarStatus") || document.querySelector(".utilityBar");
if (!host) return null;

let status = document.createElement("span");
status.id = "cloudSyncStatus";
status.className = "syncStatus syncStatus--local";
status.textContent = "Offline/local mode";
host.appendChild(status);
return status;
}

function setSyncStatus(message, tone = "local") {
let status = ensureSyncStatus();
if (!status) return;
status.textContent = message;
status.className = `syncStatus syncStatus--${tone}`;
}

function cloudDeleteQueueKey() {
return typeof accountStorageKey === "function"
? accountStorageKey(CLOUD_DELETE_QUEUE_KEY)
: CLOUD_DELETE_QUEUE_KEY;
}

function readPendingCloudDeletes() {
try {
let raw = localStorage.getItem(cloudDeleteQueueKey());
let ids = raw ? JSON.parse(raw) : [];
return Array.isArray(ids) ? Array.from(new Set(ids.map(id => String(id)).filter(Boolean))) : [];
} catch (error) {
return [];
}
}

function writePendingCloudDeletes(ids) {
let clean = Array.from(new Set((ids || []).map(id => String(id)).filter(Boolean)));
try {
if (clean.length) {
localStorage.setItem(cloudDeleteQueueKey(), JSON.stringify(clean));
} else {
localStorage.removeItem(cloudDeleteQueueKey());
}
} catch (error) {
// Local-first behavior stays available even if localStorage quota is unavailable.
}
return clean;
}

function queuePendingCloudDelete(id) {
if (!id) return [];
return writePendingCloudDeletes([...readPendingCloudDeletes(), id]);
}

async function flushPendingCloudDeletes() {
let ids = readPendingCloudDeletes();
if (!ids.length) return true;
if (!cloudSyncReady) return false;

let remaining = [];
for (let id of ids) {
try {
let response = await fetch(`${AUTH_API_ORIGIN}/api/vocab/${encodeURIComponent(id)}`, {
method: "DELETE",
credentials: "include"
});
if (!response.ok && response.status !== 404) remaining.push(id);
} catch (error) {
remaining.push(id);
}
}

writePendingCloudDeletes(remaining);
if (remaining.length) {
setSyncStatus("Delete pending - sync paused", "warn");
return false;
}
return true;
}

function toServerWord(word) {
let clean = normalizeWord(word);
return {
id: clean.id,
eng: clean.eng,
vie: clean.vie,
pos: clean.pos,
tag: clean.tag,
ipa: clean.ipa,
level: clean.level,
context: clean.context,
example: clean.example,
exampleMeaning: clean.exampleMeaning,
collocation: clean.collocation,
synonyms: clean.synonyms,
antonyms: clean.antonyms,
commonMistake: clean.commonMistake,
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
ipa: word?.ipa,
level: word?.level,
context: word?.context,
example: word?.example,
exampleMeaning: word?.exampleMeaning,
collocation: word?.collocation,
synonyms: word?.synonyms,
antonyms: word?.antonyms,
commonMistake: word?.commonMistake,
note: word?.note,
favorite: word?.favorite,
mastered: word?.mastered,
updatedAt: word?.updatedAt,
stats: word?.stats
});
}

function wordMergeKey(word) {
let eng = typeof normalizeEnglishKey === "function"
? normalizeEnglishKey(word?.eng)
: String(word?.eng || "").trim().toLowerCase().replace(/\s+/g, " ");
let id = word?.id ? `id:${word.id}` : "";
return eng ? `eng:${eng}` : id;
}

function wordUpdatedTime(word) {
let candidates = [
word?.updatedAt,
word?.updated_at,
word?.stats?.lastReviewed,
word?.stats?.nextReview
];

for (let value of candidates) {
let time = Date.parse(value || "");
if (!Number.isNaN(time)) return time;
}

return 0;
}

function mergeWordFields(primary, secondary) {
let merged = {
...(secondary || {}),
...(primary || {}),
stats: {
...(secondary?.stats || {}),
...(primary?.stats || {})
}
};

for (let key of ["eng", "vie", "pos", "tag", "ipa", "level", "context", "example", "exampleMeaning", "collocation", "synonyms", "antonyms", "commonMistake", "note", "updatedAt"]) {
if (!merged[key] && secondary?.[key]) merged[key] = secondary[key];
}

return normalizeWord(merged);
}

function chooseMergedWord(localWord, cloudWord) {
if (!localWord) return normalizeWord(cloudWord);
if (!cloudWord) return normalizeWord(localWord);

let localTime = wordUpdatedTime(localWord);
let cloudTime = wordUpdatedTime(cloudWord);

if (localTime && cloudTime) {
return cloudTime >= localTime
? mergeWordFields(cloudWord, localWord)
: mergeWordFields(localWord, cloudWord);
}

if (cloudTime && !localTime) return mergeWordFields(cloudWord, localWord);
if (localTime && !cloudTime) return mergeWordFields(localWord, cloudWord);
return mergeWordFields(cloudWord, localWord);
}

function mergeWordLists(localList, cloudList) {
let merged = new Map();

for (let word of Array.isArray(localList) ? localList : []) {
let clean = normalizeWord(word);
let key = wordMergeKey(clean);
if (key && clean.eng && clean.vie) merged.set(key, clean);
}

for (let word of Array.isArray(cloudList) ? cloudList : []) {
let clean = fromServerWord(word);
let key = wordMergeKey(clean);
if (!key || !clean.eng || !clean.vie) continue;
merged.set(key, chooseMergedWord(merged.get(key), clean));
}

return Array.from(merged.values());
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
if (Array.isArray(snapshot.vocab)) vocab = mergeWordLists(getVocab(), snapshot.vocab);
if (Array.isArray(snapshot.wrongWords)) wrongWords = mergeWordLists(getWrongWords(), snapshot.wrongWords);
if (snapshot.progress) latestProgressSummary = snapshot.progress;
if (Array.isArray(snapshot.achievements)) latestAchievements = snapshot.achievements;
save();
refreshAccountData();
} finally {
applyingCloudSnapshot = false;
}
}

async function pullCloudSnapshot() {
if (!cloudSyncReady || applyingCloudSnapshot) return false;

setSyncStatus("Syncing...", "syncing");

try {
if (!await flushPendingCloudDeletes()) return false;
let response = await fetch(`${AUTH_API_ORIGIN}/api/snapshot`, {
credentials: "include"
});

if (!response.ok) {
setSyncStatus("Cloud unavailable", "warn");
return false;
}

applyServerSnapshot(await response.json());
cloudSnapshotPulled = true;
setSyncStatus("Synced", "ok");
return true;
} catch (error) {
setSyncStatus("Offline/local mode", "local");
return false;
}
}

async function syncCloudNow() {
if (!cloudSyncReady || applyingCloudSnapshot) return;

try {
setSyncStatus("Syncing...", "syncing");
if (!await flushPendingCloudDeletes()) return;
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

if (!response.ok) {
setSyncStatus("Cloud unavailable", "warn");
return;
}
applyServerSnapshot(await response.json());
cloudSnapshotPulled = true;
setSyncStatus("Synced", "ok");
} catch (error) {
// Local mode stays usable when the backend is offline.
setSyncStatus("Offline/local mode", "local");
}
}

function scheduleCloudSync() {
if (!cloudSyncReady || applyingCloudSnapshot) return;
if (!cloudSnapshotPulled) {
pullCloudSnapshot().then(pulled => {
if (pulled) syncCloudNow();
});
return;
}
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

queuePendingCloudDelete(id);
setSyncStatus("Delete pending - sync paused", "syncing");
let flushed = await flushPendingCloudDeletes();
if (!flushed) return null;
setSyncStatus("Synced", "ok");
return {};
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
pullNow: pullCloudSnapshot,
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
let accuracyTop = document.getElementById("accuracyTop");
let weakWordsTop = document.getElementById("weakWordsTop");

if (topWords) topWords.textContent = String(getVocab().length);
if (topWrong) topWrong.textContent = String(getWrongWords().length);
if (dueToday) dueToday.textContent = String(getDueTodayCount());
if (weeklyCorrect) weeklyCorrect.textContent = String(getWeeklyCorrectCount());
if (accuracyTop) accuracyTop.textContent = `${getAverageAccuracy()}%`;
if (weakWordsTop) weakWordsTop.textContent = String(getWeakWordCandidates().length);
updateProfilePanel();
renderLeaderboard();
renderWeakWordsCenter();
}

function getTotalCorrect() {
return getVocab().reduce((sum, word) => sum + Number(word?.stats?.correct || 0), 0);
}

function getTotalReviews() {
return getVocab().reduce((sum, word) => {
let stats = word?.stats || {};
return sum + Math.max(Number(stats.seen || 0), Number(stats.correct || 0) + Number(stats.wrong || 0));
}, 0);
}

function getAverageAccuracy() {
let total = getTotalReviews();
return total ? Math.round(getTotalCorrect() / total * 100) : 0;
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

function getWordReviewCount(word) {
let stats = word?.stats || {};
return Math.max(Number(stats.seen || 0), Number(stats.correct || 0) + Number(stats.wrong || 0));
}

function getWordAccuracy(word) {
let total = getWordReviewCount(word);
return total ? Math.round(Number(word?.stats?.correct || 0) / total * 100) : 0;
}

function getWeakWordCandidates(limit = 8) {
let now = Date.now();
return getVocab()
.map(word => {
let stats = word?.stats || {};
let nextReview = stats.nextReview ? new Date(stats.nextReview).getTime() : null;
let overdue = nextReview && !Number.isNaN(nextReview) && nextReview <= now;
let mastery = typeof getMasteryLabel === "function" ? getMasteryLabel(word) : "";
let wrong = Number(stats.wrong || 0);
let reviews = getWordReviewCount(word);
let accuracy = getWordAccuracy(word);
let weak = wrong >= 2 || (reviews >= 3 && accuracy < 70) || (overdue && mastery !== "Mastered");
let score = wrong * 4 + (100 - accuracy) / 10 + (overdue ? 12 : 0);
return { word, wrong, reviews, accuracy, overdue, score, weak };
})
.filter(item => item.word?.eng && item.word?.vie && item.weak)
.sort((a, b) => b.score - a.score)
.slice(0, limit);
}

function renderWeakWordsCenter() {
let list = document.getElementById("weakWordsCenterList");
let summary = document.getElementById("weakWordsCenterSummary");
let button = document.getElementById("weakWordsReviewBtn");
if (!list) return;

let items = getWeakWordCandidates(6);
list.innerHTML = "";
if (summary) {
summary.textContent = items.length
? `${items.length} priority words based on wrong count, mastery, and due status.`
: "Weak words will appear after you review or miss vocabulary.";
}
if (button) button.disabled = items.length === 0;

if (!items.length) {
let empty = document.createElement("p");
empty.className = "emptyStudio";
empty.textContent = getVocab().length
? "No weak words yet. Keep reviewing and this center will surface problem words."
: "No vocabulary yet. Add words or generate an AI Deck to start learning.";
list.appendChild(empty);
return;
}

items.forEach(item => {
let card = document.createElement("article");
card.className = "weakFixCard";
let main = document.createElement("div");
main.className = "weakFixMain";
let title = document.createElement("strong");
title.textContent = item.word.eng;
let meaning = document.createElement("span");
meaning.className = "weakFixMeaning";
meaning.textContent = item.word.vie;
main.append(title, meaning);
let meta = document.createElement("small");
meta.className = "weakFixStats";
let dueText = item.overdue ? "overdue" : `${item.reviews} reviews`;
meta.textContent = `${item.accuracy}% accuracy | ${item.wrong} wrong | ${dueText} | ${item.word.tag || "untagged"}`;
card.append(main, meta);
list.appendChild(card);
});
}

function startWeakWordsReview() {
let words = getWeakWordCandidates(12).map(item => item.word);
if (!words.length) return;
if (typeof startWordSetQuiz === "function") {
startWordSetQuiz(words, "mixed", { kind: "weak-words" });
} else if (typeof showAppPage === "function") {
showAppPage("review");
}
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

function redirectToLogin() {
let target = new URL("login.html", window.location.href);
window.location.replace(target.href);
}

const APP_PAGE_LABELS = {
dashboard: { eyebrow: "Workspace", title: "Dashboard" },
vocabulary: { eyebrow: "Word Bank", title: "Vocabulary" },
review: { eyebrow: "Spaced Repetition", title: "Review" },
aiDeck: { eyebrow: "Generator", title: "AI Deck" },
analytics: { eyebrow: "Insights", title: "Analytics" },
studio: { eyebrow: "Learning Tools", title: "Studio" }
};

function showAppPage(page = "dashboard") {
let nextPage = APP_PAGE_LABELS[page] ? page : "dashboard";
document.body.dataset.appPage = nextPage;

document.querySelectorAll("[data-app-page-panel]").forEach(panel => {
panel.classList.toggle("is-active-page", panel.dataset.appPagePanel === nextPage);
});

document.querySelectorAll("[data-app-page]").forEach(button => {
button.classList.toggle("is-active", button.dataset.appPage === nextPage);
});

let label = APP_PAGE_LABELS[nextPage];
setText("appPageEyebrow", label.eyebrow);
setText("appPageTitle", label.title);

document.getElementById("home")?.classList.remove("hidden");
document.getElementById("quizScreen")?.classList.add("hidden");
document.getElementById("resultScreen")?.classList.add("hidden");
document.getElementById("reviewScreen")?.classList.add("hidden");
document.getElementById("mistakeScreen")?.classList.add("hidden");
document.getElementById("challengeMenu")?.classList.add("hidden");
document.getElementById("challengeMenu")?.classList.remove("show");
document.querySelector(".heroPanel")?.classList.toggle("hidden", nextPage !== "dashboard");

if (nextPage === "analytics") window.analyticsDashboard?.refresh?.();
if (nextPage === "review") window.reviewToday?.refresh?.();
window.scrollTo({ top: 0, behavior: "smooth" });
}

function initAppShell() {
document.querySelectorAll("[data-app-page]").forEach(button => {
button.addEventListener("click", () => showAppPage(button.dataset.appPage));
});
document.getElementById("weakWordsReviewBtn")?.addEventListener("click", startWeakWordsReview);
showAppPage(document.body.dataset.appPage || "dashboard");
}

window.showAppPage = showAppPage;

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
if (!REQUIRE_AUTH && (cached.name || cached.email || cached.avatar)) {
applyProfile(cached);
}

try {
let response = await fetch(`${AUTH_API_ORIGIN}/api/me`, {
credentials: "include"
});

if (response.status === 401 || response.status === 403) {
if (REQUIRE_AUTH) redirectToLogin();
return;
}

if (!response.ok) {
if (REQUIRE_AUTH) redirectToLogin();
return;
}

let profile = await response.json();
if (profile?.authenticated) {
applyProfile(profile);
refreshAccountData();
cloudSyncReady = true;
let pulled = await pullCloudSnapshot();
if (pulled) syncCloudNow();
} else if (REQUIRE_AUTH) {
redirectToLogin();
}
} catch (error) {
if (REQUIRE_AUTH) {
redirectToLogin();
return;
}
if (sessionStorage.getItem("backendLoginWarned") !== "true") {
toast("Backend login sync is offline. Local profile and words still work.", "warn", 3200);
sessionStorage.setItem("backendLoginWarned", "true");
}
setSyncStatus("Offline/local mode", "local");
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
document.getElementById("filterFavorites"),
document.getElementById("filterDue")
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
return mergeByEnglishWithStats(base, incoming).merged;
}

function mergeByEnglishWithStats(base, incoming) {
let merged = [...base];
let existing = new Set(base.map(w => normalizeEnglishKey(w.eng)).filter(Boolean));
let added = 0;
let skipped = 0;
let importedAt = new Date().toISOString();

incoming.forEach(w => {
let key = normalizeEnglishKey(w.eng);
if (!key || existing.has(key)) {
skipped++;
return;
}
existing.add(key);
merged.push(stampWordUpdatedAt(normalizeWord(w), importedAt));
added++;
});

return { merged, added, skipped };
}

async function importStarterWords() {
if (await window.quizCloud?.importSamples()) {
toast("Imported starter words to your cloud deck.", "ok");
return;
}

let incoming = STARTER_WORDS.map(cleanWord).filter(Boolean);
let result = mergeByEnglishWithStats(getVocab(), incoming);
setData(result.merged, getWrongWords());
toast(
result.added ? `Imported ${result.added} starter words. Skipped ${result.skipped} duplicates.` : `No new starter words imported. ${result.skipped} duplicates already exist.`,
result.added ? "ok" : "warn"
);
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
if (!text.trim()) {
toast("Import file appears empty.", "warn");
return;
}

let payload;
try {
payload = JSON.parse(text);
} catch (error) {
toast("This JSON file is invalid.", "err");
return;
}

let normalized = normalizeImported(payload);

if (!normalized || normalized.vocab.length === 0) {
toast("Import file has no valid vocab.", "warn");
return;
}

let replace = confirm(
`Import ${normalized.vocab.length} words.\n\nOK = Replace current data\nCancel = Merge into current`
);

if (replace) {
let importedAt = new Date().toISOString();
setData(
normalized.vocab.map(word => stampWordUpdatedAt(normalizeWord(word), importedAt)),
normalized.wrongWords.map(word => stampWordUpdatedAt(normalizeWord(word), importedAt))
);
toast(`Imported ${normalized.vocab.length} words by replacing current data.`, "ok");
} else {
let vocabResult = mergeByEnglishWithStats(getVocab(), normalized.vocab);
let wrongResult = mergeByEnglishWithStats(getWrongWords(), normalized.wrongWords);
setData(
vocabResult.merged,
wrongResult.merged
);
toast(`Imported ${vocabResult.added} words. Skipped ${vocabResult.skipped} duplicates.`, vocabResult.added ? "ok" : "warn");
}
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

initAppShell();
initSearch();
initImportExport();
initPreview();
initProfileEditor();
initProfileMenu();
ensureSyncStatus();
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
