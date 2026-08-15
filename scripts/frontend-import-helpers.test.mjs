import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("frontend/js/import-helpers.js", "utf8");
const context = vm.createContext({ window: {} });
vm.runInContext(source, context, { filename: "frontend/js/import-helpers.js" });

const helpers = context.window.WordArenaImport;
assert.equal(typeof helpers.normalizeImported, "function");
assert.equal(typeof helpers.importReviewSummary, "function");

let uid = 0;
const helperOptions = {
  cleanWord(word) {
    if (!word || typeof word !== "object") return null;
    const cleaned = helperOptions.normalizeWord(word);
    return cleaned.eng && cleaned.vie ? cleaned : null;
  },
  normalizeEnglishKey(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  },
  normalizeWord(word) {
    return {
      ...word,
      eng: String(word.eng || "").trim(),
      vie: String(word.vie || "").trim(),
      wordUid: word.wordUid || `test-uid-${++uid}`,
    };
  },
  stampWordUpdatedAt(word, timestamp) {
    return { ...word, updatedAt: timestamp };
  },
  importedAt: "2026-08-15T00:00:00.000Z",
};

const normalized = helpers.normalizeImported({
  vocab: [
    { eng: " Alpha ", vie: "local" },
    { eng: "missing meaning" },
    null,
  ],
  wrongWords: [
    { eng: "Mistake", vie: "sai" },
  ],
  cloudSync: { meta: { lastKnownRevision: 99 } },
}, helperOptions);

assert.equal(normalized.vocab.length, 1);
assert.equal(normalized.wrongWords.length, 1);
assert.equal(normalized.invalidCount, 2);
assert.equal(normalized.includesSyncMetadata, true);
assert.equal(normalized.vocab[0].eng, "Alpha");

const mergeResult = helpers.mergeByEnglishWithStats(
  [{ eng: "alpha", vie: "kept", note: "keep-local" }],
  normalized.vocab.concat([{ eng: "Beta", vie: "moi" }]),
  helperOptions
);
assert.equal(mergeResult.added, 1);
assert.equal(mergeResult.skipped, 1);
assert.deepEqual(Array.from(mergeResult.merged, word => word.eng), ["alpha", "Beta"]);
assert.equal(mergeResult.merged[1].updatedAt, helperOptions.importedAt);

const summary = helpers.importReviewSummary(normalized, {
  currentVocab: [{ eng: "alpha", vie: "kept" }],
  currentWrongWords: [],
  pendingDeletes: [{ wordUid: "deleted" }],
}, helperOptions);
assert.equal(summary.currentVocab, 1);
assert.equal(summary.incomingVocab, 1);
assert.equal(summary.duplicates, 1);
assert.equal(summary.mergeFinal, 1);
assert.equal(summary.replaceFinal, 1);
assert.equal(summary.pendingDeletes, 1);
assert.equal(summary.includesSyncMetadata, true);

const replaceState = helpers.buildImportState("replace", normalized, {}, helperOptions);
assert.deepEqual(Array.from(replaceState.vocab, word => word.eng), ["Alpha"]);
assert.deepEqual(Array.from(replaceState.wrongWords, word => word.eng), ["Mistake"]);
assert.equal(replaceState.added, 1);
assert.equal(replaceState.skipped, 0);
assert.equal(replaceState.vocab[0].updatedAt, helperOptions.importedAt);

const mergeState = helpers.buildImportState("merge", normalized, {
  currentVocab: [{ eng: "alpha", vie: "kept", note: "keep-local" }],
  currentWrongWords: [],
}, helperOptions);
assert.deepEqual(Array.from(mergeState.vocab, word => word.eng), ["alpha"]);
assert.equal(mergeState.added, 0);
assert.equal(mergeState.skipped, 1);

console.log("Frontend import helper tests passed.");
