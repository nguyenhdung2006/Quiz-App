(function () {
const ANALYTICS_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";
const API_FETCH = window.quizApiFetch || fetch.bind(window);

let latestAnalytics = null;
let cloudAnalyticsError = "";

function getWords() {
return typeof vocab !== "undefined" && Array.isArray(vocab) ? vocab : [];
}

function getHistory() {
try {
let raw = localStorage.getItem(accountStorageKey("quizHistory"));
let parsed = raw ? JSON.parse(raw) : [];
return Array.isArray(parsed) ? parsed : [];
} catch (error) {
return [];
}
}

function stats(word) {
return word?.stats || {};
}

function reviewCount(word) {
let data = stats(word);
return Math.max(Number(data.seen || 0), Number(data.correct || 0) + Number(data.wrong || 0));
}

function correctCount(word) {
return Number(stats(word).correct || 0);
}

function wrongCount(word) {
return Number(stats(word).wrong || 0);
}

function accuracy(correct, total) {
return total > 0 ? Math.round(correct / total * 100) : 0;
}

function wordAccuracy(word) {
return accuracy(correctCount(word), reviewCount(word));
}

function isMastered(word) {
return Boolean(word?.mastered) || Number(stats(word).masteryLevel || 0) >= 5 || Number(stats(word).streak || 0) >= 5;
}

function isStruggling(word) {
return reviewCount(word) >= 3 && wrongCount(word) >= 2 && wordAccuracy(word) < 60;
}

function isDue(word) {
let raw = stats(word).nextReview;
if (!raw) return false;
let due = new Date(raw).getTime();
return !Number.isNaN(due) && due <= Date.now();
}

function isOverdue(word) {
let raw = stats(word).nextReview;
if (!raw) return false;
let due = new Date(raw);
if (Number.isNaN(due.getTime())) return false;
let today = new Date();
let startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
return due < startToday;
}

function buildLocalOverview() {
let words = getWords();
let totalReviews = words.reduce((sum, word) => sum + reviewCount(word), 0);
let totalCorrect = words.reduce((sum, word) => sum + correctCount(word), 0);
let mastered = words.filter(isMastered).length;
let struggling = words.filter(isStruggling).length;
let history = getHistory();
let cutoff = Date.now() - 7 * 86400000;
let weeklyXp = history
.filter(item => new Date(item.createdAt).getTime() >= cutoff)
.reduce((sum, item) => sum + Math.max(0,
Number(item.correctAnswers || 0) * 12 +
Number(item.totalQuestions || 0) * 3 +
Number(item.maxCombo || 0)
), 0);

return {
totalWords: words.length,
masteredWords: mastered,
learningWords: words.filter(word => !isMastered(word) && !isStruggling(word)).length,
strugglingWords: struggling,
dueToday: words.filter(isDue).length,
averageAccuracy: accuracy(totalCorrect, totalReviews),
totalQuizSessions: history.length,
currentStreak: Math.max(0, ...words.map(word => Number(stats(word).streak || 0))),
xp: words.length * 25 + totalCorrect * 12 + mastered * 50,
weeklyXp,
insights: buildLocalInsights(words, history)
};
}

function buildLocalTrend() {
let grouped = new Map();
getHistory().forEach(item => {
let key = String(item.createdAt || "").slice(0, 10);
if (!key) return;
let bucket = grouped.get(key) || { date: key, correct: 0, total: 0, quizCount: 0 };
bucket.correct += Number(item.correctAnswers || 0);
bucket.total += Number(item.totalQuestions || 0);
bucket.quizCount += 1;
grouped.set(key, bucket);
});
return [...grouped.values()]
.sort((a, b) => a.date.localeCompare(b.date))
.map(item => ({
date: item.date,
accuracy: accuracy(item.correct, item.total),
quizCount: item.quizCount
}));
}

function buildLocalWeakWords() {
return getWords()
.filter(word => reviewCount(word) > 0)
.filter(word => wordAccuracy(word) < 70 || wrongCount(word) >= 3)
.sort((a, b) => ((wrongCount(b) * 3) + reviewCount(b) * ((100 - wordAccuracy(b)) / 100)) -
((wrongCount(a) * 3) + reviewCount(a) * ((100 - wordAccuracy(a)) / 100)))
.slice(0, 10)
.map(word => ({
word: word.eng,
accuracy: wordAccuracy(word),
wrongCount: wrongCount(word),
reviewCount: reviewCount(word),
tag: word.tag || "untagged",
level: word.level || "unknown"
}));
}

function buildLocalPressure() {
let words = getWords();
return {
dueToday: words.filter(isDue).length,
overdue: words.filter(isOverdue).length,
mastered: words.filter(isMastered).length,
learning: words.filter(word => !isMastered(word) && !isStruggling(word)).length,
struggling: words.filter(isStruggling).length
};
}

function buildLocalPerformance() {
return {
tags: groupWords(word => word.tag || "untagged"),
levels: groupWords(word => word.level || "unknown"),
quizModes: groupHistory()
};
}

function groupWords(classifier) {
let map = new Map();
getWords().forEach(word => {
let name = classifier(word);
let bucket = map.get(name) || { name, correct: 0, reviewCount: 0, itemCount: 0 };
bucket.correct += correctCount(word);
bucket.reviewCount += reviewCount(word);
bucket.itemCount += 1;
map.set(name, bucket);
});
return [...map.values()]
.map(item => ({ ...item, accuracy: accuracy(item.correct, item.reviewCount) }))
.sort((a, b) => b.reviewCount - a.reviewCount);
}

function groupHistory() {
let map = new Map();
getHistory().forEach(item => {
let name = item.quizMode || "quiz";
let bucket = map.get(name) || { name, correct: 0, reviewCount: 0, itemCount: 0 };
bucket.correct += Number(item.correctAnswers || 0);
bucket.reviewCount += Number(item.totalQuestions || 0);
bucket.itemCount += 1;
map.set(name, bucket);
});
return [...map.values()]
.map(item => ({ ...item, accuracy: accuracy(item.correct, item.reviewCount) }))
.sort((a, b) => b.reviewCount - a.reviewCount);
}

function buildLocalInsights(words, history) {
let insights = [];
let performance = buildLocalPerformance();
let weakTag = performance.tags.find(item => item.reviewCount >= 3 && item.accuracy < 60);
let weakMode = performance.quizModes.find(item => item.reviewCount >= 3 && item.accuracy < 65);
let overdue = words.filter(isOverdue).length;
if (weakTag) insights.push({ type: "weak-tag", message: `You are struggling with ${weakTag.name} vocabulary.` });
if (weakMode) insights.push({ type: "weak-mode", message: `Your ${weakMode.name} accuracy is significantly lower.` });
if (overdue > 0) insights.push({ type: "overdue-review", message: `You have ${overdue} overdue review words.` });
if (!insights.length) {
insights.push({
type: "steady-progress",
message: words.length ? "Your learning data looks steady. Review due words to keep momentum." : "Add a few words to unlock learning analytics."
});
}
return insights.slice(0, 4);
}

async function fetchJson(path) {
try {
let response = await API_FETCH(`${ANALYTICS_API_ORIGIN}${path}`);
if (!response.ok) {
cloudAnalyticsError = `Cloud analytics request failed (${response.status}). Showing local data.`;
return null;
}
return response.json();
} catch (error) {
cloudAnalyticsError = "Cloud analytics is unavailable. Showing local data.";
return null;
}
}

async function loadCloudAnalytics() {
cloudAnalyticsError = "";
let [overview, trend, weakWords, pressure, performance] = await Promise.all([
fetchJson("/api/analytics/overview"),
fetchJson("/api/analytics/accuracy-trend"),
fetchJson("/api/analytics/weak-words"),
fetchJson("/api/analytics/review-pressure"),
fetchJson("/api/analytics/tag-performance")
]);

if (!overview || !trend || !weakWords || !pressure || !performance) return null;
return { overview, trend, weakWords, pressure, performance, source: "Cloud" };
}

function localAnalytics() {
return {
overview: buildLocalOverview(),
trend: buildLocalTrend(),
weakWords: buildLocalWeakWords(),
pressure: buildLocalPressure(),
performance: buildLocalPerformance(),
source: "Local"
};
}

function ensureAnalyticsStatus() {
let dashboard = document.getElementById("analyticsDashboard");
if (!dashboard) return null;
let status = document.getElementById("analyticsStatus");
if (!status) {
status = document.createElement("p");
status.id = "analyticsStatus";
status.className = "apiStateMessage";
let header = dashboard.querySelector(".sectionHeader--analytics");
if (header) header.appendChild(status);
else dashboard.prepend(status);
}
return status;
}

function setAnalyticsStatus(message, kind = "info") {
let status = ensureAnalyticsStatus();
if (!status) return;
status.textContent = message || "";
status.className = `apiStateMessage apiStateMessage--${kind}`;
status.hidden = !message;
}

function setText(id, value) {
let node = document.getElementById(id);
if (node) node.textContent = String(value);
}

function render(data) {
latestAnalytics = data;
let overview = data.overview;
setText("analyticsTotalWords", overview.totalWords);
setText("analyticsMasteredWords", overview.masteredWords);
setText("analyticsLearningWords", overview.learningWords);
setText("analyticsStrugglingWords", overview.strugglingWords);
setText("analyticsDueToday", overview.dueToday);
setText("analyticsAverageAccuracy", `${overview.averageAccuracy}%`);
setText("analyticsQuizSessions", overview.totalQuizSessions);
setText("analyticsCurrentStreak", overview.currentStreak);
setText("analyticsXp", overview.xp);
setText("analyticsWeeklyXp", overview.weeklyXp);
setText("analyticsSource", data.source);

drawTrend(data.trend || []);
renderPressure(data.pressure || {});
renderWeakWords(data.weakWords || []);
renderInsights(overview.insights || []);
renderPerformance(data.performance || {});
}

function drawTrend(trend) {
let canvas = document.getElementById("accuracyTrendChart");
if (!canvas) return;
let ctx = canvas.getContext("2d");
let rect = canvas.getBoundingClientRect();
let ratio = window.devicePixelRatio || 1;
canvas.width = Math.max(1, Math.floor(rect.width * ratio));
canvas.height = Math.max(1, Math.floor(rect.height * ratio));
ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

let width = rect.width;
let height = rect.height;
ctx.clearRect(0, 0, width, height);
ctx.fillStyle = "rgba(3, 10, 28, 0.42)";
ctx.fillRect(0, 0, width, height);
ctx.strokeStyle = "rgba(158, 241, 255, 0.16)";
ctx.lineWidth = 1;
for (let i = 1; i <= 4; i++) {
let y = height - 28 - (height - 56) * i / 4;
ctx.beginPath();
ctx.moveTo(34, y);
ctx.lineTo(width - 18, y);
ctx.stroke();
}

if (!trend.length) {
ctx.fillStyle = "rgba(224, 240, 255, 0.74)";
ctx.font = "700 15px Segoe UI, Arial";
ctx.fillText("Take a quiz to unlock your accuracy trend.", 34, height / 2);
return;
}

let points = trend.map((item, index) => {
let x = trend.length === 1 ? width / 2 : 34 + (width - 64) * index / (trend.length - 1);
let y = height - 28 - (height - 56) * Math.max(0, Math.min(100, Number(item.accuracy || 0))) / 100;
return { x, y, item };
});

ctx.strokeStyle = "#18e9ff";
ctx.lineWidth = 3;
ctx.beginPath();
points.forEach((point, index) => {
if (index === 0) ctx.moveTo(point.x, point.y);
else ctx.lineTo(point.x, point.y);
});
ctx.stroke();

points.forEach(point => {
ctx.fillStyle = "#ffe36e";
ctx.beginPath();
ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
ctx.fill();
});

ctx.fillStyle = "rgba(224, 240, 255, 0.82)";
ctx.font = "700 12px Segoe UI, Arial";
points.slice(-4).forEach(point => {
ctx.fillText(`${point.item.accuracy}%`, point.x - 10, Math.max(14, point.y - 10));
});
}

function renderPressure(pressure) {
let host = document.getElementById("reviewPressureBars");
if (!host) return;
host.innerHTML = "";
let items = [
["Due Today", pressure.dueToday || 0],
["Overdue", pressure.overdue || 0],
["Mastered", pressure.mastered || 0],
["Learning", pressure.learning || 0],
["Struggling", pressure.struggling || 0]
];
let max = Math.max(1, ...items.map(item => Number(item[1])));
items.forEach(([label, value]) => {
let row = document.createElement("div");
row.className = "pressureItem";
let top = document.createElement("div");
top.className = "pressureTop";
let name = document.createElement("span");
name.className = "pressureLabel";
name.textContent = label;
let count = document.createElement("strong");
count.textContent = value;
top.append(name, count);
let track = document.createElement("div");
track.className = "pressureTrack";
let fill = document.createElement("span");
fill.style.width = `${Math.round(Number(value) / max * 100)}%`;
track.appendChild(fill);
row.append(top, track);
host.appendChild(row);
});
}

function renderWeakWords(words) {
let host = document.getElementById("weakWordsList");
if (!host) return;
host.innerHTML = "";
if (!words.length) {
host.appendChild(emptyLine("No weak words yet. Missed or low-mastery words will appear here after quizzes."));
return;
}
words.slice(0, 8).forEach(item => {
let row = document.createElement("div");
row.className = "weakWordRow";
let main = document.createElement("div");
let word = document.createElement("strong");
word.textContent = item.word || "Unknown";
let meta = document.createElement("span");
meta.className = "weakWordMeta";
meta.textContent = `${item.tag || "untagged"} / ${item.level || "unknown"} / ${item.reviewCount || 0} reviews`;
main.append(word, meta);
let statsNode = document.createElement("span");
statsNode.className = "weakWordStats";
statsNode.textContent = `${item.accuracy || 0}% / ${item.wrongCount || 0} wrong`;
row.append(main, statsNode);
host.appendChild(row);
});
}

function renderInsights(insights) {
let host = document.getElementById("insightGrid");
if (!host) return;
host.innerHTML = "";
insights.forEach(item => {
let card = document.createElement("article");
card.className = "insightCard";
let type = document.createElement("span");
type.textContent = item.type || "insight";
let message = document.createElement("strong");
message.textContent = item.message || "";
card.append(type, message);
host.appendChild(card);
});
}

function renderPerformance(performance) {
let host = document.getElementById("tagPerformanceGrid");
if (!host) return;
host.innerHTML = "";
[
["Tags", performance.tags || []],
["Levels", performance.levels || []],
["Quiz Modes", performance.quizModes || []]
].forEach(([title, rows]) => {
let group = document.createElement("div");
group.className = "performanceGroup";
let heading = document.createElement("h4");
heading.textContent = title;
group.appendChild(heading);
if (!rows.length) group.appendChild(emptyLine("Complete a quiz to unlock this breakdown."));
rows.slice(0, 5).forEach(row => {
let item = document.createElement("div");
item.className = "performanceRow";
let main = document.createElement("div");
let name = document.createElement("strong");
name.textContent = row.name || "Unknown";
let meta = document.createElement("span");
meta.className = "performanceMeta";
meta.textContent = `${row.itemCount || 0} items / ${row.reviewCount || 0} reviews`;
main.append(name, meta);
let score = document.createElement("span");
score.className = "performanceScore";
score.textContent = `${row.accuracy || 0}%`;
item.append(main, score);
group.appendChild(item);
});
host.appendChild(group);
});
}

function emptyLine(text) {
let node = document.createElement("p");
node.className = "emptyStudio";
node.textContent = text;
return node;
}

async function refresh() {
render(localAnalytics());
setAnalyticsStatus("Loading cloud analytics...", "loading");
let cloud = await loadCloudAnalytics();
if (cloud) {
render(cloud);
setAnalyticsStatus("Cloud analytics loaded.", "ok");
} else if (cloudAnalyticsError) {
setAnalyticsStatus(cloudAnalyticsError, "warn");
} else {
setAnalyticsStatus("", "info");
}
}

function init() {
document.getElementById("analyticsBtn")?.addEventListener("click", () => {
document.getElementById("analyticsDashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
refresh();
});
window.addEventListener("resize", () => {
if (latestAnalytics) drawTrend(latestAnalytics.trend || []);
});
refresh();
}

window.analyticsDashboard = { refresh };
init();
})();
