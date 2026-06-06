(function () {
const REVIEW_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";

let reviewQueue = [];
let reviewSource = "Local";
let reviewApiError = "";
let revealedReviewItems = new Set();
let reviewSubmittingItems = new Set();

function getWords() {
return typeof vocab !== "undefined" && Array.isArray(vocab) ? vocab : [];
}

function stats(word) {
if (!word.stats) {
word.stats = {
seen: 0,
correct: 0,
wrong: 0,
streak: 0,
bestStreak: 0,
masteryLevel: 0,
lastReviewed: null,
nextReview: null
};
}
return word.stats;
}

function masteryPercent(word) {
return Math.max(0, Math.min(100, Number(stats(word).masteryLevel || 0) * 20));
}

function isDue(word) {
let raw = stats(word).nextReview;
if (!raw) return false;
let due = new Date(raw).getTime();
return !Number.isNaN(due) && due <= Date.now();
}

function priority(word) {
let data = stats(word);
let due = data.nextReview ? new Date(data.nextReview).getTime() : Date.now();
let overdueDays = Math.max(0, Math.floor((Date.now() - due) / 86400000));
let lowMastery = 100 - masteryPercent(word);
let wrongPressure = Math.min(30, Number(data.wrong || 0) * 6);
let overduePressure = Math.min(30, overdueDays * 5);
return Math.max(0, Math.min(100, Math.round(lowMastery + wrongPressure + overduePressure)));
}

function reason(word) {
let data = stats(word);
let due = data.nextReview ? new Date(data.nextReview).getTime() : Date.now();
let overdue = due < Date.now() - 86400000;
if (overdue && masteryPercent(word) < 60) return "Overdue and low mastery";
if (overdue) return "Overdue review";
if (Number(data.wrong || 0) >= 3) return "High wrong count";
if (masteryPercent(word) < 60) return "Low mastery";
return "Due today";
}

function localQueue(limit = 8) {
return getWords()
.filter(isDue)
.map(word => ({
wordId: word.id || null,
eng: word.eng,
vie: word.vie,
tag: word.tag || "untagged",
level: word.level || "unknown",
pos: word.pos || "",
example: word.example || "",
note: word.note || "",
mastery: masteryPercent(word),
streak: Number(stats(word).streak || 0),
wrongCount: Number(stats(word).wrong || 0),
nextReview: stats(word).nextReview,
priority: priority(word),
reason: reason(word),
localWord: word
}))
.sort((a, b) => b.priority - a.priority)
.slice(0, limit);
}

function findLocalWord(item) {
return getWords().find(word =>
(item.wordId && word.id === item.wordId) ||
String(word.eng || "").trim().toLowerCase() === String(item.eng || item.word || "").trim().toLowerCase()
);
}

function enrichReviewItem(item) {
let localWord = item.localWord || findLocalWord(item);
return {
...item,
wordId: item.wordId || item.id || localWord?.id || null,
eng: item.eng || item.word || localWord?.eng || "",
vie: item.vie || item.meaning || localWord?.vie || "",
tag: item.tag || localWord?.tag || "untagged",
level: item.level || localWord?.level || "unknown",
pos: item.pos || localWord?.pos || "",
example: item.example || localWord?.example || "",
note: item.note || localWord?.note || "",
localWord
};
}

function reviewItemKey(item, index = 0) {
return String(item.wordId || item.eng || index);
}

async function fetchQueue() {
try {
let response = await fetch(`${REVIEW_API_ORIGIN}/api/review/queue?limit=8`, {
credentials: "include"
});
if (!response.ok) {
return { items: null, error: `Cloud review queue failed (${response.status}). Showing local queue.` };
}
let payload = await response.json();
return Array.isArray(payload)
? { items: payload, error: "" }
: { items: null, error: "Cloud review queue returned an unexpected response. Showing local queue." };
} catch (error) {
return { items: null, error: "Cloud review queue is unavailable. Showing local queue." };
}
}

async function postAnswer(item, correct) {
if (!item.wordId) return null;
try {
let response = await fetch(`${REVIEW_API_ORIGIN}/api/review/answer`, {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
wordId: item.wordId,
correct,
mode: "review"
})
});
if (!response.ok) {
reviewApiError = `Cloud review update failed (${response.status}). Saved locally for now.`;
return null;
}
return response.json();
} catch (error) {
reviewApiError = "Cloud review update is unavailable. Saved locally for now.";
return null;
}
}

