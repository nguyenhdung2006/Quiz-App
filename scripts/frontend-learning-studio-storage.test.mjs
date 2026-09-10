import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("frontend/js/learning-studio-storage.js", "utf8");
const values = new Map();
let accountId = "user.a@example.com";
const localStorage = {
  getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  }
};
const window = {
  localStorage,
  accountStorageKey(key) {
    return `quizAccount:${accountId}:${key}`;
  }
};
const context = vm.createContext({ window });
vm.runInContext(source, context, { filename: "frontend/js/learning-studio-storage.js" });

const storage = window.WordArenaLearningStudioStorage;
assert.deepEqual(Object.keys(storage).sort(), [
  "hasDeckImported",
  "hasFocusStarted",
  "markDeckImported",
  "markFocusStarted",
  "readHistory"
]);

assert.deepEqual(Array.from(storage.readHistory()), []);
values.set("quizAccount:user.a@example.com:quizHistory", "{not-json");
assert.deepEqual(Array.from(storage.readHistory()), []);
assert.equal(values.get("quizAccount:user.a@example.com:quizHistory"), "{not-json");

const history = [{ score: 8, correctAnswers: 4, totalQuestions: 5, quizMode: "mixed" }];
values.set("quizAccount:user.a@example.com:quizHistory", JSON.stringify(history));
assert.deepEqual(JSON.parse(JSON.stringify(storage.readHistory())), history);

values.set("quizAccount:user.a@example.com:focusStarted", "TRUE");
values.set("quizAccount:user.a@example.com:deckImported", "false");
assert.equal(storage.hasFocusStarted(), false);
assert.equal(storage.hasDeckImported(), false);

storage.markFocusStarted();
storage.markDeckImported();
assert.equal(values.get("quizAccount:user.a@example.com:focusStarted"), "true");
assert.equal(values.get("quizAccount:user.a@example.com:deckImported"), "true");

accountId = "user.b@example.com";
assert.deepEqual(Array.from(storage.readHistory()), []);
assert.equal(storage.hasFocusStarted(), false);
assert.equal(storage.hasDeckImported(), false);
storage.markDeckImported();
assert.equal(values.get("quizAccount:user.b@example.com:deckImported"), "true");
assert.equal(values.get("quizAccount:user.a@example.com:deckImported"), "true");

console.log("Frontend Learning Studio storage tests passed.");
