(function () {
const REVIEW_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";

let reviewQueue = [];
let reviewSource = "Local";

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

async function fetchQueue() {
try {
let response = await fetch(`${REVIEW_API_ORIGIN}/api/review/queue?limit=8`, {
credentials: "include"
});
if (!response.ok) return null;
let payload = await response.json();
return Array.isArray(payload) ? payload : null;
} catch (error) {
return null;
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
if (!response.ok) return null;
return response.json();
} catch (error) {
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

function renderFeedback(response, correct) {
let host = document.getElementById("reviewTodayBody");
if (!host) return;
let feedback = document.createElement("div");
feedback.className = "reviewFeedback";
let title = document.createElement("strong");
title.textContent = correct ? "Correct" : "Needs another pass";
let detail = document.createElement("span");
detail.textContent = response?.message || (correct ? "Good job. Review again later." : "Review this word again tomorrow.");
feedback.append(title, detail);
host.prepend(feedback);
setTimeout(() => feedback.remove(), 3200);
}

function renderQueue() {
let host = document.getElementById("reviewTodayBody");
if (!host) return;
host.innerHTML = "";
setText("reviewTodayMeta", `${reviewQueue.length} words due today - ${reviewSource}`);

if (!reviewQueue.length) {
let empty = document.createElement("p");
empty.className = "emptyStudio";
empty.textContent = "Due words will appear here when their next review time arrives.";
host.appendChild(empty);
return;
}

reviewQueue.forEach(item => {
let row = document.createElement("article");
row.className = "reviewQueueItem";

let main = document.createElement("div");
let title = document.createElement("strong");
title.textContent = `${item.eng} / ${item.vie}`;
let meta = document.createElement("span");
meta.className = "reviewQueueMeta";
meta.textContent = `${item.tag || "untagged"} - ${item.level || "unknown"} - streak ${item.streak || 0} - ${item.reason || "Due today"}`;
main.append(title, meta);

let actions = document.createElement("div");
actions.className = "reviewActions";
let priorityNode = document.createElement("span");
priorityNode.className = "reviewPriority";
priorityNode.textContent = `${item.priority || 0}`;

let wrongBtn = document.createElement("button");
wrongBtn.className = "miniBtn";
wrongBtn.type = "button";
wrongBtn.textContent = "Again";
wrongBtn.addEventListener("click", () => answerItem(item, false));

let correctBtn = document.createElement("button");
correctBtn.className = "utilityBtn";
correctBtn.type = "button";
correctBtn.textContent = "Got It";
correctBtn.addEventListener("click", () => answerItem(item, true));

actions.append(priorityNode, wrongBtn, correctBtn);
row.append(main, actions);
host.appendChild(row);
});
}

async function answerItem(item, correct) {
let response = reviewSource === "Cloud" ? await postAnswer(item, correct) : null;
applyLocalAnswer(item, correct, response);
renderFeedback(response, correct);
await refresh();
}

async function refresh() {
let cloudQueue = await fetchQueue();
if (cloudQueue) {
reviewSource = "Cloud";
reviewQueue = cloudQueue;
} else {
reviewSource = "Local";
reviewQueue = localQueue();
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