function nextReviewDate(streak, correct) {
let due = new Date();
let days;
if (!correct) {
days = 1;
} else if (streak <= 1) {
days = 1;
} else if (streak === 2) {
days = 3;
} else if (streak === 3) {
days = 7;
} else if (streak === 4) {
days = 14;
} else {
days = 30;
}
due.setDate(due.getDate() + days);
return due.toISOString();
}

function applyLocalAnswer(item, correct, serverResponse = null) {
let word = item.localWord || getWords().find(candidate =>
candidate.id === item.wordId || candidate.eng === item.eng
);
if (!word) return;

let data = stats(word);
data.seen = Number(data.seen || 0) + 1;
data.lastReviewed = new Date().toISOString();
if (correct) {
data.correct = Number(data.correct || 0) + 1;
data.streak = serverResponse?.streak ?? (Number(data.streak || 0) + 1);
data.bestStreak = Math.max(Number(data.bestStreak || 0), Number(data.streak || 0));
data.masteryLevel = Math.min(5, serverResponse ? Math.round(Number(serverResponse.mastery || 0) / 20) : Number(data.masteryLevel || 0) + 1);
} else {
data.wrong = Number(data.wrong || 0) + 1;
data.streak = serverResponse?.streak ?? 0;
data.masteryLevel = Math.max(0, serverResponse ? Math.round(Number(serverResponse.mastery || 0) / 20) : Number(data.masteryLevel || 0) - 1);
word.mastered = false;
}

if (Number(data.streak || 0) >= 5) {
word.mastered = true;
data.masteryLevel = 5;
}

data.nextReview = serverResponse?.nextReview || nextReviewDate(Number(data.streak || 0), correct);
persistLocalWords();
renderTable?.();
window.analyticsDashboard?.refresh?.();
}

function persistLocalWords() {
if (typeof accountStorageKey === "function") {
localStorage.setItem(accountStorageKey("vocab"), JSON.stringify(getWords()));
} else {
localStorage.setItem("vocab", JSON.stringify(getWords()));
}
}

function setText(id, value) {
let node = document.getElementById(id);
if (node) node.textContent = String(value);
}

function stateLine(text, kind = "info") {
let line = document.createElement("p");
line.className = `apiStateMessage apiStateMessage--${kind}`;
line.textContent = text;
return line;
}

function renderFeedback(response, correct, fallbackMessage = "", rating = "") {
let host = document.getElementById("reviewTodayBody");
if (!host) return;
let feedback = document.createElement("div");
feedback.className = "reviewFeedback";
let title = document.createElement("strong");
title.textContent = rating === "easy" ? "Easy marked" : correct ? "Good review" : "Again queued";
let detail = document.createElement("span");
detail.textContent = fallbackMessage || response?.message || (correct ? "Saved as correct with the existing review API." : "Saved as incorrect with the existing review API.");
feedback.append(title, detail);
host.prepend(feedback);
setTimeout(() => feedback.remove(), 3200);
}

function renderLoading() {
let host = document.getElementById("reviewTodayBody");
if (!host) return;
host.innerHTML = "";
host.appendChild(stateLine("Loading review queue...", "loading"));
setText("reviewTodayMeta", "Checking due words...");
}

