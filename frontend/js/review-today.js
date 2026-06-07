(function () {
const REVIEW_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";

let reviewQueue = [];
let reviewSource = "Local";
let reviewApiError = "";
let revealedReviewItems = new Set();
let reviewSubmittingItems = new Set();
let reviewSession = freshSession();

function freshSession() {
return {
active: false,
completed: false,
total: 0,
reviewed: 0,
again: 0,
good: 0,
easy: 0,
source: "Local"
};
}

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

let reviewedAt = new Date().toISOString();
let data = stats(word);
data.seen = Number(data.seen || 0) + 1;
data.lastReviewed = reviewedAt;
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
if (typeof stampWordUpdatedAt === "function") stampWordUpdatedAt(word, reviewedAt);
else word.updatedAt = reviewedAt;
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

function actionButton(label, page, extraClass = "utilityBtn") {
let button = document.createElement("button");
button.className = extraClass;
button.type = "button";
button.textContent = label;
button.addEventListener("click", () => {
if (page === "weak") {
document.getElementById("weakWordsReviewBtn")?.click();
return;
}
if (typeof showAppPage === "function") showAppPage(page);
});
return button;
}

function ratingCopy(rating) {
if (rating === "again") return { label: "Again", hint: "Review sooner" };
if (rating === "easy") return { label: "Easy", hint: "I know this" };
return { label: "Good", hint: "Keep learning" };
}

function makeRatingButton(rating, disabled, submitting, onClick) {
let copy = ratingCopy(rating);
let button = document.createElement("button");
button.className = `reviewRatingBtn reviewRatingBtn--${rating}`;
button.type = "button";
button.disabled = disabled || submitting;
button.setAttribute("aria-label", `${copy.label} - ${copy.hint}`);
let label = document.createElement("strong");
label.textContent = submitting ? "Saving..." : copy.label;
let hint = document.createElement("span");
hint.textContent = copy.hint;
button.append(label, hint);
button.addEventListener("click", onClick);
return button;
}

function ensureSessionStarted() {
if (reviewSession.active) return;
reviewSession = {
...freshSession(),
active: true,
total: reviewQueue.length,
source: reviewSource
};
}

function syncSessionWithQueue() {
if (!reviewQueue.length && !reviewSession.reviewed) {
reviewSession = {
...freshSession(),
source: reviewSource
};
return;
}

if (!reviewSession.active && reviewQueue.length) {
ensureSessionStarted();
}

if (reviewSession.active) {
reviewSession.source = reviewSource;
reviewSession.total = Math.max(reviewSession.total, reviewSession.reviewed + reviewQueue.length);
reviewSession.completed = reviewSession.reviewed > 0 && reviewQueue.length === 0;
}
}

function sessionTotal() {
return Math.max(reviewSession.total, reviewSession.reviewed + reviewQueue.length);
}

function renderSessionOverview() {
let total = sessionTotal();
let reviewed = Math.min(reviewSession.reviewed, total);
let left = Math.max(0, total - reviewed);
let percent = total ? Math.round(reviewed / total * 100) : 0;
let panel = document.createElement("section");
panel.className = "reviewSessionOverview";
panel.setAttribute("aria-label", "Review session progress");

let copy = document.createElement("div");
copy.className = "reviewSessionCopy";
let title = document.createElement("strong");
title.textContent = "Today's Review";
let subtitle = document.createElement("span");
subtitle.textContent = total
? `${total} ${total === 1 ? "word" : "words"} due - ${reviewSession.source}`
: `No words due - ${reviewSource}`;
copy.append(title, subtitle);

let progress = document.createElement("div");
progress.className = "reviewSessionProgress";
let text = document.createElement("span");
text.textContent = total
? `Progress: ${reviewed} / ${total} - ${left} ${left === 1 ? "word" : "words"} left`
: "Progress: 0 / 0 - all caught up";
let track = document.createElement("div");
track.className = "reviewProgressTrack";
track.setAttribute("role", "progressbar");
track.setAttribute("aria-valuemin", "0");
track.setAttribute("aria-valuemax", "100");
track.setAttribute("aria-valuenow", String(percent));
track.setAttribute("aria-label", text.textContent);
let fill = document.createElement("div");
fill.className = "reviewProgressFill";
fill.style.width = percent + "%";
track.appendChild(fill);
progress.append(text, track);

let stats = document.createElement("div");
stats.className = "reviewSessionStats";
stats.append(
sessionStat("Reviewed", reviewed),
sessionStat("Again", reviewSession.again),
sessionStat("Good", reviewSession.good),
sessionStat("Easy", reviewSession.easy)
);

panel.append(copy, progress, stats);
return panel;
}

function sessionStat(label, value) {
let item = document.createElement("span");
item.className = "reviewSessionStat";
let strong = document.createElement("strong");
strong.textContent = String(value);
let small = document.createElement("small");
small.textContent = label;
item.append(strong, small);
return item;
}

function renderEmptyState(host) {
let empty = document.createElement("section");
empty.className = "reviewStateCard reviewStateCard--empty";
let title = document.createElement("h3");
title.textContent = "No review words due today.";
let message = document.createElement("p");
message.textContent = reviewSource === "Cloud"
? "You're all caught up. Come back tomorrow or practice weak words."
: "You're all caught up locally. Add words or practice weak words when you want a light session.";
let actions = document.createElement("div");
actions.className = "reviewStateActions";
actions.append(
actionButton("Practice Weak Words", "weak"),
actionButton("Add New Words", "vocabulary", "miniBtn"),
actionButton("Go to Dashboard", "dashboard", "miniBtn")
);
empty.append(title, message, actions);
host.appendChild(empty);
}

function renderCompletionState(host) {
let total = sessionTotal();
let confidence = reviewSession.reviewed
? Math.round((reviewSession.good + reviewSession.easy) / reviewSession.reviewed * 100)
: 0;
let done = document.createElement("section");
done.className = "reviewStateCard reviewStateCard--complete";
let title = document.createElement("h3");
title.textContent = "Review Complete";
let message = document.createElement("p");
message.textContent = `You reviewed ${reviewSession.reviewed || total} ${reviewSession.reviewed === 1 ? "word" : "words"} today. Keep your streak going tomorrow.`;
let stats = document.createElement("div");
stats.className = "reviewCompletionStats";
stats.append(
sessionStat("Again", reviewSession.again),
sessionStat("Good", reviewSession.good),
sessionStat("Easy", reviewSession.easy),
sessionStat("Confidence", confidence + "%")
);
let actions = document.createElement("div");
actions.className = "reviewStateActions";
actions.append(
actionButton("Back to Dashboard", "dashboard"),
actionButton("Practice Weak Words", "weak", "miniBtn")
);
done.append(title, message, stats, actions);
host.appendChild(done);
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
syncSessionWithQueue();
let total = sessionTotal();
let left = Math.max(0, total - reviewSession.reviewed);
setText("reviewTodayMeta", total
? `${total} ${total === 1 ? "word" : "words"} due - ${left} left`
: `0 words due today - ${reviewSource}`);
host.appendChild(renderSessionOverview());

if (reviewApiError) {
host.appendChild(stateLine(reviewApiError, "warn"));
}

if (!reviewQueue.length) {
if (reviewSession.completed) renderCompletionState(host);
else renderEmptyState(host);
return;
}

reviewQueue.forEach((rawItem, index) => {
let item = enrichReviewItem(rawItem);
let itemKey = reviewItemKey(item, index);
let revealed = revealedReviewItems.has(itemKey);
let submitting = reviewSubmittingItems.has(itemKey);
let row = document.createElement("article");
row.className = "reviewQueueItem" + (revealed ? " is-revealed" : "");
if (index === 0) row.classList.add("is-current");

let main = document.createElement("div");
main.className = "reviewWordMain";
let progress = document.createElement("span");
progress.className = "reviewProgress";
progress.textContent = index === 0 ? "Current card" : `Next ${index + 1}`;
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

let wrongBtn = makeRatingButton("again", !revealed, submitting, () => answerItem(item, false, "again"));
let goodBtn = makeRatingButton("good", !revealed, submitting, () => answerItem(item, true, "good"));
let easyBtn = makeRatingButton("easy", !revealed, submitting, () => answerItem(item, true, "easy"));

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
ensureSessionStarted();
reviewSubmittingItems.add(itemKey);
renderQueue();
let response = null;
try {
response = reviewSource === "Cloud" ? await postAnswer(item, correct) : null;
applyLocalAnswer(item, correct, response);
reviewSession.reviewed += 1;
if (rating === "again") reviewSession.again += 1;
else if (rating === "easy") reviewSession.easy += 1;
else reviewSession.good += 1;
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
document.getElementById("reviewTodayStartBtn")?.addEventListener("click", () => {
reviewSession = freshSession();
revealedReviewItems.clear();
reviewSubmittingItems.clear();
refresh();
});
refresh();
}

window.reviewToday = { refresh };
init();
})();
