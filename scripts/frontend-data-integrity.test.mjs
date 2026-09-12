import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function runBrowserHelper(file, window = {}) {
window.window = window;
vm.runInNewContext(readFileSync(file, "utf8"), { window, globalThis: window, Date, Map, Object, String });
return window;
}

{
  const window = runBrowserHelper("frontend/js/word-operations.js");
  const operations = window.WordArenaWordOperations;
  const normalize = value => ({ ...value });
  const a = { wordUid: "a", eng: "A" };
  const b = { wordUid: "b", eng: "B" };

  const deleted = operations.begin(a);
  operations.invalidate(a);
  const deletedResult = operations.accept([], deleted, { ...a, eng: "old A" }, normalize);
  assert.equal(deletedResult.applied, false);
  assert.equal(deletedResult.items.length, 0);

  const shifted = operations.begin(a);
  operations.invalidate(a);
  const shiftedResult = operations.accept([b], shifted, { ...a, eng: "old A" }, normalize);
  assert.equal(shiftedResult.applied, false);
  assert.equal(shiftedResult.items[0].eng, "B");

  const oldUpdate = operations.begin(a);
  const newUpdate = operations.begin(a);
  let list = [a];
  list = operations.accept(list, newUpdate, { ...a, eng: "new A" }, normalize).items;
  const late = operations.accept(list, oldUpdate, { ...a, eng: "old A" }, normalize);
  assert.equal(late.applied, false);
  assert.equal(late.items[0].eng, "new A");

  const create = operations.begin(a);
  operations.invalidate(a);
  assert.equal(operations.accept([], create, a, normalize).applied, false);
}

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); }
  };
}

function storageTab(localStorage, tabId) {
  const listeners = {};
  const sessionStorage = memoryStorage();
  sessionStorage.setItem("wordArenaStateTabId", tabId);
  const window = {
    localStorage, sessionStorage, crypto: { randomUUID: () => tabId },
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatchEvent() {},
    URL, Math
  };
  const context = vm.createContext({
    window, localStorage, sessionStorage, CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
    URL, Math, Date, JSON, String, Boolean, Map, Set, console,
    vocab: [], wrongWords: []
  });
  window.window = window;
  vm.runInContext(readFileSync("frontend/js/storage.js", "utf8"), context);
  vm.runInContext("vocab = readAccountArray('vocab'); wrongWords = readAccountArray('wrongWords');", context);
  return {
    context,
    set(vocab, wrongWords = []) {
      context.vocab = structuredClone(vocab);
      context.wrongWords = structuredClone(wrongWords);
    },
    save: () => context.save(),
    state: () => vm.runInContext("readCommittedAccountState()", context),
    liveState: () => vm.runInContext(
      "({ vocab: JSON.parse(JSON.stringify(vocab)), wrongWords: JSON.parse(JSON.stringify(wrongWords)) })",
      context
    )
  };
}

function seed(storage, vocab, wrongWords = []) {
  storage.setItem("quizAccount:local-guest:vocab", JSON.stringify(vocab));
  storage.setItem("quizAccount:local-guest:wrongWords", JSON.stringify(wrongWords));
}

function seedAccount(storage, email, vocab, wrongWords = []) {
  const accountId = String(email).trim().toLowerCase();
  storage.setItem(`quizAccount:${accountId}:vocab`, JSON.stringify(vocab));
  storage.setItem(`quizAccount:${accountId}:wrongWords`, JSON.stringify(wrongWords));
}

{
  const storage = memoryStorage();
  const a = { wordUid: "a", eng: "A", vie: "a" };
  const b = { wordUid: "b", eng: "B", vie: "b" };
  const c = { wordUid: "c", eng: "C", vie: "c" };
  seed(storage, [a]);
  const tabA = storageTab(storage, "tab-a");
  const tabB = storageTab(storage, "tab-b");
  tabA.set([a, b]);
  assert.equal(tabA.save(), true);
  tabB.set([a, c]);
  assert.equal(tabB.save(), true);
  assert.equal(tabB.state().vocab.map(word => word.eng).sort().join(","), "A,B,C");
}

