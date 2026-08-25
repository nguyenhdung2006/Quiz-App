import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("frontend/js/ui-actions.js", "utf8");
const calls = [];
const actionNames = [
  "goHome",
  "startQuiz",
  "addWord",
  "openMistakeScreen",
  "practiceFavorites",
  "startDailyChallenge",
  "openChallengeMenu",
  "closeChallengeMenu",
  "prevQuestion",
  "submitAnswer",
  "nextQuestion",
  "openReviewScreen",
  "showResultScreen",
  "clearMastered",
  "practiceWrong"
];
const window = Object.fromEntries(actionNames.map(name => [name, () => calls.push(name)]));
window.startChallenge = seconds => calls.push(["startChallenge", seconds]);

const context = vm.createContext({ window });
vm.runInContext(source, context, { filename: "frontend/js/ui-actions.js" });

const actions = window.WordArenaUiActions;
assert.deepEqual(Object.keys(actions), ["dispatch"]);

const mappings = {
  "go-home": "goHome",
  "start-quiz": "startQuiz",
  "add-word": "addWord",
  "open-mistake-screen": "openMistakeScreen",
  "practice-favorites": "practiceFavorites",
  "start-daily-challenge": "startDailyChallenge",
  "open-challenge-menu": "openChallengeMenu",
  "close-challenge-menu": "closeChallengeMenu",
  "prev-question": "prevQuestion",
  "submit-answer": "submitAnswer",
  "next-question": "nextQuestion",
  "open-review-screen": "openReviewScreen",
  "show-result-screen": "showResultScreen",
  "clear-mastered": "clearMastered",
  "practice-wrong": "practiceWrong"
};

Object.entries(mappings).forEach(([action, expected]) => {
  calls.length = 0;
  actions.dispatch(action, { dataset: {} });
  assert.deepEqual(calls, [expected]);
});

calls.length = 0;
actions.dispatch("start-challenge", { dataset: { challengeSeconds: "15" } });
assert.deepEqual(calls, [["startChallenge", 15]]);

calls.length = 0;
actions.dispatch("unknown-action", { dataset: {} });
assert.deepEqual(calls, []);

console.log("Frontend UI action registry tests passed.");
