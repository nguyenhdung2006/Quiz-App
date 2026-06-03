(function () {
const TOPIC_DECKS = {
school: [
{ eng: "assignment", vie: "bai tap duoc giao", pos: "n", tag: "school", example: "The assignment is due tomorrow.", note: "School task" },
{ eng: "attendance", vie: "su co mat", pos: "n", tag: "school", example: "Attendance is important in class.", note: "Being present" },
{ eng: "deadline", vie: "han chot", pos: "n", tag: "school", example: "The deadline is Friday.", note: "Final time" },
{ eng: "explain", vie: "giai thich", pos: "v", tag: "school", example: "Please explain your answer.", note: "Make clear" },
{ eng: "subject", vie: "mon hoc", pos: "n", tag: "school", example: "Math is my favorite subject.", note: "Class topic" },
{ eng: "submit", vie: "nop bai", pos: "v", tag: "school", example: "Submit your homework online.", note: "Hand in" }
],
ielts: [
{ eng: "significant", vie: "dang ke", pos: "adj", tag: "IELTS", example: "There was a significant increase.", note: "Writing Task 1" },
{ eng: "consequence", vie: "hau qua", pos: "n", tag: "IELTS", example: "Pollution has serious consequences.", note: "Cause-effect" },
{ eng: "argue", vie: "lap luan", pos: "v", tag: "IELTS", example: "Some people argue that technology helps education.", note: "Essay verb" },
{ eng: "beneficial", vie: "co loi", pos: "adj", tag: "IELTS", example: "Exercise is beneficial for health.", note: "Positive effect" },
{ eng: "whereas", vie: "trong khi do", pos: "adv", tag: "IELTS", example: "Cities are crowded, whereas villages are quiet.", note: "Contrast" },
{ eng: "evidence", vie: "bang chung", pos: "n", tag: "IELTS", example: "The evidence supports this view.", note: "Support idea" }
],
travel: [
{ eng: "reservation", vie: "dat cho", pos: "n", tag: "travel", example: "I made a hotel reservation.", note: "Booking" },
{ eng: "departure", vie: "khoi hanh", pos: "n", tag: "travel", example: "Departure time is 8 a.m.", note: "Leaving time" },
{ eng: "destination", vie: "diem den", pos: "n", tag: "travel", example: "Da Nang is our destination.", note: "Place to go" },
{ eng: "luggage", vie: "hanh ly", pos: "n", tag: "travel", example: "My luggage is heavy.", note: "Bags" },
{ eng: "itinerary", vie: "lich trinh", pos: "n", tag: "travel", example: "The itinerary includes two museums.", note: "Travel plan" },
{ eng: "souvenir", vie: "qua luu niem", pos: "n", tag: "travel", example: "I bought a souvenir.", note: "Gift from trip" }
],
it: [
{ eng: "algorithm", vie: "thuat toan", pos: "n", tag: "IT", example: "This algorithm sorts numbers.", note: "Problem-solving steps" },
{ eng: "database", vie: "co so du lieu", pos: "n", tag: "IT", example: "The database stores users.", note: "Data storage" },
{ eng: "deploy", vie: "trien khai", pos: "v", tag: "IT", example: "Deploy the app after testing.", note: "Release software" },
{ eng: "debug", vie: "go loi", pos: "v", tag: "IT", example: "Debug the code carefully.", note: "Find and fix bugs" },
{ eng: "interface", vie: "giao dien", pos: "n", tag: "IT", example: "The interface is easy to use.", note: "UI/API surface" },
{ eng: "repository", vie: "kho ma nguon", pos: "n", tag: "IT", example: "Push the commit to the repository.", note: "Git project" }
]
};

const BADGES = [
{ code: "FIRST_WORD", name: "First Word", description: "Add your first word.", test: () => getWords().length > 0 },
{ code: "FIRST_QUIZ", name: "First Quiz", description: "Finish one quiz round.", test: () => getHistory().length > 0 },
{ code: "PERFECT_ROUND", name: "Perfect Round", description: "Score a clean round.", test: () => getHistory().some(h => h.totalQuestions > 0 && h.correctAnswers === h.totalQuestions) },
{ code: "COMBO_10", name: "Combo 10", description: "Reach a 10-answer combo.", test: () => getHistory().some(h => Number(h.maxCombo || 0) >= 10) },
{ code: "DAILY_CHALLENGE", name: "Daily Challenger", description: "Complete a daily challenge.", test: () => getHistory().some(h => h.quizMode === "daily") },
{ code: "FOCUS_START", name: "Calm Focus", description: "Start a 5-minute focus session.", test: () => localStorage.getItem(accountStorageKey("focusStarted")) === "true" },
{ code: "DECK_IMPORT", name: "Deck Builder", description: "Import a topic deck or CSV.", test: () => localStorage.getItem(accountStorageKey("deckImported")) === "true" }
];

function readJson(key, fallback) {
try {
let raw = localStorage.getItem(key);
return raw ? JSON.parse(raw) : fallback;
} catch (error) {
return fallback;
}
}

function getWords() {
return Array.isArray(window.vocab) ? window.vocab : vocab;
}

function getWrong() {
return Array.isArray(window.wrongWords) ? window.wrongWords : wrongWords;
}

function getHistory() {
return readJson(accountStorageKey("quizHistory"), []);
}

function getProfile() {
let accountProfile = typeof getAccountProfile === "function" ? getAccountProfile() : {};
let cached = typeof getCachedProfile === "function" ? getCachedProfile() : {};
return {
...cached,
...accountProfile,
name: accountProfile.name || cached.name || "Vocabulary Runner",
email: accountProfile.email || cached.email || "",
avatar: accountProfile.avatar || cached.avatar || "images/icon.png",
goal: accountProfile.goal || cached.goal || "",
bio: accountProfile.bio || cached.bio || ""
};
}

function setText(id, value) {
let node = document.getElementById(id);
if (node) node.textContent = value;
}

function toastStudio(message, kind = "ok") {
let host = document.querySelector(".toastHost") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "toastHost" }));
let el = document.createElement("div");
el.className = `toast toast--${kind}`;
el.textContent = message;
host.appendChild(el);
setTimeout(() => {
el.style.opacity = "0";
el.style.transform = "translateY(6px)";
setTimeout(() => el.remove(), 220);
}, 2400);
}

