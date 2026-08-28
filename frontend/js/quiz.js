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
let word = JSON.parse(JSON.stringify(normalizeWord(q)));
let questionMode = mode;

if (mode === "mixed") {
questionMode = Math.random() < 0.5 ? "eng" : "vie";
}

let options = buildOptionsForQuestion(word, questionMode);
if (!options) return null;

data.push({
word,
mode: questionMode,
prompt: questionMode === "eng" ? word.eng : word.vie,
correctAnswer: questionMode === "eng" ? word.vie : word.eng,
options: [...options]
});
}

return data;
}

let quizInputLocked = false;
let quizFinishing = false;
let quizStarting = false;
let quizAccountId = null;

function quizUsesIssuedAttempt() {
let clientState = window.WordArenaQuizAttemptClient?.state?.();
return Boolean(clientState?.attemptId
&& Array.isArray(quizData)
&& quizData.length > 0
&& quizData.every(item => Number.isInteger(item.attemptOrdinal)));
}

async function beginPreparedQuiz(preparedQuiz, preparedData, options = {}) {
if (quizStarting) return false;
quizStarting = true;
try {
let accountId = window.getCurrentAccountId();
let kind = options.kind || (options.challenge ? "challenge" : "quiz");
let issueResult = await window.WordArenaQuizAttemptClient?.issue?.({
quizMode: kind,
challengeSeconds: options.challenge ? (options.time || 15) : null,
items: preparedData.map(item => ({
wordId: item.word.id,
questionMode: item.mode,
expectedPrompt: item.prompt
}))
});
if (issueResult?.cancelled || accountId !== window.getCurrentAccountId()) return false;

quizAccountId = accountId;
quiz = preparedQuiz;
quizData = preparedData.map((item, ordinal) => {
let issued = issueResult?.online ? issueResult.items[ordinal] : null;
return {
...item,
prompt: issued?.prompt || item.prompt,
attemptOrdinal: issued?.ordinal
};
});

index = 0;
answers = [];
answered = [];
correctCount = 0;
combo = 0;
maxCombo = 0;
quizInputLocked = false;
quizFinishing = false;
isPracticeMode = Boolean(options.practice);
isChallengeMode = Boolean(options.challenge);
window.currentQuizKind = kind;

if (options.challenge) {
questionTime = options.time || 15;
document.getElementById("timer").hidden = false;
} else {
document.getElementById("timer").hidden = true;
}

document.getElementById("comboDisplay").innerText = "Combo x0";
hideAllScreens();
quizScreen.classList.remove("hidden");
loadQuestion();
return true;
} finally {
quizStarting = false;
}
}

function isQuizActive() {
return quizScreen && !quizScreen.classList.contains("hidden") && Array.isArray(quizData) && quizData.length > 0;
}

function setAnswerButtonsLocked(locked) {
document.querySelectorAll("#answers .answer").forEach(button => {
button.disabled = locked;
button.classList.toggle("locked", locked);
button.setAttribute("aria-disabled", String(locked));
});
}

function lockCurrentQuestionInput() {
quizInputLocked = true;
setAnswerButtonsLocked(true);
}

function renderQuestionFeedback(feedbackEl, picked, correctAnswer) {
if (!feedbackEl) return;

let isCorrect = picked === correctAnswer;
feedbackEl.textContent = isCorrect ? "Correct. Press Enter or Next to continue." : `Wrong. Correct answer: ${correctAnswer}`;
feedbackEl.className = "questionFeedback";
feedbackEl.classList.add(isCorrect ? "questionFeedback--correct" : "questionFeedback--wrong");
}

function chooseAnswer(option) {
if (!isQuizActive() || quizInputLocked || answered[index] || quizFinishing) return;

answers[index] = option;
selected = true;
lockCurrentQuestionInput();
checkAnswer();
loadQuestion();
quizScreen.setAttribute("tabindex", "-1");
quizScreen.focus({ preventScroll: true });
}

