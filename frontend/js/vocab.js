let editingWordIndex = null;

const POS_OPTIONS = ["interjection", "n", "v", "adj", "adv", "proverb", "idiom"];
const LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2", "IELTS 5.0", "IELTS 6.0", "IELTS 7.0", "IELTS 8.0+", "School"];
const MAX_ENGLISH_WORD_LENGTH = 120;

document.addEventListener("click", () => {
document.querySelectorAll(".actionMenu.is-open").forEach(menu => menu.classList.remove("is-open"));
});

function cleanText(value) {
return String(value || "").trim();
}

function normalizeEnglishKey(value) {
return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function stampWordUpdatedAt(word, timestamp = new Date().toISOString()) {
if (word && typeof word === "object") {
word.updatedAt = timestamp;
}
return word;
}

function validateWordFields(word) {
if (!word.eng) return "Please enter an English word.";
if (!word.vie) return "Please enter a Vietnamese meaning.";
if (word.eng.length > MAX_ENGLISH_WORD_LENGTH) return "English word is too long.";
return "";
}

function normalizeWord(word) {
let stats = word?.stats || {};

return {
id: word?.id || null,
eng: cleanText(word?.eng),
vie: cleanText(word?.vie),
pos: cleanText(word?.pos || "n") || "n",
tag: cleanText(word?.tag),
ipa: cleanText(word?.ipa),
level: cleanText(word?.level || word?.wordLevel || "A1") || "A1",
context: cleanText(word?.context),
example: cleanText(word?.example),
exampleMeaning: cleanText(word?.exampleMeaning || word?.example_meaning),
collocation: cleanText(word?.collocation),
synonyms: cleanText(word?.synonyms),
antonyms: cleanText(word?.antonyms),
commonMistake: cleanText(word?.commonMistake || word?.common_mistake),
note: cleanText(word?.note),
favorite: Boolean(word?.favorite),
mastered: Boolean(word?.mastered),
updatedAt: cleanText(word?.updatedAt || word?.updated_at),
stats: {
seen: Number(stats.seen || 0),
correct: Number(stats.correct || 0),
wrong: Number(stats.wrong || 0),
streak: Number(stats.streak || 0),
bestStreak: Number(stats.bestStreak || 0),
masteryLevel: Number(stats.masteryLevel || 0),
lastReviewed: stats.lastReviewed || "",
nextReview: stats.nextReview || ""
}
};
}

function getMasteryLabel(word) {
let stats = word?.stats || {};

if (word.mastered || stats.streak >= 5 || stats.masteryLevel >= 5) return "Mastered";
if ((stats.wrong || 0) > (stats.correct || 0)) return "Review";
if ((stats.streak || 0) >= 2 || (stats.correct || 0) >= 3 || stats.masteryLevel >= 2) return "Learning";
return "New";
}

function nextReviewDate(stats, isCorrect) {
let streak = Number(stats?.streak || 0);
let days = isCorrect ? Math.min(30, [1, 3, 7, 14, 30][Math.min(streak, 4)] || 30) : 1;
let due = new Date();
due.setDate(due.getDate() + days);
return due.toISOString();
}

function isDueToday(word) {
let raw = word?.stats?.nextReview;
if (!raw) return Number(word?.stats?.seen || 0) > 0 && !word.mastered;

let due = new Date(raw);
if (Number.isNaN(due.getTime())) return true;

let today = new Date();
let endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
return due < endToday;
}

function getNextReviewText(word) {
let raw = word?.stats?.nextReview;
let seen = Number(word?.stats?.seen || 0);

if (!raw) return seen ? "Due now" : "New word";

let due = new Date(raw);
if (Number.isNaN(due.getTime())) return "Due now";

let today = new Date();
let startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
let startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
let days = Math.ceil((startDue - startToday) / 86400000);

if (days <= 0) return "Due today";
if (days === 1) return "Due tomorrow";
return `In ${days} days`;
}

function getDueStatus(word) {
let stats = word?.stats || {};
let level = getMasteryLabel(word);

if (level === "Mastered") return { text: "Strong", tone: "strong" };
if (isDueToday(word)) return { text: "Due today", tone: "due" };
if (Number(stats.wrong || 0) > Number(stats.correct || 0)) return { text: "Weak", tone: "weak" };
if (Number(stats.seen || 0) === 0) return { text: "New", tone: "new" };
return { text: getNextReviewText(word), tone: "scheduled" };
}

function getAccuracyText(word) {
let stats = word?.stats || {};
let total = Number(stats.correct || 0) + Number(stats.wrong || 0);
if (!total) return "Not tried";
let percent = Math.round(Number(stats.correct || 0) / total * 100);
return `${percent}% (${stats.correct}/${total})`;
}

function getAttemptText(word) {
let stats = word?.stats || {};
let total = Number(stats.correct || 0) + Number(stats.wrong || 0);
if (!total) return "0 attempts";
return `${total} attempt${total === 1 ? "" : "s"}`;
}

function getLevelText(word) {
let level = cleanText(word?.level || "A1");
if (level.toUpperCase().startsWith("IELTS")) return level;
if (/^[ABC][12]$/.test(level)) return `CEFR ${level}`;
return level;
}

function getPosText(pos) {
let value = cleanText(pos || "n").toLowerCase();
return {
n: "noun",
v: "verb",
adj: "adjective",
adv: "adverb"
}[value] || value;
}

function createLevelBadge(word) {
let raw = cleanText(word?.level || "A1");
let badge = document.createElement("span");
badge.className = "wordLevelBadge";

let prefix = document.createElement("small");
let value = document.createElement("strong");

if (/^[ABC][12]$/.test(raw)) {
badge.classList.add("wordLevelBadge--cefr");
prefix.textContent = "CEFR";
value.textContent = raw;
} else if (raw.toUpperCase().startsWith("IELTS")) {
badge.classList.add("wordLevelBadge--ielts");
prefix.textContent = "IELTS";
value.textContent = raw.replace(/^IELTS\s*/i, "") || "Band";
} else {
badge.classList.add("wordLevelBadge--custom");
prefix.textContent = "Level";
value.textContent = raw;
}

badge.append(prefix, value);
return badge;
}

function getLastReviewedText(word) {
let raw = word?.stats?.lastReviewed;
if (!raw) return "Never";
let date = new Date(raw);
if (Number.isNaN(date.getTime())) return "Never";
return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function recordWordResult(word, isCorrect) {
let target = vocab.find(w => w.eng === word.eng);
if (!target) return;

let reviewedAt = new Date().toISOString();
target.stats = target.stats || {};
target.stats.seen = Number(target.stats.seen || 0) + 1;
target.stats.lastReviewed = reviewedAt;

if (isCorrect) {
target.stats.correct = Number(target.stats.correct || 0) + 1;
target.stats.streak = Number(target.stats.streak || 0) + 1;
target.stats.bestStreak = Math.max(Number(target.stats.bestStreak || 0), target.stats.streak);
target.stats.masteryLevel = Math.min(5, Number(target.stats.masteryLevel || 0) + 1);
if (target.stats.streak >= 5) target.mastered = true;
} else {
target.stats.wrong = Number(target.stats.wrong || 0) + 1;
target.stats.streak = 0;
target.stats.masteryLevel = Math.max(0, Number(target.stats.masteryLevel || 0) - 1);
target.mastered = false;
}

target.stats.nextReview = nextReviewDate(target.stats, isCorrect);
stampWordUpdatedAt(target, reviewedAt);
}

function buildExampleSentence(eng, pos, context, collocation) {
let target = cleanText(collocation).split(",")[0].trim() || cleanText(eng);
let sense = cleanText(context);

if (!target) return "";
if (pos === "v") return `I try to ${target} when ${sense || "I study English"}.`;
if (pos === "adj") return `This is a ${target} way to explain the idea.`;
if (pos === "adv") return `She answered ${target} during the practice round.`;
if (pos === "interjection") return `${target.charAt(0).toUpperCase()}${target.slice(1)}, nice to meet you.`;
return `The word "${target}" is useful in ${sense || "daily English"}.`;
}

function readWordForm() {
return normalizeWord({
eng: engInput?.value,
vie: vieInput?.value,
pos: posInput?.value,
tag: tagInput?.value,
ipa: document.getElementById("ipaInput")?.value,
level: document.getElementById("levelInput")?.value,
context: document.getElementById("contextInput")?.value,
example: exampleInput?.value,
exampleMeaning: document.getElementById("exampleMeaningInput")?.value,
collocation: document.getElementById("collocationInput")?.value,
synonyms: document.getElementById("synonymsInput")?.value,
antonyms: document.getElementById("antonymsInput")?.value,
commonMistake: document.getElementById("commonMistakeInput")?.value,
note: noteInput?.value
});
}

function clearWordForm() {
[
engInput,
vieInput,
tagInput,
document.getElementById("ipaInput"),
document.getElementById("contextInput"),
exampleInput,
document.getElementById("exampleMeaningInput"),
document.getElementById("collocationInput"),
document.getElementById("synonymsInput"),
document.getElementById("antonymsInput"),
document.getElementById("commonMistakeInput"),
noteInput
].forEach(input => {
if (input) input.value = "";
});

if (posInput) posInput.value = "interjection";
let levelInput = document.getElementById("levelInput");
if (levelInput) levelInput.value = "A1";
engInput?.focus();
}

function addWord(options = {}) {
let word = readWordForm();
let validationMessage = validateWordFields(word);

if (validationMessage) {
alert(validationMessage);
if (!word.eng) engInput?.focus();
else if (!word.vie) vieInput?.focus();
return;
}

if (!word.example) {
word.example = buildExampleSentence(word.eng, word.pos, word.context, word.collocation);
if (exampleInput) exampleInput.value = word.example;
}

if (vocab.some(w => normalizeEnglishKey(w.eng) === normalizeEnglishKey(word.eng))) {
alert("Word already exists!");
return;
}

stampWordUpdatedAt(word);
let localIndex = vocab.push(word) - 1;

save();
renderTable();

Promise.resolve(window.quizCloud?.createWord?.(word)).then(serverWord => {
if (!serverWord) return;
vocab[localIndex] = normalizeWord(serverWord);
save();
renderTable();
});

clearWordForm();

if (options.quizNow) {
startQuickQuizFromWord(word);
}
}

function startQuickQuizFromWord(word) {
let others = vocab
.filter(item => item.eng.toLowerCase() !== word.eng.toLowerCase())
.sort(() => Math.random() - 0.5)
.slice(0, 3);

if (others.length < 3) {
alert("Add at least 4 words before quick quiz.");
return;
}

startWordSetQuiz([word, ...others], "mixed", { kind: "quick-add" });
}

function appendMeta(parent, word) {
let details = [
word.ipa && `IPA: ${word.ipa}`,
word.context && `Sense: ${word.context}`,
word.example && `Example: ${word.example}`,
word.exampleMeaning && `Meaning: ${word.exampleMeaning}`,
word.collocation && `Collocation: ${word.collocation}`,
word.synonyms && `Synonyms: ${word.synonyms}`,
word.antonyms && `Antonyms: ${word.antonyms}`,
word.commonMistake && `Common mistake: ${word.commonMistake}`,
word.note && `Note: ${word.note}`
].filter(Boolean);

if (!details.length) return;

let meta = document.createElement("div");
meta.className = "wordMeta";

details.forEach(text => {
let item = document.createElement("span");
item.textContent = text;
meta.appendChild(item);
});

parent.appendChild(meta);
}

function uniqueSorted(values) {
return [...new Set(values.map(value => cleanText(value)).filter(Boolean))]
.sort((a, b) => a.localeCompare(b));
}

function syncSelectOptions(select, values, placeholder) {
if (!select) return;

let current = select.value;
select.innerHTML = "";

let all = document.createElement("option");
all.value = "";
all.textContent = placeholder;
select.appendChild(all);

values.forEach(value => {
let option = document.createElement("option");
option.value = value;
option.textContent = value;
select.appendChild(option);
});

select.value = values.includes(current) ? current : "";
}

function refreshFilterOptions() {
syncSelectOptions(document.getElementById("filterPos"), uniqueSorted(vocab.map(w => w.pos)), "All POS");
syncSelectOptions(document.getElementById("filterTag"), uniqueSorted(vocab.map(w => w.tag)), "All tags");
}

function getActiveFilters() {
return {
query: String(window.vocabFilterQuery || "").toLowerCase(),
pos: document.getElementById("filterPos")?.value || "",
tag: document.getElementById("filterTag")?.value || "",
mastery: document.getElementById("filterMastery")?.value || "",
favorites: Boolean(document.getElementById("filterFavorites")?.checked),
due: Boolean(document.getElementById("filterDue")?.checked)
};
}

function matchesFilters(word, filters) {
let level = getMasteryLabel(word);
let due = getDueStatus(word);
let queryText = [
word.eng,
word.vie,
word.pos,
word.tag,
word.ipa,
word.level,
word.context,
word.example,
word.exampleMeaning,
word.collocation,
word.synonyms,
word.antonyms,
word.commonMistake,
word.note,
level,
due.text,
getAccuracyText(word),
getNextReviewText(word)
].join(" ").toLowerCase();

if (filters.query && !queryText.includes(filters.query)) return false;
if (filters.pos && word.pos !== filters.pos) return false;
if (filters.tag && word.tag !== filters.tag) return false;
if (filters.mastery && level !== filters.mastery) return false;
if (filters.favorites && !word.favorite) return false;
if (filters.due && !isDueToday(word)) return false;
return true;
}

function createCellInput(value, className, placeholder = "") {
let input = document.createElement("input");
input.className = className;
input.value = value || "";
input.placeholder = placeholder;
return input;
}

function createEditSelect(value, values) {
let select = document.createElement("select");
values.forEach(item => {
let option = document.createElement("option");
option.value = item;
option.textContent = getLevelText({ level: item });
select.appendChild(option);
});
select.value = values.includes(value) ? value : values[0];
return select;
}

function appendInputStack(parent, inputs) {
let stack = document.createElement("div");
stack.className = "editStack";
inputs.forEach(input => stack.appendChild(input));
parent.appendChild(stack);
}

function renderEditRow(row, word, originalIndex) {
row.classList.add("editingRow");

let engCell = document.createElement("td");
let engInputEdit = createCellInput(word.eng, "editEng", "English");
let ipaInputEdit = createCellInput(word.ipa, "editIpa", "IPA");
appendInputStack(engCell, [engInputEdit, ipaInputEdit]);

let meaningCell = document.createElement("td");
let vieInputEdit = createCellInput(word.vie, "editVie", "Vietnamese");
let contextInputEdit = createCellInput(word.context, "editContext", "Context / sense");
let exampleInputEdit = createCellInput(word.example, "editExample", "Example");
let exampleMeaningInputEdit = createCellInput(word.exampleMeaning, "editExampleMeaning", "Example meaning");
let collocationInputEdit = createCellInput(word.collocation, "editCollocation", "Collocation");
let synonymsInputEdit = createCellInput(word.synonyms, "editSynonyms", "Synonyms");
let antonymsInputEdit = createCellInput(word.antonyms, "editAntonyms", "Antonyms");
let commonMistakeInputEdit = createCellInput(word.commonMistake, "editCommonMistake", "Common mistake");
let noteInputEdit = createCellInput(word.note, "editNote", "Note");
appendInputStack(meaningCell, [
vieInputEdit,
contextInputEdit,
exampleInputEdit,
exampleMeaningInputEdit,
collocationInputEdit,
synonymsInputEdit,
antonymsInputEdit,
commonMistakeInputEdit,
noteInputEdit
]);

let levelCell = document.createElement("td");
let levelInputEdit = createEditSelect(word.level, LEVEL_OPTIONS);
let posInputEdit = createEditSelect(word.pos, POS_OPTIONS);
let tagInputEdit = createCellInput(word.tag, "editTag", "Topic / tag");
appendInputStack(levelCell, [levelInputEdit, posInputEdit, tagInputEdit]);

let reviewCell = document.createElement("td");
reviewCell.className = "reviewSummaryCell";
let editReviewMain = document.createElement("strong");
editReviewMain.textContent = getAccuracyText(word);
let editReviewSub = document.createElement("span");
editReviewSub.textContent = `${getNextReviewText(word)} · last ${getLastReviewedText(word).toLowerCase()}`;
reviewCell.append(editReviewMain, editReviewSub);

let actionCell = document.createElement("td");
actionCell.className = "actionCell";

let saveBtn = document.createElement("button");
saveBtn.className = "actionBtn saveBtn";
saveBtn.type = "button";
saveBtn.textContent = "Save";
saveBtn.addEventListener("click", () => {
saveEditedWord(originalIndex, {
eng: engInputEdit.value,
vie: vieInputEdit.value,
pos: posInputEdit.value,
tag: tagInputEdit.value,
ipa: ipaInputEdit.value,
level: levelInputEdit.value,
context: contextInputEdit.value,
example: exampleInputEdit.value,
exampleMeaning: exampleMeaningInputEdit.value,
collocation: collocationInputEdit.value,
synonyms: synonymsInputEdit.value,
antonyms: antonymsInputEdit.value,
commonMistake: commonMistakeInputEdit.value,
note: noteInputEdit.value
});
});

let cancelBtn = document.createElement("button");
cancelBtn.className = "actionBtn cancelBtn";
cancelBtn.type = "button";
cancelBtn.textContent = "Cancel";
cancelBtn.addEventListener("click", () => {
editingWordIndex = null;
renderTable();
});

actionCell.append(saveBtn, cancelBtn);
row.append(engCell, meaningCell, levelCell, reviewCell, actionCell);
}

function createBadge(text, className) {
let badge = document.createElement("span");
badge.className = className;
badge.textContent = text;
return badge;
}

function renderDisplayRow(row, word, originalIndex) {
if (word.favorite) row.classList.add("favoriteRow");

let engCell = document.createElement("td");
engCell.className = "engWord";
let engName = document.createElement("strong");
engName.textContent = word.eng;
engCell.appendChild(engName);
if (word.ipa) engCell.appendChild(createBadge(word.ipa, "ipaBadge"));
engCell.addEventListener("click", () => speak(word.eng));

let meaningCell = document.createElement("td");
meaningCell.className = "meaningCell";
let meaning = document.createElement("strong");
meaning.textContent = word.vie;
meaningCell.appendChild(meaning);
let meaningHintText = word.context || word.example || word.note || "";
if (meaningHintText) {
let meaningHint = document.createElement("span");
meaningHint.className = "meaningHint";
meaningHint.textContent = meaningHintText;
meaningCell.appendChild(meaningHint);
}

let levelCell = document.createElement("td");
let levelBadge = createLevelBadge(word);
let posBadge = createBadge(getPosText(word.pos), "metaBadge");
let mastery = getMasteryLabel(word);
let masteryBadge = createBadge(mastery, "levelBadge levelBadge--" + mastery.toLowerCase());
levelCell.className = "levelCell";
let levelMain = document.createElement("div");
levelMain.className = "studyInfoMain";
levelMain.append(levelBadge);
let levelSub = document.createElement("div");
levelSub.className = "studyInfoSub";
levelSub.appendChild(posBadge);
if (word.tag) levelSub.appendChild(createBadge(word.tag, "topicBadge"));
levelCell.append(levelMain, levelSub);

let dueCell = document.createElement("td");
dueCell.className = "reviewCellDisplay";
let due = getDueStatus(word);
let reviewTop = document.createElement("div");
reviewTop.className = "reviewTopLine";
reviewTop.append(
createBadge(due.text, `dueBadge dueBadge--${due.tone}`),
masteryBadge
);
dueCell.appendChild(reviewTop);
let next = document.createElement("div");
next.className = "reviewHint";
next.textContent = `${getAccuracyText(word)} · ${getAttemptText(word)} · last ${getLastReviewedText(word).toLowerCase()}`;
dueCell.appendChild(next);

let actionCell = document.createElement("td");
actionCell.className = "actionCell";

let favoriteBtn = document.createElement("button");
favoriteBtn.className = "actionBtn favoriteAction";
favoriteBtn.type = "button";
favoriteBtn.innerHTML = word.favorite ? "&#9733;" : "&#9734;";
favoriteBtn.title = "Toggle favorite";
favoriteBtn.setAttribute("aria-label", "Toggle favorite");
favoriteBtn.addEventListener("click", () => toggleFavorite(originalIndex));

let speakBtn = document.createElement("button");
speakBtn.className = "actionBtn speakBtn";
speakBtn.type = "button";
speakBtn.innerHTML = "&#9835;";
speakBtn.title = "Speak word";
speakBtn.setAttribute("aria-label", "Speak word");
speakBtn.addEventListener("click", () => speak(word.eng));

let editBtn = document.createElement("button");
editBtn.className = "actionBtn editBtn";
editBtn.type = "button";
editBtn.textContent = "Edit";
editBtn.title = "Edit word";
editBtn.addEventListener("click", () => {
editingWordIndex = originalIndex;
renderTable();
});

let menuWrap = document.createElement("div");
menuWrap.className = "actionMenu";

let moreBtn = document.createElement("button");
moreBtn.className = "actionBtn moreBtn";
moreBtn.type = "button";
moreBtn.innerHTML = "&#8942;";
moreBtn.title = "More actions";
moreBtn.setAttribute("aria-label", "More actions");

let menu = document.createElement("div");
menu.className = "actionMenuPanel";

moreBtn.addEventListener("click", event => {
event.stopPropagation();
document.querySelectorAll(".actionMenu.is-open").forEach(openMenu => {
if (openMenu !== menuWrap) openMenu.classList.remove("is-open");
});
menuWrap.classList.toggle("is-open");
});

let hardBtn = document.createElement("button");
hardBtn.className = "menuAction hardBtn";
hardBtn.type = "button";
hardBtn.textContent = "Mark hard";
hardBtn.title = "Mark as hard";
hardBtn.addEventListener("click", () => markWordHard(originalIndex));

let knownBtn = document.createElement("button");
knownBtn.className = "menuAction knownBtn";
knownBtn.type = "button";
knownBtn.textContent = "Mark known";
knownBtn.title = "Mark as known";
knownBtn.addEventListener("click", () => markWordKnown(originalIndex));

let deleteBtn = document.createElement("button");
deleteBtn.className = "menuAction deleteBtn";
deleteBtn.type = "button";
deleteBtn.textContent = "Delete";
deleteBtn.title = "Delete word";
deleteBtn.setAttribute("aria-label", "Delete word");
deleteBtn.addEventListener("click", () => deleteWord(originalIndex));

favoriteBtn.className = "menuAction favoriteAction";
favoriteBtn.textContent = word.favorite ? "Unfavorite" : "Favorite";

menu.append(favoriteBtn, hardBtn, knownBtn, deleteBtn);
menuWrap.append(moreBtn, menu);
actionCell.append(speakBtn, editBtn, menuWrap);
row.append(engCell, meaningCell, levelCell, dueCell, actionCell);
}

function renderEmptyTable(table, filters) {
let row = document.createElement("tr");
let cell = document.createElement("td");
cell.colSpan = 5;
cell.className = "emptyTableCell";
cell.textContent = vocab.length
? "No words match these filters."
: "No words yet. Add your first word or generate an AI Deck to start learning.";
row.appendChild(cell);
table.appendChild(row);
}

function renderTable() {
let table = document.getElementById("tableBody");
table.innerHTML = "";

refreshFilterOptions();
let filters = getActiveFilters();
let rows = vocab
.map((word, originalIndex) => ({ word: normalizeWord(word), originalIndex }))
.filter(({ word }) => matchesFilters(word, filters));

let fragment = document.createDocumentFragment();

rows.forEach(({ word, originalIndex }) => {
vocab[originalIndex] = word;

let row = document.createElement("tr");
if (editingWordIndex === originalIndex) {
renderEditRow(row, word, originalIndex);
} else {
renderDisplayRow(row, word, originalIndex);
}
fragment.appendChild(row);
});

table.appendChild(fragment);
if (!rows.length) renderEmptyTable(table, filters);

totalWords.innerText = vocab.length;

let topWords = document.getElementById("totalWordsTop");
if (topWords) topWords.innerText = vocab.length;

updateDifficulty();
}

function saveEditedWord(i, patch) {
let current = vocab[i];
if (!current) return;

let next = normalizeWord({ ...current, ...patch });
let validationMessage = validateWordFields(next);
if (validationMessage) {
alert(validationMessage);
return;
}

let duplicate = vocab.some((word, index) =>
index !== i && normalizeEnglishKey(word.eng) === normalizeEnglishKey(next.eng)
);
if (duplicate) {
alert("Word already exists!");
return;
}

let oldEng = current.eng;
stampWordUpdatedAt(next);
vocab[i] = next;
wrongWords = wrongWords.map(word => word.eng === oldEng ? normalizeWord({ ...word, ...next }) : word);
editingWordIndex = null;

save();
renderTable();
renderMistakeTable();

Promise.resolve(window.quizCloud?.updateWord?.(next)).then(serverWord => {
if (!serverWord) return;
vocab[i] = normalizeWord(serverWord);
save();
renderTable();
});
}

function syncWordUpdate(i) {
if (vocab[i]) stampWordUpdatedAt(vocab[i]);
save();
renderTable();
renderMistakeTable();

Promise.resolve(window.quizCloud?.updateWord?.(vocab[i])).then(serverWord => {
if (!serverWord) return;
vocab[i] = normalizeWord(serverWord);
save();
renderTable();
});
}

function toggleFavorite(i) {
if (!vocab[i]) return;

vocab[i].favorite = !vocab[i].favorite;
syncWordUpdate(i);
}

function markWordKnown(i) {
if (!vocab[i]) return;

let word = vocab[i];
word.stats = word.stats || {};
word.stats.seen = Number(word.stats.seen || 0) + 1;
word.stats.correct = Number(word.stats.correct || 0) + 1;
word.stats.streak = Math.max(2, Number(word.stats.streak || 0) + 1);
word.stats.bestStreak = Math.max(Number(word.stats.bestStreak || 0), word.stats.streak);
word.stats.masteryLevel = Math.max(3, Number(word.stats.masteryLevel || 0) + 1);
word.stats.lastReviewed = new Date().toISOString();
word.stats.nextReview = nextReviewDate(word.stats, true);
word.mastered = word.stats.masteryLevel >= 5;
wrongWords = wrongWords.filter(item => item.eng !== word.eng);
syncWordUpdate(i);
}

function markWordHard(i) {
if (!vocab[i]) return;

let word = vocab[i];
word.stats = word.stats || {};
word.stats.seen = Number(word.stats.seen || 0) + 1;
word.stats.wrong = Number(word.stats.wrong || 0) + 1;
word.stats.streak = 0;
word.stats.masteryLevel = Math.max(0, Number(word.stats.masteryLevel || 0) - 1);
word.stats.lastReviewed = new Date().toISOString();
word.stats.nextReview = nextReviewDate(word.stats, false);
word.mastered = false;

if (!wrongWords.some(item => item.eng === word.eng)) {
wrongWords.push(normalizeWord(word));
}

syncWordUpdate(i);
}

function deleteWord(i) {
let word = vocab[i];
vocab.splice(i, 1);

if (word) {
wrongWords = wrongWords.filter(w => w.eng !== word.eng);
}

save();
renderTable();

let topWrong = document.getElementById("totalWrongWordsTop");
if (topWrong) topWrong.innerText = wrongWords.length;

Promise.resolve(window.quizCloud?.deleteWord(word)).catch((error) => {
  console.warn("[SYNC] Cloud delete request failed; delete remains queued for retry.", error);
});
}

function clearMastered() {
let count = wrongWords.filter(w => w.mastered).length;

if (count === 0) {
alert("No mastered words to clear!");
return;
}

if (!confirm(`Delete ${count} mastered words?`)) return;

wrongWords = wrongWords.filter(w => !w.mastered);

save();
renderMistakeTable();
}

function shuffle(array) {
for (let i = array.length - 1; i > 0; i--) {
let j = Math.floor(Math.random() * (i + 1));
[array[i], array[j]] = [array[j], array[i]];
}

return array;
}

function removeWrongWord(eng) {
wrongWords = wrongWords.filter(w => w.eng !== eng);
save();
renderMistakeTable();
}
