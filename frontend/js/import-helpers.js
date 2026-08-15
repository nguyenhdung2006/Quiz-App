(function (global) {
"use strict";

function requireFunction(value, name) {
if (typeof value !== "function") {
throw new TypeError(`${name} helper is required.`);
}
return value;
}

function list(value) {
return Array.isArray(value) ? value : [];
}

function normalizeImported(payload, options = {}) {
const cleanWord = requireFunction(options.cleanWord, "cleanWord");
if (!payload) return null;

let importedVocab;
let importedWrong;
let includesSyncMetadata;

if (Array.isArray(payload)) {
importedVocab = payload;
importedWrong = [];
includesSyncMetadata = false;
} else if (typeof payload === "object") {
importedVocab = Array.isArray(payload.vocab) ? payload.vocab : [];
importedWrong = Array.isArray(payload.wrongWords) ? payload.wrongWords : [];
includesSyncMetadata = Boolean(payload.cloudSync);
} else {
return null;
}

let vocab = importedVocab.map(cleanWord).filter(Boolean);
let wrongWords = importedWrong.map(cleanWord).filter(Boolean);

return {
vocab,
wrongWords,
invalidCount: (importedVocab.length - vocab.length) + (importedWrong.length - wrongWords.length),
includesSyncMetadata
};
}

function mergeByEnglishWithStats(base, incoming, options = {}) {
const normalizeEnglishKey = requireFunction(options.normalizeEnglishKey, "normalizeEnglishKey");
const normalizeWord = requireFunction(options.normalizeWord, "normalizeWord");
const stampWordUpdatedAt = requireFunction(options.stampWordUpdatedAt, "stampWordUpdatedAt");
let merged = [...list(base)];
let existing = new Set(list(base).map(w => normalizeEnglishKey(w.eng)).filter(Boolean));
let added = 0;
let skipped = 0;
let importedAt = options.importedAt || new Date().toISOString();

list(incoming).forEach(w => {
let key = normalizeEnglishKey(w.eng);
if (!key || existing.has(key)) {
skipped++;
return;
}
existing.add(key);
merged.push(stampWordUpdatedAt(normalizeWord(w), importedAt));
added++;
});

return { merged, added, skipped };
}

function mergeByEnglish(base, incoming, options = {}) {
return mergeByEnglishWithStats(base, incoming, options).merged;
}

function importReviewSummary(normalized, state = {}, options = {}) {
let currentVocab = list(state.currentVocab);
let currentWrongWords = list(state.currentWrongWords);
let pendingDeletes = list(state.pendingDeletes);
let vocabResult = mergeByEnglishWithStats(currentVocab, normalized.vocab, options);
let wrongResult = mergeByEnglishWithStats(currentWrongWords, normalized.wrongWords, options);
return {
currentVocab: currentVocab.length,
currentWrong: currentWrongWords.length,
incomingVocab: normalized.vocab.length,
incomingWrong: normalized.wrongWords.length,
invalid: normalized.invalidCount,
duplicates: vocabResult.skipped + wrongResult.skipped,
mergeFinal: vocabResult.merged.length,
replaceFinal: normalized.vocab.length,
pendingDeletes: pendingDeletes.length,
includesSyncMetadata: normalized.includesSyncMetadata
};
}

function buildImportState(mode, normalized, state = {}, options = {}) {
const normalizeWord = requireFunction(options.normalizeWord, "normalizeWord");
const stampWordUpdatedAt = requireFunction(options.stampWordUpdatedAt, "stampWordUpdatedAt");
let importedAt = options.importedAt || new Date().toISOString();
if (mode === "replace") {
return {
vocab: list(normalized.vocab).map(word => stampWordUpdatedAt(normalizeWord(word), importedAt)),
wrongWords: list(normalized.wrongWords).map(word => stampWordUpdatedAt(normalizeWord(word), importedAt)),
added: list(normalized.vocab).length,
skipped: 0
};
}

let vocabResult = mergeByEnglishWithStats(list(state.currentVocab), normalized.vocab, options);
let wrongResult = mergeByEnglishWithStats(list(state.currentWrongWords), normalized.wrongWords, options);
return {
vocab: vocabResult.merged,
wrongWords: wrongResult.merged,
added: vocabResult.added,
skipped: vocabResult.skipped + wrongResult.skipped
};
}

global.WordArenaImport = Object.freeze({
normalizeImported,
mergeByEnglish,
mergeByEnglishWithStats,
importReviewSummary,
buildImportState
});
})(typeof window !== "undefined" ? window : globalThis);