function chooseAnswerByIndex(optionIndex) {
if (!isQuizActive() || optionIndex < 0 || optionIndex > 3) return false;

let buttons = document.querySelectorAll("#answers .answer");
if (!buttons[optionIndex] || buttons[optionIndex].disabled) return false;

buttons[optionIndex].click();
return true;
}

function continueQuiz() {
if (!isQuizActive() || quizFinishing) return false;

if (!answers[index]) {
showThinkHint("Hmm... choose one before moving on.");
return true;
}

if (!answered[index]) {
lockCurrentQuestionInput();
checkAnswer();
loadQuestion();
return true;
}

if (index >= quizData.length - 1) {
submitAnswer();
return true;
}

nextQuestion();
return true;
}

async function startWordSetQuiz(words, mode, options = {}) {
clearInterval(questionTimer);

if (words.length < 4 || !hasEnoughOptions(mode)) {
alert("You need at least 4 unique answers for this mode.");
return;
}

let preparedQuiz = shuffle([...words]);
let preparedData = buildQuizData(preparedQuiz, mode);

if (!preparedData) {
alert("Not enough unique answer choices for this mode.");
return;
}
return beginPreparedQuiz(preparedQuiz, preparedData, options);
}

async function startQuiz() {
clearInterval(questionTimer);

progress.style.width = "0%";
combo = 0;
maxCombo = 0;

document.getElementById("comboDisplay").innerText = "Combo x0";
document.getElementById("timer").hidden = true;
challengeDifficulty.classList.add("hidden");
quizDifficulty.classList.remove("hidden");

isPracticeMode = false;
isChallengeMode = false;
window.currentQuizKind = "quiz";

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

progress.classList.add("progress--resetting");
progress.style.width = "0%";
setTimeout(() => {
progress.classList.remove("progress--resetting");
}, 50);

if (num === "all") {
num = vocab.length;
} else {
num = Number(num);
}

let preparedQuiz = shuffle([...vocab]).slice(0, num);
let preparedData = buildQuizData(preparedQuiz, mode);

if (!preparedData) {
alert("Not enough unique answer choices for this mode.");
return;
}
return beginPreparedQuiz(preparedQuiz, preparedData, { kind: "quiz" });
}

async function practiceWrong() {
clearInterval(questionTimer);

document.getElementById("timer").hidden = true;

isPracticeMode = true;
isChallengeMode = false;
window.currentQuizKind = "wrong-practice";

if (wrongWords.length === 0) {
alert("No wrong words yet!");
return;
}

if (!hasEnoughOptions("mixed")) {
alert("You need at least 4 unique English and Vietnamese answers to practice wrong words.");
return;
}

let preparedQuiz = shuffle([...wrongWords]);
let preparedData = buildQuizData(preparedQuiz, "mixed");

if (!preparedData) {
alert("Not enough unique answer choices for wrong-word practice.");
return;
}
return beginPreparedQuiz(preparedQuiz, preparedData, { practice: true, kind: "wrong-practice" });
}

function practiceFavorites() {
let favorites = vocab.filter(w => w.favorite);

if (favorites.length < 4) {
alert("Star at least 4 favorite words first.");
return;
}

startWordSetQuiz(favorites, modeSelect.value, { practice: false, kind: "favorites" });
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

startWordSetQuiz(dailyWords, "mixed", { challenge: true, time: 15, kind: "daily" });
}

function renderQuestionText(questionEl, item, currentIndex, total) {
questionEl.innerHTML = "";
let prompt = item.prompt;

let modeBadge = document.createElement("div");
modeBadge.className = "questionModeBadge";
modeBadge.textContent = currentMode === "eng" ? "English to Vietnamese" : "Vietnamese to English";

let number = document.createElement("div");
number.className = "qNumber";
number.textContent = `Question ${currentIndex + 1}/${total}`;

let line = document.createElement("div");
line.className = "questionPrompt";

let keyword = document.createElement("span");
keyword.className = "keyword";

if (currentMode === "eng") {
line.append('What does "');
keyword.textContent = prompt;
keyword.addEventListener("click", () => speak(prompt));
line.append(keyword, '" mean?');
} else {
line.append('What is the English word for "');
keyword.textContent = prompt;
line.append(keyword, '" ?');
}

questionEl.append(modeBadge, number, line);
}