function masteryPercent() {
let words = getWords();
if (!words.length) return 0;
let mastered = words.filter(word => word.mastered || Number(word?.stats?.streak || 0) >= 5).length;
return Math.round(mastered / words.length * 100);
}

function dueWords() {
let now = Date.now();
return getWords().filter(word => {
let nextReview = word?.stats?.nextReview;
if (!nextReview) return Number(word?.stats?.seen || 0) > 0 && !word.mastered;
let due = new Date(nextReview).getTime();
return !Number.isNaN(due) && due <= now;
});
}

function weekCorrect() {
let cutoff = Date.now() - 7 * 86400000;
return getHistory()
.filter(item => new Date(item.createdAt).getTime() >= cutoff)
.reduce((sum, item) => sum + Number(item.correctAnswers || 0), 0);
}

function openStudio(tab = "profile") {
let overlay = document.getElementById("learningStudio");
if (!overlay) return;
renderStudio();
switchStudioTab(tab);
overlay.classList.remove("hidden");
document.body.classList.add("modalOpen");
}

function closeStudio() {
let overlay = document.getElementById("learningStudio");
if (!overlay) return;
overlay.classList.add("hidden");
document.body.classList.remove("modalOpen");
}

function switchStudioTab(tab) {
document.querySelectorAll(".studioTab").forEach(button => {
button.classList.toggle("is-active", button.dataset.studioTab === tab);
});
document.querySelectorAll(".studioView").forEach(view => {
view.classList.toggle("is-active", view.id === `studioView${tab[0].toUpperCase()}${tab.slice(1)}`);
});
}

function renderStudio() {
renderProfileStudio();
renderHistoryStudio();
renderBadges();
renderFocus();
renderDecks();
}

function renderProfileStudio() {
let profile = getProfile();
let avatar = document.getElementById("studioProfileAvatar");
if (avatar) avatar.src = profile.avatar || "images/icon.png";
setText("studioProfileName", profile.name);
setText("studioProfileGoal", profile.goal || profile.bio || "No learning goal yet.");
setText("studioProfileIdentity", profile.email ? `Signed in as ${profile.email}` : "Local guest profile");
setText("studioTodayPlan", `${dueWords().length} due`);
setText("studioWeeklyScore", String(weekCorrect()));
setText("studioMastery", `${masteryPercent()}%`);
renderCalendar();
}

function renderCalendar() {
let host = document.getElementById("streakCalendar");
if (!host) return;
let history = getHistory();
let days = new Set(history.map(item => String(item.createdAt || "").slice(0, 10)));
host.innerHTML = "";
for (let i = 13; i >= 0; i--) {
let date = new Date();
date.setDate(date.getDate() - i);
let key = date.toISOString().slice(0, 10);
let cell = document.createElement("span");
cell.className = "calendarDay" + (days.has(key) ? " is-active" : "");
cell.title = key;
cell.textContent = String(date.getDate());
host.appendChild(cell);
}
}

