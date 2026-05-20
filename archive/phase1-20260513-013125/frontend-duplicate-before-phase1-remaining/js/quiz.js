function uniqueValues(field) {
return [...new Set(vocab.map(w => String(w[field] || "").trim()).filter(Boolean))];
}

function hasEnoughOptions(mode) {
let engCount = uniqueValues("eng").length;
let vieCount = uniqueValues("vie").length;

if (mode === "eng") return vieCount >= 4;
if (mode === "vie") return engCount >= 4;
return engCount >= 4 && vieCount >= 4;
}

function buildOptionsForQuestion(word, questionMode) {
let answerField = questionMode === "eng" ? "vie" : "eng";
let correct = word[answerField];
let pool = uniqueValues(answerField).filter(value => value !== correct);

if (pool.length < 3) return null;

return shuffle([correct, ...shuffle(pool).slice(0, 3)]);
}

function buildQuizData(words, mode) {
let data = [];

for (let q of words) {
let questionMode = mode;

if (mode === "mixed") {
questionMode = Math.random() < 0.5 ? "eng" : "vie";
}

let options = buildOptionsForQuestion(q, questionMode);
if (!options) return null;

data.push({
word: q,
mode: questionMode,
options
});
}

return data;
}

function startWordSetQuiz(words, mode, options = {}) {
clearInterval(questionTimer);

if (words.length < 4 || !hasEnoughOptions(mode)) {
alert("You need at least 4 unique answers for this mode.");
return;
}

quiz = shuffle([...words]);
quizData = buildQuizData(quiz, mode);

if (!quizData) {
alert("Not enough unique answer choices for this mode.");
return;
}

index = 0;
answers = [];
answered = [];
correctCount = 0;
combo = 0;
maxCombo = 0;

isPracticeMode = Boolean(options.practice);
isChallengeMode = Boolean(options.challenge);

if (options.challenge) {
questionTime = options.time || 15;
document.getElementById("timer").style.display = "block";
} else {
document.getElementById("timer").style.display = "none";
}

document.getElementById("comboDisplay").innerText = "Combo x0";

hideAllScreens();
quizScreen.classList.remove("hidden");

loadQuestion();
}

function startQuiz() {
clearInterval(questionTimer);

progress.style.width = "0%";
combo = 0;
maxCombo = 0;

document.getElementById("comboDisplay").innerText = "Combo x0";
document.getElementById("timer").style.display = "none";
challengeDifficulty.classList.add("hidden");
quizDifficulty.classList.remove("hidden");

isPracticeMode = false;
isChallengeMode = false;

if (vocab.length === 0) {
alert("Please add some words first!");
return;
}

let num = quizDifficulty.value;
let mode = modeSelect.value;

if (vocab.length < 4 || !hasEnoughOptions(mode)) {
alert("You need at least 4 unique answers for this quiz mode.");
return;
}

progress.style.transition = "none";
progress.style.width = "0%";
setTimeout(() => {
progress.style.transition = "width .4s ease";
}, 50);

if (num === "all") {
num = vocab.length;
} else {
num = Number(num);
}

quiz = shuffle([...vocab]).slice(0, num);
quizData = buildQuizData(quiz, mode);

if (!quizData) {
alert("Not enough unique answer choices for this mode.");
return;
}

index = 0;
answers = [];
answered = [];
correctCount = 0;

hideAllScreens();
quizScreen.classList.remove("hidden");

loadQuestion();
}

function practiceWrong() {
clearInterval(questionTimer);

document.getElementById("timer").style.display = "none";

isPracticeMode = true;
isChallengeMode = false;

if (wrongWords.length === 0) {
alert("No wrong words yet!");
return;
}

if (!hasEnoughOptions("mixed")) {
alert("You need at least 4 unique English and Vietnamese answers to practice wrong words.");
return;
}

quiz = shuffle([...wrongWords]);
quizData = buildQuizData(quiz, "mixed");

if (!quizData) {
alert("Not enough unique answer choices for wrong-word practice.");
return;
}

index = 0;
answers = [];
answered = [];
correctCount = 0;

hideAllScreens();
quizScreen.classList.remove("hidden");

loadQuestion();
}