{
  const storage = memoryStorage();
  const a = { wordUid: "a", eng: "A", vie: "a" };
  const b = { wordUid: "b", eng: "B", vie: "b" };
  seed(storage, [a, b]);
  const deletingTab = storageTab(storage, "delete-tab");
  const staleTab = storageTab(storage, "stale-tab");
  deletingTab.set([a]);
  assert.equal(deletingTab.save(), true);
  staleTab.set([a, b]);
  assert.equal(staleTab.save(), true);
  assert.equal(staleTab.state().vocab.map(word => word.eng).join(","), "A");
}

{
  const storage = memoryStorage();
  const oldWord = { wordUid: "a", eng: "A", vie: "old" };
  seed(storage, [oldWord], [oldWord]);
  const tab = storageTab(storage, "atomic-tab");
  const originalSet = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (String(key).endsWith(":wrongWords")) throw new Error("quota");
    originalSet(key, value);
  };
  const nextWord = { ...oldWord, vie: "new" };
  tab.set([nextWord], []);
  assert.equal(tab.save(), true);
  assert.equal(tab.state().vocab[0].vie, "new");
  assert.equal(tab.state().wrongWords.length, 0);

  storage.setItem = (key, value) => {
    if (String(key).includes(":localStateTxn:")) throw new Error("quota");
    originalSet(key, value);
  };
  tab.set([], []);
  assert.equal(tab.save(), false);
  assert.equal(tab.state().vocab[0].vie, "new");
  assert.equal(tab.liveState().vocab.length, 0);
  assert.equal(tab.liveState().wrongWords.length, 0);

  storage.setItem = originalSet;
  assert.equal(tab.save(), true);
  assert.equal(tab.state().vocab.length, 0);
  assert.equal(tab.state().wrongWords.length, 0);
}

{
  const storage = memoryStorage();
  const accountA = "account-a@example.com";
  const accountB = "account-b@example.com";
  const originalA = { wordUid: "account-a-old", eng: "A old", vie: "cu" };
  const pendingA = { wordUid: "account-a-new", eng: "A new", vie: "moi" };
  const wordB = { wordUid: "account-b", eng: "B", vie: "b" };
  seedAccount(storage, accountA, [originalA]);
  seedAccount(storage, accountB, [wordB]);
  storage.setItem("quizUserProfile", JSON.stringify({ email: accountA }));
  const tabA = storageTab(storage, "account-a-tab");
  const originalSet = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (String(key).includes(`quizAccount:${accountA}:localStateTxn:`)) throw new Error("quota");
    originalSet(key, value);
  };

  tabA.set([originalA, pendingA]);
  assert.equal(tabA.save(), false);
  assert.equal(tabA.liveState().vocab.map(item => item.eng).join(","), "A old,A new");

  storage.setItem("quizUserProfile", JSON.stringify({ email: accountB }));
  const tabB = storageTab(storage, "account-b-tab");
  assert.equal(tabB.state().vocab.map(item => item.eng).join(","), "B");

  storage.setItem = originalSet;
  storage.setItem("quizUserProfile", JSON.stringify({ email: accountA }));
  assert.equal(tabA.save(), true);
  assert.equal(tabA.state().vocab.map(item => item.eng).join(","), "A old,A new");
  assert.deepEqual(
    JSON.parse(storage.getItem(`quizAccount:${accountB}:vocab`)).map(item => item.eng),
    ["B"]
  );
}

