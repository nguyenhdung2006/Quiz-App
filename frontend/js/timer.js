function startHintTimer() {
clearTimeout(hintTimer);

hintTimer = setTimeout(() => {
if (!selected) {
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
timeLeft--;

if (timeLeft <= 3) {
document.getElementById("timer").classList.add("timerDanger");
}

updateTimerUI();

if (timeLeft <= 0) {
clearInterval(questionTimer);

checkAnswer();

if (index === quizData.length - 1) {
progress.style.width = "100%";
finishQuiz();
} else {
index++;
loadQuestion();
}
}
}, 1000);
}
