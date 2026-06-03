let vocab = readLocalArray("vocab");
let wrongWords = readLocalArray("wrongWords");
vocab = vocab.map(normalizeWord).filter(w => w.eng && w.vie);
wrongWords = wrongWords.map(normalizeWord).filter(w => w.eng && w.vie);

let totalWords = document.getElementById("totalWords");

let engInput = document.getElementById("engInput");
let vieInput = document.getElementById("vieInput");
let posInput = document.getElementById("posInput");
let tagInput = document.getElementById("tagInput");
let exampleInput = document.getElementById("exampleInput");
let noteInput = document.getElementById("noteInput");
let home = document.getElementById("home");

let quizScreen = document.getElementById("quizScreen");
let resultScreen = document.getElementById("resultScreen");
let reviewScreen = document.getElementById("reviewScreen");

let isPracticeMode = false;
let quizDifficulty = document.getElementById("quizDifficulty");
let challengeDifficulty = document.getElementById("challengeDifficulty");

let isChallengeMode = false;
let questionTimer = null;
let timeLeft = 10;
let questionTime = 10;

let selected = false;
let hintTimer = null;

let quiz = [];
let quizData = [];

let answers = [];
let answered = [];

let index = 0;
let correctCount = 0;

let combo = 0;
let maxCombo = 0;

let currentMode = "eng";

let progress = document.getElementById("progress");
let submitBtn = document.querySelector(".submitBtn");
let nextBtn = document.querySelector(".nextBtn");
let backBtn = document.querySelector(".backQuestionBtn");

let autoSpeak = false;

/* ===== difficulty & mode ===== */

let difficultySelect = quizDifficulty;
let modeSelect = document.getElementById("modeSelect");

modeSelect.addEventListener("change", function () {

difficultySelect.disabled = false;
updateDifficulty();

});

/* ===== END ===== */

renderTable();

/* ENTER ADD WORD */

engInput.addEventListener("keypress", function (e) {

if (e.key === "Enter") addWord();

});

vieInput.addEventListener("keypress", function (e) {

if (e.key === "Enter") addWord();

});

[tagInput, exampleInput, noteInput].forEach(input => {
if (!input) return;
input.addEventListener("keypress", function (e) {
if (e.key === "Enter") addWord();
});
});

/* KEYBOARD ANSWER */

document.addEventListener("keydown", function (e) {

if (e.key >= "1" && e.key <= "4") {

let i = Number(e.key) - 1;

let answersDiv = document.querySelectorAll(".answer");

if (answersDiv[i]) {

answersDiv[i].click();

}

}

});

document.addEventListener("keydown", function(e){

if(e.key === "Escape"){
    closeChallengeMenu();
}

if(e.key === "Enter" && quizData?.length){

    if(answered[index]) return;

    if(!answers[index]){
        showThinkHint("Hmm... choose one before moving on.");
        return;
    }

    if(index === quizData.length - 1){
        submitAnswer();
    }else{
        nextQuestion();
    }

}
});

function openMistakeScreen() {

document.getElementById("home").classList.add("hidden");
document.querySelector(".heroPanel")?.classList.add("hidden");
document.getElementById("mistakeScreen").classList.remove("hidden");

renderMistakeTable();

}

function hideAllScreens() {
    window.scrollTo(0, 0);
    document.querySelector(".heroPanel")?.classList.add("hidden");
    home.classList.add("hidden");
    quizScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");
    reviewScreen.classList.add("hidden");
    document.getElementById("mistakeScreen").classList.add("hidden");
}

wrongWords = wrongWords.map(w => ({
    ...w,
    mastered: w.mastered || false
}));

let autoSpeakToggle = document.getElementById("autoSpeakToggle");
if (autoSpeakToggle) {
    autoSpeak = localStorage.getItem(accountStorageKey("autoSpeak")) === "true";
    autoSpeakToggle.checked = autoSpeak;
    autoSpeakToggle.addEventListener("change", () => {
        autoSpeak = autoSpeakToggle.checked;
        localStorage.setItem(accountStorageKey("autoSpeak"), autoSpeak ? "true" : "false");
    });
}
