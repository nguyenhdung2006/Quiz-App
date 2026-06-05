function speak(word) {
speechSynthesis.cancel();

let u = new SpeechSynthesisUtterance(word);
u.lang = "en-US";

speechSynthesis.speak(u);
}

function goHome() {
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

function showThinkHint(text) {
let helper = document.getElementById("think-helper");
let bubble = document.getElementById("think-bubble");

bubble.textContent = text;
helper.style.display = "block";

setTimeout(() => {
helper.style.display = "none";
}, 5000);
}

function hideHint() {
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
total.innerText = wrongWords.length;
if (topWrong) topWrong.innerText = wrongWords.length;

let fragment = document.createDocumentFragment();

wrongWords.forEach(w => {
w = normalizeWord(w);
let row = document.createElement("tr");
if (w.mastered) row.classList.add("mastered");

let engCell = document.createElement("td");
engCell.className = "eng";
engCell.textContent = w.mastered ? `${w.eng} mastered` : w.eng;

let posCell = document.createElement("td");
posCell.textContent = w.pos;

let tagCell = document.createElement("td");
tagCell.textContent = w.tag || "-";

let vieCell = document.createElement("td");
vieCell.textContent = w.vie;

let levelCell = document.createElement("td");
let levelBadge = document.createElement("span");
let level = getMasteryLabel(w);
levelBadge.className = "levelBadge levelBadge--" + level.toLowerCase();
levelBadge.textContent = level;
levelCell.appendChild(levelBadge);

let actionCell = document.createElement("td");
actionCell.className = "actionCell";

let speakBtn = document.createElement("button");
speakBtn.className = "actionBtn speakBtn";
speakBtn.type = "button";
speakBtn.innerHTML = "&#9835;";
speakBtn.title = "Speak word";
speakBtn.setAttribute("aria-label", "Speak word");
speakBtn.addEventListener("click", () => speak(w.eng));

let deleteBtn = document.createElement("button");
deleteBtn.className = "actionBtn deleteBtn";
deleteBtn.type = "button";
deleteBtn.innerHTML = "&times;";
deleteBtn.title = "Delete mistake";
deleteBtn.setAttribute("aria-label", "Delete mistake");
deleteBtn.addEventListener("click", () => deleteMistake(w.eng));

actionCell.append(speakBtn, deleteBtn);
row.append(engCell, posCell, tagCell, vieCell, levelCell, actionCell);
fragment.appendChild(row);
});

table.appendChild(fragment);
}

function deleteMistake(eng) {
removeWrongWord(eng);
renderMistakeTable();
}
