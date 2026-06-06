(function () {
const TOPIC_DECKS = {
school: [
{ eng: "assignment", vie: "bài tập được giao", pos: "n", tag: "school", example: "The assignment is due tomorrow.", note: "School task" },
{ eng: "attendance", vie: "sự có mặt", pos: "n", tag: "school", example: "Attendance is important in class.", note: "Being present" },
{ eng: "deadline", vie: "hạn chót", pos: "n", tag: "school", example: "The deadline is Friday.", note: "Final time" },
{ eng: "explain", vie: "giải thích", pos: "v", tag: "school", example: "Please explain your answer.", note: "Make clear" },
{ eng: "subject", vie: "môn học", pos: "n", tag: "school", example: "Math is my favorite subject.", note: "Class topic" },
{ eng: "submit", vie: "nộp bài", pos: "v", tag: "school", example: "Submit your homework online.", note: "Hand in" }
],
ielts: [
{ eng: "significant", vie: "đáng kể", pos: "adj", tag: "IELTS", example: "There was a significant increase.", note: "Writing Task 1" },
{ eng: "consequence", vie: "hậu quả", pos: "n", tag: "IELTS", example: "Pollution has serious consequences.", note: "Cause-effect" },
{ eng: "argue", vie: "lập luận", pos: "v", tag: "IELTS", example: "Some people argue that technology helps education.", note: "Essay verb" },
{ eng: "beneficial", vie: "có lợi", pos: "adj", tag: "IELTS", example: "Exercise is beneficial for health.", note: "Positive effect" },
{ eng: "whereas", vie: "trong khi đó", pos: "adv", tag: "IELTS", example: "Cities are crowded, whereas villages are quiet.", note: "Contrast" },
{ eng: "evidence", vie: "bằng chứng", pos: "n", tag: "IELTS", example: "The evidence supports this view.", note: "Support idea" }
],
travel: [
{ eng: "reservation", vie: "đặt chỗ", pos: "n", tag: "travel", example: "I made a hotel reservation.", note: "Booking" },
{ eng: "departure", vie: "khởi hành", pos: "n", tag: "travel", example: "Departure time is 8 a.m.", note: "Leaving time" },
{ eng: "destination", vie: "điểm đến", pos: "n", tag: "travel", example: "Da Nang is our destination.", note: "Place to go" },
{ eng: "luggage", vie: "hành lý", pos: "n", tag: "travel", example: "My luggage is heavy.", note: "Bags" },
{ eng: "itinerary", vie: "lịch trình", pos: "n", tag: "travel", example: "The itinerary includes two museums.", note: "Travel plan" },
{ eng: "souvenir", vie: "quà lưu niệm", pos: "n", tag: "travel", example: "I bought a souvenir.", note: "Gift from trip" }
],
it: [
{ eng: "algorithm", vie: "thuật toán", pos: "n", tag: "IT", example: "This algorithm sorts numbers.", note: "Problem-solving steps" },
{ eng: "database", vie: "cơ sở dữ liệu", pos: "n", tag: "IT", example: "The database stores users.", note: "Data storage" },
{ eng: "deploy", vie: "triển khai", pos: "v", tag: "IT", example: "Deploy the app after testing.", note: "Release software" },
{ eng: "debug", vie: "gỡ lỗi", pos: "v", tag: "IT", example: "Debug the code carefully.", note: "Find and fix bugs" },
{ eng: "interface", vie: "giao diện", pos: "n", tag: "IT", example: "The interface is easy to use.", note: "UI/API surface" },
{ eng: "repository", vie: "kho mã nguồn", pos: "n", tag: "IT", example: "Push the commit to the repository.", note: "Git project" }
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

let generatedAiDeckWords = [];
const AI_DECK_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";
const AI_DECK_POS_OPTIONS = ["n", "v", "adj", "adv", "conj", "prep", "idiom", "phrase"];
const AI_DECK_LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const AI_DECK_COOLDOWN_MS = 8000;
let aiDeckGenerating = false;
let aiDeckCooldownUntil = 0;
let aiDeckCooldownTimer = null;
let generatedCuratedDeckWords = [];
const CURATED_DECK_ITEMS = Array.isArray(window.WORD_ARENA_CURATED_DECKS) ? window.WORD_ARENA_CURATED_DECKS : [];
const CURATED_TOPIC_ALIASES = {
ielts: "ielts",
travel: "travel",
school: "school",
technology: "technology",
tech: "technology",
it: "technology",
business: "business",
health: "health",
environment: "environment",
"daily life": "daily-life",
"daily-life": "daily-life",
academic: "academic",
"academic english": "academic",
work: "work"
};
const VALID_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const VIETNAMESE_DIACRITIC_PATTERN = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

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

function setCuratedDeckStatus(message, kind = "info") {
let status = document.getElementById("curatedDeckStatus");
if (!status) return;
status.textContent = message;
status.className = `apiStateMessage apiStateMessage--${kind}`;
}

function curatedTopicLabel(topicKey) {
let labels = {
ielts: "IELTS",
travel: "Travel",
school: "School",
technology: "Technology",
business: "Business",
health: "Health",
environment: "Environment",
"daily-life": "Daily Life",
academic: "Academic English",
work: "Work"
};
return labels[topicKey] || topicKey || "Custom topic";
}

function normalizeCuratedTopic(value) {
let clean = cleanAiDeckValue(value).toLowerCase().replace(/[_-]+/g, " ");
return CURATED_TOPIC_ALIASES[clean] || clean.replace(/\s+/g, "-");
}

function getCuratedDeckOptions() {
let selectedTopic = document.getElementById("curatedTopicSelect")?.value || "ielts";
let customTopic = document.getElementById("curatedCustomTopic")?.value || "";
let customClean = customTopic.trim();
let topicKey = customClean ? normalizeCuratedTopic(customClean) : selectedTopic;
let targetLevel = document.getElementById("curatedLevelSelect")?.value || "Any";
let count = Number(document.getElementById("curatedCountSelect")?.value || 20);
return {
topicKey,
topicLabel: customClean || curatedTopicLabel(topicKey),
isCustom: Boolean(customClean),
targetLevel,
count: [10, 20, 30, 50].includes(count) ? count : 20
};
}

function isValidCuratedWord(item, options, seen) {
let english = cleanAiDeckValue(item.eng || item.english);
let meaning = cleanAiDeckValue(item.vie || item.vietnameseMeaning);
let level = cleanAiDeckValue(item.level).toUpperCase();
let key = english.toLowerCase();
if (!english || !hasReliableVietnameseMeaning(meaning, true)) return false;
if (!VALID_CEFR_LEVELS.includes(level)) return false;
if (options.targetLevel !== "Any" && level !== options.targetLevel) return false;
if (item.topic !== options.topicKey) return false;
if (seen.has(key)) return false;
seen.add(key);
return true;
}

function toCuratedDeckWord(item) {
return {
...normalizeWord({
eng: item.eng,
vie: item.vie,
pos: item.pos || "n",
tag: item.tag || item.topic || "curated",
level: item.level,
context: "Curated Deck",
example: item.example || "",
note: item.note || "Curated local seed"
}),
selected: true,
sourceType: "curated-local"
};
}

function generateCuratedDeck() {
let options = getCuratedDeckOptions();
if (!options.topicKey || options.topicKey === "custom-topic") {
setCuratedDeckStatus("Type a known custom topic such as IELTS, Travel, Technology, or Academic English.", "warn");
return;
}

setCuratedDeckStatus("Generating curated deck...", "loading");
let seen = new Set();
let candidates = CURATED_DECK_ITEMS
.filter(item => item.topic === options.topicKey)
.filter(item => isValidCuratedWord(item, options, seen));

generatedCuratedDeckWords = candidates
.slice(0, options.count)
.map(toCuratedDeckWord);
renderCuratedDeckList();

let levelLabel = options.targetLevel === "Any" ? "" : `${options.targetLevel} `;
if (!generatedCuratedDeckWords.length) {
let message = options.isCustom
? `No curated local words found for custom topic ${options.topicLabel}. Try a built-in topic.`
: `No reliable ${levelLabel}${options.topicLabel} words found. Try another topic or level.`;
setCuratedDeckStatus(message, "warn");
return;
}

let message = `Generated ${generatedCuratedDeckWords.length} reliable ${levelLabel}${options.topicLabel} words.`;
if (generatedCuratedDeckWords.length < options.count) {
message += " Local curated bank currently has fewer approved items than requested.";
}
setCuratedDeckStatus(message, generatedCuratedDeckWords.length < options.count ? "warn" : "ok");
}

function renderCuratedDeckList() {
let host = document.getElementById("curatedDeckList");
let importBtn = document.getElementById("curatedImportBtn");
let selectAllBtn = document.getElementById("curatedSelectAllBtn");
let deselectAllBtn = document.getElementById("curatedDeselectAllBtn");
if (!host) return;
host.innerHTML = "";

if (!generatedCuratedDeckWords.length) {
let empty = document.createElement("p");
empty.className = "emptyStudio";
empty.textContent = "No curated words generated yet.";
host.appendChild(empty);
if (importBtn) importBtn.disabled = true;
if (selectAllBtn) selectAllBtn.disabled = true;
if (deselectAllBtn) deselectAllBtn.disabled = true;
updateCuratedDeckCount();
return;
}

generatedCuratedDeckWords.forEach((word, index) => {
let row = document.createElement("article");
row.className = "aiDeckItem" + (word.selected === false ? " aiDeckItem--unselected" : " aiDeckItem--selected");
row.dataset.curatedRow = String(index);

let checkbox = document.createElement("input");
checkbox.type = "checkbox";
checkbox.checked = word.selected !== false;
checkbox.addEventListener("change", () => {
generatedCuratedDeckWords[index].selected = checkbox.checked;
row.classList.toggle("aiDeckItem--selected", checkbox.checked);
row.classList.toggle("aiDeckItem--unselected", !checkbox.checked);
updateCuratedDeckSaveState();
});

let main = document.createElement("div");
main.className = "aiDeckEditGrid curatedDeckEditGrid";
main.append(
createCuratedTextField(index, "eng", "English", word.eng, true),
createCuratedTextField(index, "vie", "Vietnamese", word.vie, true),
createCuratedSelectField(index, "pos", "POS", word.pos || "n", AI_DECK_POS_OPTIONS),
createCuratedTextField(index, "tag", "Tag", word.tag || "curated"),
createCuratedSelectField(index, "level", "Level", word.level || "B1", VALID_CEFR_LEVELS),
createCuratedTextField(index, "example", "Example", word.example || "", true)
);

let actions = document.createElement("div");
actions.className = "aiDeckRowActions";
let removeBtn = document.createElement("button");
removeBtn.className = "miniBtn";
removeBtn.type = "button";
removeBtn.textContent = "Remove";
removeBtn.addEventListener("click", () => removeCuratedDeckWord(index));
actions.appendChild(removeBtn);

let note = document.createElement("p");
note.textContent = `${word.note || "Curated local seed"} · ${word.sourceType || "curated-local"}`;
main.append(actions, note);
row.append(checkbox, main);
host.appendChild(row);
});

updateCuratedDeckSaveState();
}

function createCuratedTextField(index, field, label, value, required = false) {
let wrapper = document.createElement("label");
wrapper.className = `aiDeckField aiDeckField--${field}`;
let labelText = document.createElement("span");
labelText.textContent = label;
let input = document.createElement("input");
input.type = "text";
input.value = value || "";
input.required = required;
input.addEventListener("input", () => updateCuratedDeckWord(index, field, input.value));
wrapper.append(labelText, input);
return wrapper;
}

function createCuratedSelectField(index, field, label, value, options) {
let wrapper = document.createElement("label");
wrapper.className = `aiDeckField aiDeckField--${field}`;
let labelText = document.createElement("span");
labelText.textContent = label;
let select = document.createElement("select");
options.forEach(optionValue => {
let option = document.createElement("option");
option.value = optionValue;
option.textContent = optionValue;
select.appendChild(option);
});
select.value = value || options[0] || "";
select.addEventListener("change", () => updateCuratedDeckWord(index, field, select.value));
wrapper.append(labelText, select);
return wrapper;
}

function updateCuratedDeckWord(index, field, value) {
let word = generatedCuratedDeckWords[index];
if (!word) return;
word[field] = value;
if (field === "eng" || field === "vie" || field === "level") updateCuratedRowValidity(index);
updateCuratedDeckSaveState();
}

function updateCuratedRowValidity(index) {
let row = document.querySelector(`[data-curated-row="${index}"]`);
let word = generatedCuratedDeckWords[index];
if (!row || !word) return;
let invalid = word.selected !== false && (!cleanAiDeckValue(word.eng) || !hasReliableVietnameseMeaning(word.vie, true) || !VALID_CEFR_LEVELS.includes(cleanAiDeckValue(word.level).toUpperCase()));
row.classList.toggle("aiDeckItem--invalid", invalid);
}

function removeCuratedDeckWord(index) {
generatedCuratedDeckWords.splice(index, 1);
renderCuratedDeckList();
setCuratedDeckStatus(generatedCuratedDeckWords.length ? `${generatedCuratedDeckWords.length} curated words ready to review.` : "No curated words generated yet.", generatedCuratedDeckWords.length ? "info" : "warn");
}

function updateCuratedDeckSaveState() {
let importBtn = document.getElementById("curatedImportBtn");
let selectAllBtn = document.getElementById("curatedSelectAllBtn");
let deselectAllBtn = document.getElementById("curatedDeselectAllBtn");
let hasRows = generatedCuratedDeckWords.length > 0;
let selectedCount = generatedCuratedDeckWords.filter(word => word?.selected !== false).length;
generatedCuratedDeckWords.forEach((_, index) => updateCuratedRowValidity(index));
if (importBtn) importBtn.disabled = selectedCount === 0;
if (selectAllBtn) selectAllBtn.disabled = !hasRows || selectedCount === generatedCuratedDeckWords.length;
if (deselectAllBtn) deselectAllBtn.disabled = !hasRows || selectedCount === 0;
updateCuratedDeckCount();
}

function updateCuratedDeckCount() {
let count = document.getElementById("curatedDeckCount");
if (!count) return;
let selectedCount = generatedCuratedDeckWords.filter(word => word?.selected !== false).length;
count.textContent = `${generatedCuratedDeckWords.length} generated / ${selectedCount} selected`;
}

function setCuratedDeckSelection(selected) {
generatedCuratedDeckWords = generatedCuratedDeckWords.map(word => ({ ...word, selected }));
renderCuratedDeckList();
setCuratedDeckStatus(selected ? "All curated words selected." : "All curated words deselected.", "info");
}

function selectedCuratedDeckWords() {
let seen = new Set();
return generatedCuratedDeckWords
.filter(word => word?.selected !== false)
.map(word => normalizeWord({
...word,
eng: cleanAiDeckValue(word.eng),
vie: cleanAiDeckValue(word.vie),
pos: cleanAiDeckValue(word.pos) || "n",
tag: cleanAiDeckValue(word.tag) || "curated",
level: cleanAiDeckValue(word.level).toUpperCase() || "B1",
example: cleanAiDeckValue(word.example),
note: cleanAiDeckValue(word.note) || "Curated local seed"
}))
.filter(word => {
let key = word.eng.toLowerCase();
if (!key || seen.has(key)) return false;
seen.add(key);
return hasReliableVietnameseMeaning(word.vie, true) && VALID_CEFR_LEVELS.includes(word.level);
});
}

function importSelectedCuratedDeckWords() {
let selectedCount = generatedCuratedDeckWords.filter(word => word?.selected !== false).length;
let selected = selectedCuratedDeckWords();
if (!selectedCount) {
setCuratedDeckStatus("Select at least one curated word before importing.", "warn");
return;
}
if (selected.length !== selectedCount) {
setCuratedDeckStatus("Some selected words need a real English item, accented Vietnamese meaning, and valid CEFR level before import.", "warn");
return;
}

let options = getCuratedDeckOptions();
let result = importWordsToVocabulary(selected);
let feedback = importFeedback(result, `${options.topicLabel} ${options.targetLevel} curated deck`, generatedCuratedDeckWords.length, "Generated");
setCuratedDeckStatus(feedback, result.added ? "ok" : "warn");
toastStudio(feedback, result.added ? "ok" : "warn");
}

function clearCuratedDeck() {
generatedCuratedDeckWords = [];
renderCuratedDeckList();
setCuratedDeckStatus("Choose a topic, CEFR level, and word count to generate a reviewable deck.", "info");
}

function setAiDeckStatus(message, kind = "info") {
let status = document.getElementById("aiDeckStatus");
if (!status) return;
status.textContent = message;
status.className = `apiStateMessage apiStateMessage--${kind}`;
}

function setAiDeckSource(value) {
setText("aiDeckSource", value || "Ready");
}

function setAiDeckGenerateButton(locked, label = "Generate") {
let button = document.getElementById("aiDeckGenerateBtn");
if (!button) return;
button.disabled = locked;
button.textContent = label;
}

function unlockAiDeckGenerateWhenReady() {
clearTimeout(aiDeckCooldownTimer);
let remaining = Math.max(0, aiDeckCooldownUntil - Date.now());
if (remaining <= 0) {
setAiDeckGenerateButton(false);
return;
}
setAiDeckGenerateButton(true, `Wait ${Math.ceil(remaining / 1000)}s`);
aiDeckCooldownTimer = setTimeout(() => setAiDeckGenerateButton(false), remaining);
}

function generatedToWord(item, source) {
let rawLevel = cleanAiDeckValue(item.level || item.cefr || item.wordLevel).toUpperCase();
return {
...normalizeWord({
eng: item.english || item.eng,
vie: item.vietnameseMeaning || item.vie || item.meaning,
pos: item.partOfSpeech || item.pos || "n",
tag: item.tag || "general",
level: VALID_CEFR_LEVELS.includes(rawLevel) ? rawLevel : "",
context: "AI Deck",
example: item.exampleSentence || item.example || "",
note: `AI Deck source: ${item.source || source || "generated"}`
}),
selected: true
};
}

function hasUsableAiDeckMeaning(value) {
return hasReliableVietnameseMeaning(value, false);
}

function hasReliableVietnameseMeaning(value, requireAccent = true) {
let meaning = cleanAiDeckValue(value);
let lower = meaning.toLowerCase();
return Boolean(meaning)
&& !lower.includes("cần bổ sung")
&& !lower.includes("cáº§n bá»• sung")
&& !lower.includes("unknown")
&& !lower.includes("placeholder")
&& lower !== "n/a"
&& lower !== "na"
&& (!requireAccent || VIETNAMESE_DIACRITIC_PATTERN.test(meaning));
}

function getAiDeckGenerationOptions() {
let targetLevel = document.getElementById("aiDeckTargetLevel")?.value || "Any";
let maxWords = Number(document.getElementById("aiDeckMaxWords")?.value || 20);
return {
targetLevel,
maxWords: Number.isFinite(maxWords) ? maxWords : 20
};
}

async function requestAiDeck(text, options = {}) {
let response = await fetch(`${AI_DECK_API_ORIGIN}/api/ai/generate-deck`, {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
text,
targetLevel: options.targetLevel || "Any",
maxWords: options.maxWords || 20
})
});

if (!response.ok) {
throw new Error("Deck generation request failed.");
}

return response.json();
}

function renderAiDeckList() {
let host = document.getElementById("aiDeckList");
let saveBtn = document.getElementById("aiDeckSaveBtn");
let selectAllBtn = document.getElementById("aiDeckSelectAllBtn");
let deselectAllBtn = document.getElementById("aiDeckDeselectAllBtn");
if (!host) return;
host.innerHTML = "";

if (!generatedAiDeckWords.length) {
let empty = document.createElement("p");
empty.className = "emptyStudio";
empty.textContent = "No generated words yet. Paste English text and generate a deck to review editable cards here.";
host.appendChild(empty);
if (saveBtn) saveBtn.disabled = true;
if (selectAllBtn) selectAllBtn.disabled = true;
if (deselectAllBtn) deselectAllBtn.disabled = true;
updateAiDeckReviewCount();
return;
}

generatedAiDeckWords.forEach((word, index) => {
let row = document.createElement("article");
row.className = "aiDeckItem" + (word.selected === false ? " aiDeckItem--unselected" : " aiDeckItem--selected");
row.dataset.aiDeckRow = String(index);

let checkbox = document.createElement("input");
checkbox.type = "checkbox";
checkbox.checked = word.selected !== false;
checkbox.dataset.aiDeckIndex = String(index);
checkbox.addEventListener("change", () => {
generatedAiDeckWords[index].selected = checkbox.checked;
row.classList.toggle("aiDeckItem--selected", checkbox.checked);
row.classList.toggle("aiDeckItem--unselected", !checkbox.checked);
updateAiDeckSaveState();
});

let main = document.createElement("div");
main.className = "aiDeckEditGrid";
main.append(
createAiDeckTextField(index, "eng", "English", word.eng, true),
createAiDeckTextField(index, "vie", "Vietnamese", word.vie, true),
createAiDeckSelectField(index, "pos", "POS", word.pos || "n", AI_DECK_POS_OPTIONS),
createAiDeckTextField(index, "tag", "Tag", word.tag || "ai-deck"),
createAiDeckSelectField(index, "level", "Level", word.level || "A2", AI_DECK_LEVEL_OPTIONS)
);

let actions = document.createElement("div");
actions.className = "aiDeckRowActions";
let removeBtn = document.createElement("button");
removeBtn.className = "miniBtn";
removeBtn.type = "button";
removeBtn.textContent = "Remove";
removeBtn.addEventListener("click", () => removeGeneratedAiDeckWord(index));
actions.appendChild(removeBtn);

let example = document.createElement("p");
example.textContent = word.example || "No example sentence.";
main.append(actions, example);

row.append(checkbox, main);
host.appendChild(row);
});

updateAiDeckSaveState();
}

function cleanAiDeckValue(value) {
return String(value || "").trim();
}

function createAiDeckTextField(index, field, label, value, required = false) {
let wrapper = document.createElement("label");
wrapper.className = `aiDeckField aiDeckField--${field}`;
let labelText = document.createElement("span");
labelText.textContent = label;
let input = document.createElement("input");
input.type = "text";
input.value = value || "";
input.required = required;
input.addEventListener("input", () => updateGeneratedAiDeckWord(index, field, input.value));
wrapper.append(labelText, input);
return wrapper;
}

function createAiDeckSelectField(index, field, label, value, options) {
let wrapper = document.createElement("label");
wrapper.className = `aiDeckField aiDeckField--${field}`;
let labelText = document.createElement("span");
labelText.textContent = label;
let select = document.createElement("select");
for (let optionValue of options) {
let option = document.createElement("option");
option.value = optionValue;
option.textContent = optionValue;
select.appendChild(option);
}
if (value && !options.includes(value)) {
let option = document.createElement("option");
option.value = value;
option.textContent = value;
select.appendChild(option);
}
select.value = value || options[0] || "";
select.addEventListener("change", () => updateGeneratedAiDeckWord(index, field, select.value));
wrapper.append(labelText, select);
return wrapper;
}

function updateGeneratedAiDeckWord(index, field, value) {
let word = generatedAiDeckWords[index];
if (!word) return;
word[field] = value;
if (field === "eng" || field === "vie" || field === "level") updateAiDeckRowValidity(index);
updateAiDeckSaveState();
}

function updateAiDeckRowValidity(index) {
let row = document.querySelector(`[data-ai-deck-row="${index}"]`);
let word = generatedAiDeckWords[index];
if (!row || !word) return;
row.classList.toggle("aiDeckItem--invalid", word.selected !== false && (!cleanAiDeckValue(word.eng) || !hasUsableAiDeckMeaning(word.vie) || !VALID_CEFR_LEVELS.includes(cleanAiDeckValue(word.level).toUpperCase())));
}

function removeGeneratedAiDeckWord(index) {
generatedAiDeckWords.splice(index, 1);
renderAiDeckList();
setAiDeckStatus(generatedAiDeckWords.length ? `${generatedAiDeckWords.length} generated words ready to review.` : "No generated words yet.", generatedAiDeckWords.length ? "info" : "warn");
}

function selectedAiDeckWords() {
return generatedAiDeckWords
.filter(word => word?.selected !== false)
.map(word => normalizeWord({
...word,
eng: cleanAiDeckValue(word.eng),
vie: cleanAiDeckValue(word.vie),
pos: cleanAiDeckValue(word.pos) || "n",
tag: cleanAiDeckValue(word.tag) || "ai-deck",
level: cleanAiDeckValue(word.level).toUpperCase()
}))
.filter(Boolean);
}

function updateAiDeckSaveState() {
let saveBtn = document.getElementById("aiDeckSaveBtn");
let selectAllBtn = document.getElementById("aiDeckSelectAllBtn");
let deselectAllBtn = document.getElementById("aiDeckDeselectAllBtn");
let hasRows = generatedAiDeckWords.length > 0;
let selectedCount = generatedAiDeckWords.filter(word => word?.selected !== false).length;
generatedAiDeckWords.forEach((_, index) => updateAiDeckRowValidity(index));
if (saveBtn) saveBtn.disabled = selectedCount === 0;
if (selectAllBtn) selectAllBtn.disabled = !hasRows || selectedCount === generatedAiDeckWords.length;
if (deselectAllBtn) deselectAllBtn.disabled = !hasRows || selectedCount === 0;
updateAiDeckReviewCount();
}

function updateAiDeckReviewCount() {
let count = document.getElementById("aiDeckReviewCount");
if (!count) return;
let selectedCount = generatedAiDeckWords.filter(word => word?.selected !== false).length;
count.textContent = `${generatedAiDeckWords.length} generated / ${selectedCount} selected`;
}

function setAiDeckSelection(selected) {
generatedAiDeckWords = generatedAiDeckWords.map(word => ({ ...word, selected }));
renderAiDeckList();
setAiDeckStatus(selected ? "All generated words selected." : "All generated words deselected.", "info");
}

function validateAiDeckSelection() {
let selected = selectedAiDeckWords();
if (!selected.length) {
return { words: [], message: "Select at least one generated word to save." };
}

let invalid = selected.find(word => !word.eng || !word.vie || !VALID_CEFR_LEVELS.includes(word.level));
if (invalid) {
return { words: [], message: "English, Vietnamese meaning, and valid CEFR level are required for every selected word." };
}

return { words: selected, message: "" };
}

async function generateAiDeck() {
if (aiDeckGenerating) {
setAiDeckStatus("Deck generation is already running. Please wait a moment.", "loading");
setAiDeckGenerateButton(true, "Generating...");
return;
}

let now = Date.now();
if (now < aiDeckCooldownUntil) {
let wait = Math.ceil((aiDeckCooldownUntil - now) / 1000);
setAiDeckStatus(`Please wait ${wait}s before generating another deck.`, "warn");
unlockAiDeckGenerateWhenReady();
return;
}

let textarea = document.getElementById("aiDeckText");
let text = textarea?.value.trim() || "";
let options = getAiDeckGenerationOptions();
if (!text) {
setAiDeckStatus("Paste English text before generating a deck.", "warn");
return;
}
if (text.length > 8000) {
setAiDeckStatus("Text must be 8000 characters or less.", "warn");
return;
}

generatedAiDeckWords = [];
renderAiDeckList();
setAiDeckSource("Loading");
setAiDeckStatus("Generating vocabulary deck...", "loading");
aiDeckGenerating = true;
aiDeckCooldownUntil = Date.now() + AI_DECK_COOLDOWN_MS;
setAiDeckGenerateButton(true, "Generating...");

try {
let payload = await requestAiDeck(text, options);
let source = payload?.source || "generated";
generatedAiDeckWords = Array.isArray(payload?.items)
? payload.items
.map(item => generatedToWord(item, source))
.filter(word => word.eng && hasUsableAiDeckMeaning(word.vie) && VALID_CEFR_LEVELS.includes(word.level))
: [];
setAiDeckSource(source === "openai" ? "OpenAI" : "Fallback");
renderAiDeckList();
let levelLabel = options.targetLevel && options.targetLevel !== "Any" ? `${options.targetLevel} ` : "";
let emptyMessage = source === "fallback"
? `AI unavailable. No suitable ${levelLabel}vocabulary found by fallback.`
: `No suitable ${levelLabel}vocabulary found in this text.`;
let successMessage = source === "fallback"
? `AI unavailable. Fallback generated ${generatedAiDeckWords.length} approximate ${levelLabel}items.`
: `Generated ${generatedAiDeckWords.length} ${levelLabel}vocabulary items.`;
setAiDeckStatus(
generatedAiDeckWords.length ? successMessage : emptyMessage,
generatedAiDeckWords.length ? "ok" : "warn"
);
} catch (error) {
setAiDeckSource("Unavailable");
setAiDeckStatus("AI deck generation is unavailable. Please try again later.", "warn");
generatedAiDeckWords = [];
renderAiDeckList();
} finally {
aiDeckGenerating = false;
unlockAiDeckGenerateWhenReady();
}
}

function clearAiDeck() {
let textarea = document.getElementById("aiDeckText");
if (textarea) textarea.value = "";
generatedAiDeckWords = [];
setAiDeckSource("Ready");
setAiDeckStatus("Generated words will appear below.", "info");
renderAiDeckList();
}

function saveSelectedAiDeckWords() {
let validation = validateAiDeckSelection();
let selected = validation.words;
if (!selected.length) {
setAiDeckStatus(validation.message || "Pick at least one generated word before saving.", "warn");
return;
}

let result = importWordsToVocabulary(selected);
setAiDeckStatus(
result.added ? `Saved ${result.added} words to your deck. Skipped ${result.skipped} duplicates.` : "Selected words are already in your vocabulary.",
result.added ? "ok" : "warn"
);
toastStudio(result.added ? `Saved ${result.added} words to your deck.` : "No new AI deck words to save.", result.added ? "ok" : "warn");
}

function mergeByEnglishLocal(base, incoming) {
return mergeWordsWithImportStats(base, incoming).merged;
}

function mergeWordsWithImportStats(base, incoming) {
let merged = [...base];
let existing = new Set(base.map(word => String(word.eng || "").toLowerCase()));
let added = 0;
let skipped = 0;
incoming.forEach(word => {
let clean = normalizeWord(word);
let key = clean.eng.toLowerCase();
if (!key || !clean.vie || existing.has(key)) {
skipped++;
return;
}
existing.add(key);
merged.push(clean);
added++;
});
return { merged, added, skipped };
}

function importWordsToVocabulary(words) {
let result = mergeWordsWithImportStats(getWords(), words);
vocab = result.merged;
localStorage.setItem(accountStorageKey("deckImported"), "true");
save();
renderTable();
renderStudio();
window.quizCloud?.syncNow?.();
return result;
}

function importFeedback(result, label, total = null, noun = "Generated") {
if (Number.isFinite(total)) {
return `${noun} ${total} words. Imported ${result.added} new words. Skipped ${result.skipped} duplicates.`;
}
if (result.added > 0) {
return `Imported ${result.added} new words. Skipped ${result.skipped} duplicates.`;
}
return `All ${label} words already exist in your vocabulary.`;
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
let result = importWordsToVocabulary(words);
toastStudio(importFeedback(result, `${key.toUpperCase()} starter deck`, words.length, "Deck has"), result.added ? "ok" : "warn");
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
let sample = "focus,tập trung,v,study,/FOH-kuhs/,A2,study action,Focus on one thing.,Tập trung vào một việc.,focus on; stay focused,concentrate,distract,Use focus on not focus in,Daily learning";
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
document.getElementById("aiDeckBtn")?.addEventListener("click", () => openStudio("aiDeck"));
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
document.getElementById("curatedGenerateBtn")?.addEventListener("click", generateCuratedDeck);
document.getElementById("curatedClearBtn")?.addEventListener("click", clearCuratedDeck);
document.getElementById("curatedImportBtn")?.addEventListener("click", importSelectedCuratedDeckWords);
document.getElementById("curatedSelectAllBtn")?.addEventListener("click", () => setCuratedDeckSelection(true));
document.getElementById("curatedDeselectAllBtn")?.addEventListener("click", () => setCuratedDeckSelection(false));
document.getElementById("aiDeckGenerateBtn")?.addEventListener("click", generateAiDeck);
document.getElementById("aiDeckClearBtn")?.addEventListener("click", clearAiDeck);
document.getElementById("aiDeckSaveBtn")?.addEventListener("click", saveSelectedAiDeckWords);
document.getElementById("aiDeckSelectAllBtn")?.addEventListener("click", () => setAiDeckSelection(true));
document.getElementById("aiDeckDeselectAllBtn")?.addEventListener("click", () => setAiDeckSelection(false));
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
