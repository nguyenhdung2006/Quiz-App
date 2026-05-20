function startChallenge(time) {
if (vocab.length < 4 || !hasEnoughOptions(modeSelect.value)) {
alert("You need at least 4 unique answers for this challenge mode.");
return;
}

document.getElementById("challengeMenu").classList.remove("show");
startWordSetQuiz(vocab, modeSelect.value, { challenge: true, time });
}
