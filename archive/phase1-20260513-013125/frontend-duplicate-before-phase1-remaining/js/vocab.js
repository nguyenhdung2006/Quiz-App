function normalizeWord(word) {
let stats = word?.stats || {};

return {
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
bestStreak: Number(stats.bestStreak || 0)
}
};
}

function getMasteryLabel(word) {
let stats = word?.stats || {};

if (word.mastered || stats.streak >= 5) return "Mastered";
if ((stats.wrong || 0) > (stats.correct || 0)) return "Review";
if ((stats.streak || 0) >= 2 || (stats.correct || 0) >= 3) return "Learning";
return "New";
}

function recordWordResult(word, isCorrect) {
let target = vocab.find(w => w.eng === word.eng);
if (!target) return;

target.stats = target.stats || { seen: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0 };
target.stats.seen++;

if (isCorrect) {
target.stats.correct++;
target.stats.streak++;
target.stats.bestStreak = Math.max(target.stats.bestStreak || 0, target.stats.streak);
} else {
target.stats.wrong++;
target.stats.streak = 0;
target.mastered = false;
}
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

vocab.push(normalizeWord({ eng, vie, pos, tag, example, note }));

save();
renderTable();

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

function renderTable() {
let table = document.getElementById("tableBody");
table.innerHTML = "";

let query = "";
if (typeof vocabFilterQuery !== "undefined") {
query = String(vocabFilterQuery || "").toLowerCase();
}

let rows = vocab
.map((word, originalIndex) => ({ word: normalizeWord(word), originalIndex }))
.filter(({ word }) => {
if (!query) return true;
return [word.eng, word.vie, word.pos, word.tag, word.example, word.note, getMasteryLabel(word)]
.some(value => String(value || "").toLowerCase().includes(query));
});

let fragment = document.createDocumentFragment();

rows.forEach(({ word: w, originalIndex }) => {
vocab[originalIndex] = w;

let row = document.createElement("tr");
if (w.favorite) row.classList.add("favoriteRow");

let engCell = document.createElement("td");
engCell.className = "engWord";
engCell.textContent = w.eng;
appendMeta(engCell, w);
engCell.addEventListener("click", () => speak(w.eng));

let posCell = document.createElement("td");
posCell.textContent = w.pos;

let tagCell = document.createElement("td");
tagCell.textContent = w.tag || "-";

let vieCell = document.createElement("td");
vieCell.textContent = w.vie;

let levelCell = document.createElement("td");
let level = getMasteryLabel(w);
levelCell.innerHTML = "";
let levelBadge = document.createElement("span");
levelBadge.className = "levelBadge levelBadge--" + level.toLowerCase();
levelBadge.textContent = level;
levelCell.appendChild(levelBadge);

let actionCell = document.createElement("td");
actionCell.className = "actionCell";

let favoriteBtn = document.createElement("button");
favoriteBtn.className = "actionBtn favoriteAction";
favoriteBtn.type = "button";
favoriteBtn.textContent = w.favorite ? "Starred" : "Star";
favoriteBtn.title = "Toggle favorite";
favoriteBtn.addEventListener("click", () => toggleFavorite(originalIndex));

let speakBtn = document.createElement("button");
speakBtn.className = "actionBtn";
speakBtn.type = "button";
speakBtn.textContent = "Sound";
speakBtn.title = "Speak word";
speakBtn.addEventListener("click", () => speak(w.eng));

let deleteBtn = document.createElement("button");
deleteBtn.className = "actionBtn deleteBtn";
deleteBtn.type = "button";
deleteBtn.textContent = "Delete";
deleteBtn.title = "Delete word";
deleteBtn.addEventListener("click", () => deleteWord(originalIndex));

actionCell.append(favoriteBtn, speakBtn, deleteBtn);
row.append(engCell, posCell, tagCell, vieCell, levelCell, actionCell);
fragment.appendChild(row);
});

table.appendChild(fragment);

totalWords.innerText = vocab.length;

let topWords = document.getElementById("totalWordsTop");
if (topWords) topWords.innerText = vocab.length;

updateDifficulty();
}

function toggleFavorite(i) {
if (!vocab[i]) return;

vocab[i].favorite = !vocab[i].favorite;
save();
renderTable();
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
