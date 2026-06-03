let editingWordIndex = null;

function normalizeWord(word) {
let stats = word?.stats || {};

return {
id: word?.id || null,
eng: String(word?.eng || "").trim(),
vie: String(word?.vie || "").trim(),
pos: String(word?.pos || "n").trim() || "n",
tag: String(word?.tag || "").trim(),
example: String(word?.example || "").trim(),
note: String(word?.note || "").trim(),
favorite: Boolean(word?.favorite),
mastered: Boolean(word?.mastered),
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

function getNextReviewText(word) {
let raw = word?.stats?.nextReview;
if (!raw) return "Ready";

let due = new Date(raw);
if (Number.isNaN(due.getTime())) return "Ready";

let today = new Date();
let startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
let startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
let days = Math.ceil((startDue - startToday) / 86400000);

if (days <= 0) return "Today";
if (days === 1) return "Tomorrow";
return `${days} days`;
}

function recordWordResult(word, isCorrect) {
let target = vocab.find(w => w.eng === word.eng);
if (!target) return;

target.stats = target.stats || {};
target.stats.seen = Number(target.stats.seen || 0) + 1;
target.stats.lastReviewed = new Date().toISOString();

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
}

function addWord() {
let eng = engInput.value.trim();
let vie = vieInput.value.trim();
let pos = posInput.value;
let tag = document.getElementById("tagInput").value.trim();
let example = document.getElementById("exampleInput").value.trim();
let note = document.getElementById("noteInput").value.trim();

if (!eng || !vie) return;

if (vocab.some(w => String(w.eng).toLowerCase() === eng.toLowerCase())) {
alert("Word already exists!");
return;
}

let word = normalizeWord({ eng, vie, pos, tag, example, note });
let localIndex = vocab.push(word) - 1;

save();
renderTable();

Promise.resolve(window.quizCloud?.createWord?.(word)).then(serverWord => {
if (!serverWord) return;
vocab[localIndex] = normalizeWord(serverWord);
save();
renderTable();
});

engInput.value = "";
vieInput.value = "";
document.getElementById("tagInput").value = "";
document.getElementById("exampleInput").value = "";
document.getElementById("noteInput").value = "";
engInput.focus();
}

function appendMeta(parent, word) {
let details = [word.example, word.note].filter(Boolean);
if (!details.length) return;

let meta = document.createElement("div");
meta.className = "wordMeta";
meta.textContent = details.join(" | ");
parent.appendChild(meta);
}

function uniqueSorted(values) {
return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))]
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
favorites: Boolean(document.getElementById("filterFavorites")?.checked)
};
}

function matchesFilters(word, filters) {
let level = getMasteryLabel(word);
let queryText = [word.eng, word.vie, word.pos, word.tag, word.example, word.note, level, getNextReviewText(word)]
.join(" ")
.toLowerCase();

if (filters.query && !queryText.includes(filters.query)) return false;
if (filters.pos && word.pos !== filters.pos) return false;
if (filters.tag && word.tag !== filters.tag) return false;
if (filters.mastery && level !== filters.mastery) return false;
if (filters.favorites && !word.favorite) return false;
return true;
}

function createCellInput(value, className, placeholder = "") {
let input = document.createElement("input");
input.className = className;
input.value = value || "";
input.placeholder = placeholder;
return input;
}

function createEditSelect(value) {
let select = document.createElement("select");
["n", "v", "adj", "adv", "proverb", "idiom"].forEach(pos => {
let option = document.createElement("option");
option.value = pos;
option.textContent = pos;
select.appendChild(option);
});
select.value = value || "n";
return select;
}

function renderEditRow(row, word, originalIndex) {
row.classList.add("editingRow");

let engCell = document.createElement("td");
let engInputEdit = createCellInput(word.eng, "editEng", "English");
engCell.appendChild(engInputEdit);

let posCell = document.createElement("td");
let posInputEdit = createEditSelect(word.pos);
posCell.appendChild(posInputEdit);

let tagCell = document.createElement("td");
let tagInputEdit = createCellInput(word.tag, "editTag", "Tag");
tagCell.appendChild(tagInputEdit);

let vieCell = document.createElement("td");
let vieInputEdit = createCellInput(word.vie, "editVie", "Vietnamese");
vieCell.appendChild(vieInputEdit);

let levelCell = document.createElement("td");
let exampleInputEdit = createCellInput(word.example, "editExample", "Example");
let noteInputEdit = createCellInput(word.note, "editNote", "Note");
levelCell.className = "editMetaCell";
levelCell.append(exampleInputEdit, noteInputEdit);

let reviewCell = document.createElement("td");
reviewCell.textContent = getNextReviewText(word);

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
example: exampleInputEdit.value,
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
row.append(engCell, posCell, tagCell, vieCell, levelCell, reviewCell, actionCell);
}

function renderDisplayRow(row, word, originalIndex) {
if (word.favorite) row.classList.add("favoriteRow");

let engCell = document.createElement("td");
engCell.className = "engWord";
engCell.textContent = word.eng;
appendMeta(engCell, word);
engCell.addEventListener("click", () => speak(word.eng));

let posCell = document.createElement("td");
posCell.textContent = word.pos;

let tagCell = document.createElement("td");
tagCell.textContent = word.tag || "-";

let vieCell = document.createElement("td");
vieCell.textContent = word.vie;

let levelCell = document.createElement("td");
let level = getMasteryLabel(word);
let levelBadge = document.createElement("span");
levelBadge.className = "levelBadge levelBadge--" + level.toLowerCase();
levelBadge.textContent = level;
levelCell.appendChild(levelBadge);

let reviewCell = document.createElement("td");
reviewCell.className = "nextReviewCell";
reviewCell.textContent = getNextReviewText(word);

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

let deleteBtn = document.createElement("button");
deleteBtn.className = "actionBtn deleteBtn";
deleteBtn.type = "button";
deleteBtn.innerHTML = "&times;";
deleteBtn.title = "Delete word";
deleteBtn.setAttribute("aria-label", "Delete word");
deleteBtn.addEventListener("click", () => deleteWord(originalIndex));

actionCell.append(favoriteBtn, speakBtn, editBtn, deleteBtn);
row.append(engCell, posCell, tagCell, vieCell, levelCell, reviewCell, actionCell);
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

totalWords.innerText = vocab.length;

let topWords = document.getElementById("totalWordsTop");
if (topWords) topWords.innerText = vocab.length;

updateDifficulty();
}

function saveEditedWord(i, patch) {
let current = vocab[i];
if (!current) return;

let next = normalizeWord({ ...current, ...patch });
if (!next.eng || !next.vie) {
alert("English and Vietnamese are required.");
return;
}

let duplicate = vocab.some((word, index) =>
index !== i && String(word.eng || "").toLowerCase() === next.eng.toLowerCase()
);
if (duplicate) {
alert("Word already exists!");
return;
}

let oldEng = current.eng;
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

function toggleFavorite(i) {
if (!vocab[i]) return;

vocab[i].favorite = !vocab[i].favorite;
save();
renderTable();

Promise.resolve(window.quizCloud?.updateWord?.(vocab[i])).then(serverWord => {
if (!serverWord) return;
vocab[i] = normalizeWord(serverWord);
save();
renderTable();
});
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

window.quizCloud?.deleteWord(word);
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