{
  const window = runBrowserHelper("frontend/js/vocabulary-contract.js");
  const contract = window.WordArenaVocabularyContract;
  const maxima = contract.limits;
  const backendConstraints = readFileSync(
    "backend/src/main/java/com/quizapp/vocab/VocabularyConstraints.java",
    "utf8"
  );
  const javaLimit = name => Number(backendConstraints.match(
    new RegExp(`${name}\\s*=\\s*([\\d_]+)`)
  )?.[1].replaceAll("_", ""));
  assert.equal(maxima.eng, javaLimit("WORD_MAX"));
  assert.equal(maxima.vie, javaLimit("MEANING_MAX"));
  assert.equal(maxima.pos, javaLimit("POS_MAX"));
  assert.equal(maxima.tag, javaLimit("TAG_MAX"));
  assert.equal(maxima.ipa, javaLimit("IPA_MAX"));
  assert.equal(maxima.level, javaLimit("LEVEL_MAX"));
  for (const field of ["context", "example", "exampleMeaning", "collocation",
    "synonyms", "antonyms", "commonMistake", "note"]) {
    assert.equal(maxima[field], javaLimit("DETAIL_MAX"));
  }
  for (const [field, max] of Object.entries(maxima)) {
    const word = { eng: "A", vie: "a", [field]: "x".repeat(max) };
    assert.equal(contract.validate(word).some(error => error.field === field), false, `${field} max boundary`);
    word[field] += "x";
    assert.equal(contract.validate(word).some(error => error.field === field), true, `${field} over max`);
  }

  const appSource = readFileSync("frontend/js/app.js", "utf8");
  const validationSource = appSource.slice(
    appSource.indexOf("function firstSyncValidationFailure("),
    appSource.indexOf("async function syncCloudNow(")
  );
  const invalid = { eng: "bad-note", vie: "x", note: "n".repeat(contract.limits.note + 1) };
  const context = vm.createContext({
    window,
    getVocab: () => [invalid],
    getWrongWords: () => []
  });
  vm.runInContext(validationSource, context);
  assert.match(context.firstSyncValidationFailure(), /bad-note/);
  assert.match(context.firstSyncValidationFailure(), /Note must be 2000 characters or less/);
}

{
  const source = readFileSync("frontend/js/app.js", "utf8");
  const mergeSource = source.slice(source.indexOf("function wordUpdatedTime("), source.indexOf("function mergeWordLists("));
  const context = vm.createContext({ normalizeWord: word => word, Date, Math });
  vm.runInContext(mergeSource, context);
  const older = "2026-01-01T00:00:00.000Z";
  const newer = "2026-01-02T00:00:00.000Z";
  assert.equal(context.chooseMergedWord({ wordUid: "a", note: "", updatedAt: newer },
    { wordUid: "a", note: "old", updatedAt: older }).note, "");
  assert.equal(context.chooseMergedWord({ wordUid: "a", note: "old", updatedAt: older },
    { wordUid: "a", note: "", updatedAt: newer }).note, "");
}

{
  const window = runBrowserHelper("frontend/js/date-utils.js");
  const due = window.WordArenaDateUtils.isDueToday;
  const now = new Date(2026, 8, 6, 12, 0, 0);
  assert.equal(due(new Date(2026, 8, 6, 8, 0, 0), now), true);
  assert.equal(due(now, now), true);
  assert.equal(due(new Date(2026, 8, 6, 23, 59, 59), now), true);
  assert.equal(due(new Date(2026, 8, 7, 0, 0, 0), now), false);
  const offsetTonight = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T23:00:00${new Date().getTimezoneOffset() <= 0 ? "+" : "-"}${String(Math.floor(Math.abs(new Date().getTimezoneOffset()) / 60)).padStart(2, "0")}:${String(Math.abs(new Date().getTimezoneOffset()) % 60).padStart(2, "0")}`);
  assert.equal(due(offsetTonight, now), true);
  assert.equal(due("not-a-date", now), false);

  const vocabSource = readFileSync("frontend/js/vocab.js", "utf8");
  const analyticsSource = readFileSync("frontend/js/analytics-dashboard.js", "utf8");
  const appSource = readFileSync("frontend/js/app.js", "utf8");
  assert.match(vocabSource, /WordArenaDateUtils\?\.isDueToday/);
  assert.match(analyticsSource, /WordArenaDateUtils\?\.isDueToday/);
  assert.match(appSource, /WordArenaDateUtils\?\.isDueToday/);
}

console.log("Frontend data integrity regression tests passed.");