function loadQuestion() {
document.getElementById("timer").classList.remove("timerDanger");
clearTimeout(hintTimer);

selected = Boolean(answers[index]);
quizInputLocked = Boolean(answered[index]) || quizFinishing;

hideHint();
if (!answered[index]) startHintTimer();

let percent = (index / quizData.length) * 100;
progress.style.width = percent + "%";
progressSpark();

let data = quizData[index];
let q = data.word;

currentMode = data.mode;

let opts = data.options;
let correctAnswer = data.correctAnswer;

let questionEl = document.getElementById("question");
let answersDiv = document.getElementById("answers");
let feedbackEl = document.getElementById("questionFeedback");

renderQuestionText(questionEl, data, index, quizData.length);

answersDiv.innerHTML = "";
if (feedbackEl) {
feedbackEl.textContent = "";
feedbackEl.className = "questionFeedback";
}

opts.forEach((o, i) => {
let div = document.createElement("button");

div.className = "answer";
div.type = "button";
div.innerText = (i + 1) + ". " + o;
div.setAttribute("aria-label", `Answer ${i + 1}: ${o}`);
div.setAttribute("aria-pressed", String(answers[index] === o));

div.onclick = () => {
chooseAnswer(o);
};

if (answers[index] === o) {
div.classList.add("selected");
}

if (answered[index]) {
if (o === correctAnswer) {
div.classList.add("correct");
}

if (answers[index] === o && o !== correctAnswer) {
div.classList.add("wrong");
}
}

if (quizInputLocked || answered[index]) {
div.disabled = true;
div.classList.add("locked");
div.setAttribute("aria-disabled", "true");
}

answersDiv.appendChild(div);
});

if (answered[index] && feedbackEl) {
let picked = answers[index];
renderQuestionFeedback(feedbackEl, picked, correctAnswer);
}

if (index === quizData.length - 1) {
submitBtn.hidden = false;
nextBtn.hidden = true;
} else {
submitBtn.hidden = true;
nextBtn.hidden = false;
}

backBtn.hidden = index === 0 || isChallengeMode;

if (autoSpeak) {
speak(q.eng);
}

if (isChallengeMode) {
clearInterval(questionTimer);
startQuestionTimer();
}
}

function recordLocalQuizAnswer(word, isCorrect, practice) {
recordWordResult(word, isCorrect);
if (isCorrect) {
if (practice) {
let wrongWord = wrongWords.find(w => sameWordIdentity(w, word));
if (wrongWord) wrongWord.mastered = true;
}
} else {
wrongWords = wrongWords.filter(w => !sameWordIdentity(w, word));
wrongWords.push({ ...word, stats: { ...word.stats }, mastered: false });
}
}

function captureQuizLocalResultPlan() {
return Object.freeze({
accountId: quizAccountId,
practice: isPracticeMode,
items: Object.freeze(quizData.map((item, ordinal) => Object.freeze({
word: Object.freeze({ ...item.word, stats: Object.freeze({ ...item.word.stats }) }),
selectedAnswer: answers[ordinal] || "",
isCorrect: answers[ordinal] === item.correctAnswer
})))
});
}

function checkAnswer() {
if (answered[index]) return;
if (isChallengeMode) clearInterval(questionTimer);

let q = quizData[index].word;
let selectedAnswer = answers[index];
let correct = quizData[index].correctAnswer;
let isCorrect = selectedAnswer === correct;

if (!quizUsesIssuedAttempt()) {
recordLocalQuizAnswer(q, isCorrect, isPracticeMode);
}

if (isCorrect) {
correctCount++;
updateCombo(true);
} else {
updateCombo(false);
}

if (quizUsesIssuedAttempt()) {
answered[index] = true;
return;
}

save();
answered[index] = true;
renderMistakeTable();
renderTable();
}

