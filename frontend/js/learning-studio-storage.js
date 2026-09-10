(function (global) {
"use strict";

const HISTORY_KEY = "quizHistory";
const FOCUS_STARTED_KEY = "focusStarted";
const DECK_IMPORTED_KEY = "deckImported";
const storageKey = global.accountStorageKey;
const browserStorage = global.localStorage;

function readJson(key, fallback) {
try {
let raw = browserStorage.getItem(storageKey(key));
return raw ? JSON.parse(raw) : fallback;
} catch (_error) {
return fallback;
}
}

function readHistory() {
return readJson(HISTORY_KEY, []);
}

function hasFocusStarted() {
return browserStorage.getItem(storageKey(FOCUS_STARTED_KEY)) === "true";
}

function hasDeckImported() {
return browserStorage.getItem(storageKey(DECK_IMPORTED_KEY)) === "true";
}

function markFocusStarted() {
browserStorage.setItem(storageKey(FOCUS_STARTED_KEY), "true");
}

function markDeckImported() {
browserStorage.setItem(storageKey(DECK_IMPORTED_KEY), "true");
}

global.WordArenaLearningStudioStorage = Object.freeze({
readHistory,
hasFocusStarted,
hasDeckImported,
markFocusStarted,
markDeckImported
});
})(typeof window !== "undefined" ? window : globalThis);