function renderHistoryStudio() {
let list = document.getElementById("historyList");
if (!list) return;
let history = getHistory().slice().reverse();
let total = history.length;
let average = total ? (history.reduce((sum, item) => sum + Number(item.score || 0), 0) / total).toFixed(1) : "0.0";
setText("historySummary", total ? `${total} rounds, ${average}/10 average` : "No rounds yet");
list.innerHTML = "";
if (!history.length) {
let empty = document.createElement("p");
empty.className = "emptyStudio";
empty.textContent = "Finish a quiz or focus session and it will appear here.";
list.appendChild(empty);
return;
}
history.slice(0, 20).forEach(item => {
let row = document.createElement("article");
row.className = "historyItem";
let date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Unknown date";
row.innerHTML = `<strong>${item.score || 0}/10</strong><span>${item.correctAnswers || 0}/${item.totalQuestions || 0} correct</span><em>${item.quizMode || "quiz"} - ${date}</em>`;
list.appendChild(row);
});
}

function renderBadges() {
let gallery = document.getElementById("badgeGallery");
if (!gallery) return;
gallery.innerHTML = "";
BADGES.forEach(badge => {
let unlocked = Boolean(badge.test());
let card = document.createElement("article");
card.className = "badgeCard" + (unlocked ? " is-unlocked" : "");
card.innerHTML = `<span>${unlocked ? "Unlocked" : "Locked"}</span><h3>${badge.name}</h3><p>${badge.description}</p>`;
gallery.appendChild(card);
});
}

function renderFocus() {
setText("focusDueCount", String(dueWords().length));
setText("focusWrongCount", String(getWrong().filter(word => !word.mastered).length));
let queue = document.getElementById("focusQueue");
if (!queue) return;
let words = focusWords();
queue.innerHTML = "";
if (!words.length) {
let empty = document.createElement("p");
empty.className = "emptyStudio";
empty.textContent = "Add at least 4 words to start a focus session.";
queue.appendChild(empty);
return;
}
words.forEach(word => {
let chip = document.createElement("span");
chip.textContent = `${word.eng} / ${word.vie}`;
queue.appendChild(chip);
});
}

function focusWords() {
let pool = [
...dueWords(),
...getWrong().filter(word => !word.mastered),
...getWords().filter(word => !word.mastered)
];
let unique = [];
let seen = new Set();
pool.forEach(word => {
let clean = normalizeWord(word);
let key = clean.eng.toLowerCase();
if (!key || seen.has(key)) return;
seen.add(key);
unique.push(clean);
});
return unique.slice(0, 10);
}

function startFocus() {
let words = focusWords();
if (words.length < 4) {
toastStudio("Add at least 4 words before focus mode.", "warn");
return;
}
localStorage.setItem(accountStorageKey("focusStarted"), "true");
closeStudio();
startWordSetQuiz(words, "mixed", { challenge: true, time: 30, kind: "focus" });
}

function renderDecks() {
let grid = document.getElementById("topicDeckGrid");
if (!grid) return;
grid.innerHTML = "";
Object.entries(TOPIC_DECKS).forEach(([key, words]) => {
let card = document.createElement("article");
card.className = "topicDeckCard";
card.innerHTML = `<span>${words.length} words</span><h3>${key.toUpperCase()}</h3><p>${words.slice(0, 3).map(w => w.eng).join(", ")}...</p>`;
let button = document.createElement("button");
button.className = "utilityBtn";
button.type = "button";
button.textContent = "Import Deck";
button.addEventListener("click", () => importDeck(key));
card.appendChild(button);
grid.appendChild(card);
});
}

function mergeByEnglishLocal(base, incoming) {
let merged = [...base];
let existing = new Set(base.map(word => String(word.eng || "").toLowerCase()));
incoming.forEach(word => {
let clean = normalizeWord(word);
let key = clean.eng.toLowerCase();
if (!key || !clean.vie || existing.has(key)) return;
existing.add(key);
merged.push(clean);
});
return merged;
}

function enrichTopicWord(word, topic) {
let clean = normalizeWord(word);
let defaultLevel = topic === "ielts" ? "B2" : topic === "it" ? "B1" : "A2";
return normalizeWord({
...clean,
level: clean.level || defaultLevel,
context: clean.context || topic,
collocation: clean.collocation || `${clean.eng} practice`,
commonMistake: clean.commonMistake || "Check the example before using this word in writing.",
note: clean.note || `Topic deck: ${topic}`
});
}

