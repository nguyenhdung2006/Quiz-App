/* global getMasteryLabel, hintTimer, normalizeWord, quizDifficulty, removeWrongWord, vocab, wrongWords */
function speak(word) {
speechSynthesis.cancel();

let u = new SpeechSynthesisUtterance(word);
u.lang = "en-US";

speechSynthesis.speak(u);
}

function goHome() {
window.WordArenaQuizAttemptClient?.reset?.();
if (typeof window.showAppPage === "function") {
window.showAppPage("dashboard");
return;
}
location.reload();
}

function closeChallengeMenu(restoreHome = true) {
let menu = document.getElementById("challengeMenu");
if (!menu) return;

menu.classList.remove("show");
menu.classList.add("hidden");

if (restoreHome) {
    document.getElementById("home").classList.remove("hidden");

    let hero = document.querySelector(".heroPanel");
    if (hero) hero.classList.remove("hidden");

    let title = document.querySelector("h1");
    if (title) title.classList.remove("hidden");
}
}

function updateDifficulty() {
let total = vocab.length;

let diff = quizDifficulty;
let easy = diff.querySelector('option[value="10"]');
let medium = diff.querySelector('option[value="20"]');
let hard = diff.querySelector('option[value="30"]');

easy.disabled = total < 10;
medium.disabled = total < 20;
hard.disabled = total < 30;
}

let thinkHintHideTimer = null;

function showThinkHint(text) {
if (!window.quizCanShowThinkHint?.()) return;
let helper = document.getElementById("think-helper");
let bubble = document.getElementById("think-bubble");

bubble.textContent = text;
helper.style.display = "block";

clearTimeout(thinkHintHideTimer);
thinkHintHideTimer = setTimeout(() => {
helper.style.display = "none";
}, 5000);
}

function hideHint() {
clearTimeout(hintTimer);
clearTimeout(thinkHintHideTimer);
document.getElementById("think-helper").style.display = "none";
}

function openChallengeMenu() {
document.getElementById("home").classList.add("hidden");

let hero = document.querySelector(".heroPanel");
if (hero) hero.classList.add("hidden");

let title = document.querySelector("h1");
if (title) title.classList.add("hidden");

let menu = document.getElementById("challengeMenu");
menu.classList.remove("hidden");
menu.classList.add("show");
}

function renderMistakeTable() {
let table = document.getElementById("mistakeTableBody");
let total = document.getElementById("totalWrongWords");
let topWrong = document.getElementById("totalWrongWordsTop");

table.innerHTML = "";
let words = window.getPracticeWrongWords();
total.innerText = words.length;
if (topWrong) topWrong.innerText = words.length;
document.getElementById("mistakePracticeBtn").disabled = words.length === 0;
if (!words.length) {
let row = document.createElement("tr");
let cell = document.createElement("td");
cell.colSpan = 5;
cell.className = "emptyTableCell";
cell.textContent = "No words need another pass. Answered correctly? They leave both mistake views.";
row.appendChild(cell);
table.appendChild(row);
return;
}
window.renderVocabularyTableRows(table, words.map(word => ({
word: normalizeWord(word), originalIndex: vocab.indexOf(word)
})));
}

function deleteMistake(eng) {
removeWrongWord(eng);
renderMistakeTable();
}
