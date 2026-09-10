(function (global) {
"use strict";

const ACTIONS = Object.freeze({
"go-home": () => global.goHome?.(),
"start-quiz": () => global.startQuiz?.(),
"add-word": () => global.addWord?.(),
"open-mistake-screen": () => global.openMistakeScreen?.(),
"practice-favorites": () => global.practiceFavorites?.(),
"start-daily-challenge": () => global.startDailyChallenge?.(),
"open-challenge-menu": () => global.openChallengeMenu?.(),
"close-challenge-menu": () => global.closeChallengeMenu?.(),
"prev-question": () => global.prevQuestion?.(),
"submit-answer": () => global.submitAnswer?.(),
"next-question": () => global.nextQuestion?.(),
"open-review-screen": () => global.openReviewScreen?.(),
"show-result-screen": () => global.showResultScreen?.(),
"clear-mastered": () => global.clearMastered?.(),
"practice-wrong": () => global.practiceWrong?.()
});

function dispatch(action, source) {
if (action === "start-challenge") {
global.startChallenge?.(Number(source?.dataset?.challengeSeconds));
return;
}
ACTIONS[action]?.();
}

global.WordArenaUiActions = Object.freeze({ dispatch });
})(typeof window !== "undefined" ? window : globalThis);