function importDeck(key) {
let words = (TOPIC_DECKS[key] || []).map(word => enrichTopicWord(word, key));
let before = getWords().length;
vocab = mergeByEnglishLocal(getWords(), words);
localStorage.setItem(accountStorageKey("deckImported"), "true");
save();
renderTable();
renderStudio();
window.quizCloud?.syncNow?.();
toastStudio(`Imported ${getWords().length - before} words from ${key.toUpperCase()}.`);
}

function parseCsv(text) {
let lines = text.replace(/\r/g, "").split("\n").filter(line => line.trim());
if (!lines.length) return [];
let headers = splitCsvLine(lines.shift()).map(value => value.trim().toLowerCase());
return lines.map(line => {
let values = splitCsvLine(line);
let row = {};
headers.forEach((header, index) => row[header] = values[index] || "");
return normalizeWord({
eng: row.eng || row.english,
vie: row.vie || row.vietnamese,
pos: row.pos || "n",
tag: row.tag || "csv",
ipa: row.ipa || row.pronunciation,
level: row.level || row.cefr || "A1",
context: row.context || row.sense || row.topic,
example: row.example,
exampleMeaning: row.examplemeaning || row.example_meaning || row.examplevi || row.example_vi,
collocation: row.collocation || row.collocations,
synonyms: row.synonyms || row.synonym,
antonyms: row.antonyms || row.antonym,
commonMistake: row.commonmistake || row.common_mistake || row.mistake,
note: row.note
});
}).filter(word => word.eng && word.vie);
}

function splitCsvLine(line) {
let values = [];
let current = "";
let quoted = false;
for (let i = 0; i < line.length; i++) {
let char = line[i];
if (char === '"' && line[i + 1] === '"') {
current += '"';
i++;
} else if (char === '"') {
quoted = !quoted;
} else if (char === "," && !quoted) {
values.push(current.trim());
current = "";
} else {
current += char;
}
}
values.push(current.trim());
return values;
}

async function importCsvFile(file) {
let words = parseCsv(await file.text());
if (!words.length) {
setText("csvImportResult", "No valid words found. Check headers: eng,vie,pos,tag,ipa,level,context,example,exampleMeaning,collocation,synonyms,antonyms,commonMistake,note.");
return;
}
let before = getWords().length;
vocab = mergeByEnglishLocal(getWords(), words);
localStorage.setItem(accountStorageKey("deckImported"), "true");
save();
renderTable();
renderStudio();
window.quizCloud?.syncNow?.();
setText("csvImportResult", `Imported ${getWords().length - before} new words from ${words.length} CSV rows.`);
toastStudio("CSV import complete.");
}

function downloadCsvTemplate() {
let headers = "eng,vie,pos,tag,ipa,level,context,example,exampleMeaning,collocation,synonyms,antonyms,commonMistake,note";
let sample = "focus,tap trung,v,study,/FOH-kuhs/,A2,study action,Focus on one thing.,Tap trung vao mot viec.,focus on; stay focused,concentrate,distract,Use focus on not focus in,Daily learning";
let blob = new Blob([`${headers}\n${sample}\n`], { type: "text/csv" });
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = "vocab-template.csv";
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
}

function initStudio() {
document.getElementById("studioBtn")?.addEventListener("click", () => openStudio("profile"));
document.getElementById("studioCloseBtn")?.addEventListener("click", closeStudio);
document.getElementById("studioSyncBtn")?.addEventListener("click", () => {
window.quizCloud?.syncNow?.();
renderStudio();
toastStudio("Studio refreshed.");
});
document.querySelectorAll("[data-studio-tab]").forEach(button => {
button.addEventListener("click", () => openStudio(button.dataset.studioTab));
});
document.querySelectorAll(".studioTab").forEach(button => {
button.addEventListener("click", () => switchStudioTab(button.dataset.studioTab));
});
document.getElementById("startFocusBtn")?.addEventListener("click", startFocus);
document.getElementById("csvPickBtn")?.addEventListener("click", () => document.getElementById("csvImportFile")?.click());
document.getElementById("csvTemplateBtn")?.addEventListener("click", downloadCsvTemplate);
document.getElementById("csvImportFile")?.addEventListener("change", event => {
let file = event.target.files?.[0];
event.target.value = "";
if (file) importCsvFile(file);
});
document.getElementById("learningStudio")?.addEventListener("click", event => {
if (event.target.id === "learningStudio") closeStudio();
});
document.addEventListener("keydown", event => {
if (event.key === "Escape" && !document.getElementById("learningStudio")?.classList.contains("hidden")) closeStudio();
});
}

initStudio();
})();