function submitAnswer() {
if (quizFinishing) return;

if (!answers[index]) {
showThinkHint("Hmm... choose one before moving on.");
return;
}

checkAnswer();
loadQuestion();

if (index === quizData.length - 1) {
quizFinishing = true;
setAnswerButtonsLocked(true);
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
quizFinishing = false;
quizScreen.classList.add("hidden");
resultScreen.classList.remove("hidden");

let wrong = quizData.length - correctCount;
let score10 = correctCount / quizData.length * 10;
score10 = Number(score10.toFixed(2));
renderQuizOutcome(quizData.length, correctCount, wrong, score10);
}

function renderQuizOutcome(total, correct, wrong, score10) {
document.getElementById("rTotal").innerText = total;
document.getElementById("rCorrect").innerText = correct + "/" + total;
document.getElementById("rWrong").innerText = wrong;

let scoreEl = document.getElementById("score");
let gradeEl = document.getElementById("grade");
let commentEl = document.getElementById("comment");

scoreEl.innerText = score10 + " / 10";

let gradeText = "";
let commentText = "";

if (score10 >= 9) {
gradeText = "A+";
commentText = "Outstanding work!";
} else if (score10 >= 8.5) {
gradeText = "A";
commentText = "Excellent performance!";
} else if (score10 >= 8) {
gradeText = "B+";
commentText = "Great job, keep going!";
} else if (score10 >= 7) {
gradeText = "B";
commentText = "Solid work!";
} else if (score10 >= 6.5) {
gradeText = "C+";
commentText = "You're improving!";
} else if (score10 >= 5.5) {
gradeText = "C";
commentText = "Good effort!";
} else if (score10 >= 5) {
gradeText = "D+";
commentText = "Keep practicing!";
} else if (score10 >= 4) {
gradeText = "D";
commentText = "Don't give up!";
} else {
gradeText = "F";
commentText = "Try again, you can do it!";
}

gradeEl.innerText = "Grade: " + gradeText;
commentEl.innerText = commentText;
commentEl.dataset.grade = gradeText;
commentEl.classList.add("resultComment");
}

function applyAuthoritativeQuizOutcome(outcome) {
if (!outcome) return false;
let total = Number(outcome.totalQuestions);
let correct = Number(outcome.correctAnswers);
let wrong = Number(outcome.wrongAnswers);
let score = Number(outcome.score);
let authoritativeCombo = Number(outcome.maxCombo);
if (![total, correct, wrong, score, authoritativeCombo].every(Number.isFinite)) return false;
correctCount = correct;
maxCombo = authoritativeCombo;
renderQuizOutcome(total, correct, wrong, score);
return true;
}

function renderReviewList() {
let list = document.getElementById("reviewList");
if (!list) return;

list.innerHTML = "";

quizData.forEach((item, i) => {
let word = normalizeWord(item.word);
let correct = item.correctAnswer;
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

if (!isCorrect) {
let explainButton = document.createElement("button");
explainButton.type = "button";
explainButton.className = "aiExplainButton";
explainButton.textContent = "Explain";
explainButton.addEventListener("click", () => {
if (window.aiExplainWrongAnswer) {
window.aiExplainWrongAnswer.open({
word: word.eng,
userAnswer: picked,
correctAnswer: correct,
questionMode: item.mode,
tag: word.tag,
level: word.level,
example: word.example,
note: word.note
}, card, explainButton);
}
});
card.appendChild(explainButton);
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
quizFinishing = false;
hideAllScreens();
resultScreen.classList.remove("hidden");
}

function nextQuestion() {
if (quizFinishing) return;

if (!answers[index]) {
showThinkHint("Hmm... choose one before moving on.");
return;
}

if (!answered[index]) {
lockCurrentQuestionInput();
checkAnswer();
}

if (index >= quizData.length - 1) {
submitAnswer();
return;
}

index++;
quizInputLocked = false;
loadQuestion();
}

function prevQuestion() {
if (index <= 0 || quizFinishing) return;

index--;
loadQuestion();
}