function practiceFavorites() {
let favorites = vocab.filter(w => w.favorite);

if (favorites.length < 4) {
alert("Star at least 4 favorite words first.");
return;
}

startWordSetQuiz(favorites, modeSelect.value, { practice: false });
}

function seededShuffle(array, seedText) {
let seed = 0;
for (let i = 0; i < seedText.length; i++) {
seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
}

let result = [...array];
for (let i = result.length - 1; i > 0; i--) {
seed = (1664525 * seed + 1013904223) >>> 0;
let j = seed % (i + 1);
[result[i], result[j]] = [result[j], result[i]];
}

return result;
}

function startDailyChallenge() {
let today = new Date().toISOString().slice(0, 10);
let dailyWords = seededShuffle(vocab, today).slice(0, Math.min(10, vocab.length));

if (dailyWords.length < 4) {
alert("You need at least 4 words for Daily Challenge.");
return;
}

startWordSetQuiz(dailyWords, "mixed", { challenge: true, time: 15 });
}

function renderQuestionText(questionEl, q, currentIndex, total) {
questionEl.innerHTML = "";

let number = document.createElement("div");
number.className = "qNumber";
number.textContent = `Question ${currentIndex + 1}/${total}`;

let line = document.createElement("div");
let keyword = document.createElement("span");
keyword.className = "keyword";

if (currentMode === "eng") {
line.append('What does "');
keyword.textContent = q.eng;
keyword.addEventListener("click", () => speak(q.eng));
line.append(keyword, '" mean?');
} else {
line.append('What is the English word for "');
keyword.textContent = q.vie;
line.append(keyword, '" ?');
}

questionEl.append(number, line);
}

function loadQuestion() {
document.getElementById("timer").classList.remove("timerDanger");
clearTimeout(hintTimer);

selected = Boolean(answers[index]);

hideHint();
if (!answered[index]) startHintTimer();

let percent = (index / quizData.length) * 100;
progress.style.width = percent + "%";
progressSpark();

let data = quizData[index];
let q = data.word;

currentMode = data.mode;

let opts = data.options;
let correctAnswer = currentMode === "eng" ? q.vie : q.eng;

let questionEl = document.getElementById("question");
let answersDiv = document.getElementById("answers");

renderQuestionText(questionEl, q, index, quizData.length);

answersDiv.innerHTML = "";

opts.forEach((o, i) => {
let div = document.createElement("button");

div.className = "answer";
div.type = "button";
div.innerText = (i + 1) + ". " + o;

div.onclick = () => {
if (answered[index]) return;

document.querySelectorAll(".answer").forEach(a => a.classList.remove("selected"));

div.classList.add("selected");

answers[index] = o;
selected = true;
};

if (answers[index] === o) {
div.classList.add("selected");
}

if (answered[index]) {
div.disabled = true;
div.classList.add("locked");

if (o === correctAnswer) {
div.classList.add("correct");
}

if (answers[index] === o && o !== correctAnswer) {
div.classList.add("wrong");
}
}

answersDiv.appendChild(div);
});

if (index === quizData.length - 1) {
submitBtn.style.display = "inline-block";
nextBtn.style.display = "none";
} else {
submitBtn.style.display = "none";
nextBtn.style.display = "inline-block";
}

backBtn.style.display = index === 0 ? "none" : "inline-block";

if (autoSpeak) {
speak(q.eng);
}

if (isChallengeMode) {
clearInterval(questionTimer);
startQuestionTimer();
}
}

function checkAnswer() {
if (answered[index]) return;

let q = quizData[index].word;
let selectedAnswer = answers[index];
let correct = currentMode === "eng" ? q.vie : q.eng;
let isCorrect = selectedAnswer === correct;

recordWordResult(q, isCorrect);

if (isCorrect) {
correctCount++;
updateCombo(true);

if (isPracticeMode) {
let word = wrongWords.find(w => w.eng === q.eng);
if (word) {
word.mastered = true;
}
}
} else {
updateCombo(false);

wrongWords = wrongWords.filter(w => w.eng !== q.eng);
wrongWords.push({
...q,
mastered: false
});
}

save();
answered[index] = true;
renderMistakeTable();
renderTable();
}