function renderQueue() {
let host = document.getElementById("reviewTodayBody");
if (!host) return;
host.innerHTML = "";
setText("reviewTodayMeta", reviewQueue.length
? `Review 1 / ${reviewQueue.length} - ${reviewSource}`
: `0 words due today - ${reviewSource}`);

if (reviewApiError) {
host.appendChild(stateLine(reviewApiError, "warn"));
}

if (!reviewQueue.length) {
let empty = document.createElement("p");
empty.className = "emptyStudio";
empty.textContent = reviewSource === "Cloud"
? "No review words today. Cloud queue is clear. Come back tomorrow or practice weak words."
: "No review words today. Add words with review dates or practice weak words.";
host.appendChild(empty);
return;
}

reviewQueue.forEach((rawItem, index) => {
let item = enrichReviewItem(rawItem);
let itemKey = reviewItemKey(item, index);
let revealed = revealedReviewItems.has(itemKey);
let submitting = reviewSubmittingItems.has(itemKey);
let row = document.createElement("article");
row.className = "reviewQueueItem" + (revealed ? " is-revealed" : "");

let main = document.createElement("div");
main.className = "reviewWordMain";
let progress = document.createElement("span");
progress.className = "reviewProgress";
progress.textContent = `Review ${index + 1} / ${reviewQueue.length}`;
let title = document.createElement("strong");
title.textContent = item.eng || "Unknown word";
let meta = document.createElement("span");
meta.className = "reviewQueueMeta";
meta.textContent = `${item.tag || "untagged"} - ${item.level || "unknown"} - streak ${item.streak || 0} - ${item.reason || "Due today"}`;
main.append(progress, title, meta);

let details = document.createElement("div");
details.className = "reviewAnswerDetails";
if (!revealed) {
let hidden = document.createElement("p");
hidden.textContent = "Reveal the answer when you are ready.";
details.appendChild(hidden);
} else {
let meaning = document.createElement("p");
meaning.innerHTML = `<strong>Vietnamese:</strong> ${escapeHtml(item.vie || "No meaning available.")}`;
details.appendChild(meaning);
if (item.pos) details.appendChild(detailLine("POS", item.pos));
if (item.example) details.appendChild(detailLine("Example", item.example));
if (item.note) details.appendChild(detailLine("Note", item.note));
}
main.appendChild(details);

let actions = document.createElement("div");
actions.className = "reviewActions";
let priorityNode = document.createElement("span");
priorityNode.className = "reviewPriority";
priorityNode.textContent = `${item.priority || 0}`;

let revealBtn = document.createElement("button");
revealBtn.className = "utilityBtn";
revealBtn.type = "button";
revealBtn.textContent = revealed ? "Answer Shown" : "Reveal Answer";
revealBtn.disabled = revealed || submitting;
revealBtn.addEventListener("click", () => {
revealedReviewItems.add(itemKey);
renderQueue();
});

let wrongBtn = document.createElement("button");
wrongBtn.className = "miniBtn";
wrongBtn.type = "button";
wrongBtn.textContent = submitting ? "Saving..." : "Again";
wrongBtn.disabled = !revealed || submitting;
wrongBtn.addEventListener("click", () => answerItem(item, false, "again"));

let goodBtn = document.createElement("button");
goodBtn.className = "utilityBtn";
goodBtn.type = "button";
goodBtn.textContent = submitting ? "Saving..." : "Good";
goodBtn.disabled = !revealed || submitting;
goodBtn.addEventListener("click", () => answerItem(item, true, "good"));

let easyBtn = document.createElement("button");
easyBtn.className = "miniBtn";
easyBtn.type = "button";
easyBtn.textContent = submitting ? "Saving..." : "Easy";
easyBtn.disabled = !revealed || submitting;
easyBtn.addEventListener("click", () => answerItem(item, true, "easy"));

actions.append(priorityNode, revealBtn, wrongBtn, goodBtn, easyBtn);
row.append(main, actions);
host.appendChild(row);
});
}

function detailLine(label, value) {
let line = document.createElement("p");
line.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`;
return line;
}

function escapeHtml(value) {
return String(value || "")
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#39;");
}

async function answerItem(item, correct, rating = "") {
let itemKey = reviewItemKey(item);
if (reviewSubmittingItems.has(itemKey)) return;

reviewApiError = "";
reviewSubmittingItems.add(itemKey);
renderQueue();
let response = null;
try {
response = reviewSource === "Cloud" ? await postAnswer(item, correct) : null;
applyLocalAnswer(item, correct, response);
revealedReviewItems.delete(itemKey);
await refresh();
} finally {
reviewSubmittingItems.delete(itemKey);
renderQueue();
renderFeedback(response, correct, reviewApiError, rating);
}
}

async function refresh() {
renderLoading();
reviewApiError = "";
let cloud = await fetchQueue();
let cloudQueue = cloud?.items;
if (cloudQueue) {
reviewSource = "Cloud";
reviewQueue = cloudQueue.map(enrichReviewItem);
} else {
reviewSource = "Local";
reviewApiError = cloud?.error || "";
reviewQueue = localQueue().map(enrichReviewItem);
}
renderQueue();
}

function init() {
document.getElementById("reviewTodayStartBtn")?.addEventListener("click", refresh);
refresh();
}

window.reviewToday = { refresh };
init();
})();
