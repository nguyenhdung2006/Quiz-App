/* global checkAnswer, finishQuiz, hintTimer:writable, index:writable, loadQuestion, progress, questionTime, questionTimer:writable, quizData, selected, showThinkHint, timeLeft:writable */
function startHintTimer() {
clearTimeout(hintTimer);

hintTimer = setTimeout(() => {
if (!selected && window.quizCanShowThinkHint?.()) {
showThinkHint("Hmm... choose one before moving on.");
}
}, 10000);
}

function updateTimerUI() {
let t = document.getElementById("timer");

if (t) {
t.innerText = "Time " + timeLeft;
}
}

function startQuestionTimer() {
clearInterval(questionTimer);

timeLeft = questionTime;
updateTimerUI();

questionTimer = setInterval(() => {
if (!window.isQuizActive?.()) {
clearInterval(questionTimer);
return;
}
timeLeft--;

if (timeLeft <= 3) {
document.getElementById("timer").classList.add("timerDanger");
}

updateTimerUI();

if (timeLeft <= 0) {
clearInterval(questionTimer);

if (index === quizData.length - 1) {
progress.style.width = "100%";
}
window.handleQuizQuestionTimeout();
}
}, 1000);
}