function submitAnswer() {
if (!answers[index]) {
showThinkHint("Hmm... choose one before moving on.");
return;
}

checkAnswer();
loadQuestion();

if (index === quizData.length - 1) {
progress.style.width = "100%";

setTimeout(() => {
fireworks();
screenShake();

setTimeout(() => {
finishQuiz();
}, 1200);
}, 600);
}
}

function finishQuiz() {
clearInterval(questionTimer);
quizScreen.classList.add("hidden");
resultScreen.classList.remove("hidden");

let wrong = quizData.length - correctCount;

document.getElementById("rTotal").innerText = quizData.length;
document.getElementById("rCorrect").innerText = correctCount + "/" + quizData.length;
document.getElementById("rWrong").innerText = wrong;

let score10 = correctCount / quizData.length * 10;
score10 = Number(score10.toFixed(2));

let scoreEl = document.getElementById("score");
let gradeEl = document.getElementById("grade");
let commentEl = document.getElementById("comment");

scoreEl.innerText = score10 + " / 10";
scoreEl.style.color = "#e67e22";

let gradeText = "";
let commentText = "";
let commentColor = "";

if (score10 >= 9) {
gradeText = "A+";
commentText = "Outstanding work!";
commentColor = "#1f9d55";
} else if (score10 >= 8.5) {
gradeText = "A";
commentText = "Excellent performance!";
commentColor = "#38c172";
} else if (score10 >= 8) {
gradeText = "B+";
commentText = "Great job, keep going!";
commentColor = "#3490dc";
} else if (score10 >= 7) {
gradeText = "B";
commentText = "Solid work!";
commentColor = "#6cb2eb";
} else if (score10 >= 6.5) {
gradeText = "C+";
commentText = "You're improving!";
commentColor = "#f6c343";
} else if (score10 >= 5.5) {
gradeText = "C";
commentText = "Good effort!";
commentColor = "#ff922b";
} else if (score10 >= 5) {
gradeText = "D+";
commentText = "Keep practicing!";
commentColor = "#ff6b4a";
} else if (score10 >= 4) {
gradeText = "D";
commentText = "Don't give up!";
commentColor = "#cc5c5c";
} else {
gradeText = "F";
commentText = "Try again, you can do it!";
commentColor = "#e3342f";
}

gradeEl.innerText = "Grade: " + gradeText;
commentEl.innerText = commentText;
commentEl.style.color = commentColor;
commentEl.classList.add("resultComment");
}

function renderReviewList() {
let list = document.getElementById("reviewList");
if (!list) return;

list.innerHTML = "";

quizData.forEach((item, i) => {
let word = normalizeWord(item.word);
let correct = item.mode === "eng" ? word.vie : word.eng;
let picked = answers[i] || "No answer";
let isCorrect = picked === correct;

let card = document.createElement("article");
card.className = "reviewCard " + (isCorrect ? "reviewCard--correct" : "reviewCard--wrong");

let title = document.createElement("h3");
title.textContent = `${i + 1}. ${word.eng}`;

let status = document.createElement("span");
status.className = "reviewStatus";
status.textContent = isCorrect ? "Correct" : "Wrong";

let meta = document.createElement("p");
meta.className = "reviewMeta";
meta.textContent = `${word.pos}${word.tag ? " | " + word.tag : ""}`;

let pickedLine = document.createElement("p");
pickedLine.textContent = "Your answer: " + picked;

let correctLine = document.createElement("p");
correctLine.textContent = "Correct answer: " + correct;

card.append(title, status, meta, pickedLine, correctLine);

if (word.example) {
let example = document.createElement("p");
example.className = "reviewExample";
example.textContent = "Example: " + word.example;
card.appendChild(example);
}

if (word.note) {
let note = document.createElement("p");
note.className = "reviewNote";
note.textContent = "Note: " + word.note;
card.appendChild(note);
}

list.appendChild(card);
});
}

function openReviewScreen() {
renderReviewList();
hideAllScreens();
reviewScreen.classList.remove("hidden");
}

function showResultScreen() {
hideAllScreens();
resultScreen.classList.remove("hidden");
}

function nextQuestion() {
if (!answers[index]) {
showThinkHint("Hmm... choose one before moving on.");
return;
}

checkAnswer();

if (index >= quizData.length - 1) {
submitAnswer();
return;
}

index++;
loadQuestion();
}

function prevQuestion() {
if (index <= 0) return;

index--;
loadQuestion();
}
