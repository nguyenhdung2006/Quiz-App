import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

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
  const sessionStorage = memoryStorage();
  sessionStorage.setItem("wordArenaStateTabId", tabId);
  const window = {
    localStorage,
    sessionStorage,
    crypto: { randomUUID: () => tabId },
    addEventListener() {},
    dispatchEvent() {},
    URL,
    Math
  };
  const context = vm.createContext({
    window,
    localStorage,
    sessionStorage,
    CustomEvent: class {
      constructor(name, options) {
        this.type = name;
        this.detail = options?.detail;
      }
    },
    URL,
    Math,
    Date,
    JSON,
    String,
    Boolean,
    Map,
    Set,
    console,
    vocab: [],
    wrongWords: []
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

function seedAccount(storage, email, vocab, wrongWords = []) {
  const accountId = String(email).trim().toLowerCase();
  storage.setItem(`quizAccount:${accountId}:vocab`, JSON.stringify(vocab));
  storage.setItem(`quizAccount:${accountId}:wrongWords`, JSON.stringify(wrongWords));
}

{
  const storage = memoryStorage();
  const account = "save@example.com";
  const original = { wordUid: "original", eng: "Original", vie: "cu" };
  const added = { wordUid: "added", eng: "Added", vie: "moi" };
  seedAccount(storage, account, [original]);
  storage.setItem("quizUserProfile", JSON.stringify({ email: account }));
  const tab = storageTab(storage, "successful-save-tab");

  tab.set([original, added]);
  assert.equal(tab.save(), true);
  assert.equal(tab.state().vocab.map(item => item.eng).join(","), "Original,Added");
}

{
  const storage = memoryStorage();
  const account = "retry@example.com";
  const original = { wordUid: "retry-old", eng: "Old", vie: "cu" };
  const pending = { wordUid: "retry-new", eng: "Pending", vie: "moi" };
  seedAccount(storage, account, [original]);
  storage.setItem("quizUserProfile", JSON.stringify({ email: account }));
  const tab = storageTab(storage, "failed-save-tab");
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (String(key).includes(`quizAccount:${account}:localStateTxn:`)) throw new Error("quota");
    originalSetItem(key, value);
  };

  tab.set([original, pending]);
  assert.equal(tab.save(), false);
  assert.equal(tab.state().vocab.map(item => item.eng).join(","), "Old");
  assert.equal(tab.liveState().vocab.map(item => item.eng).join(","), "Old,Pending");

  storage.setItem = originalSetItem;
  assert.equal(tab.save(), true);
  assert.equal(tab.state().vocab.map(item => item.eng).join(","), "Old,Pending");
}

{
  const storage = memoryStorage();
  const accountA = "account-a@example.com";
  const accountB = "account-b@example.com";
  const originalA = { wordUid: "a-old", eng: "A old", vie: "cu" };
  const pendingA = { wordUid: "a-new", eng: "A new", vie: "moi" };
  const wordB = { wordUid: "b", eng: "B", vie: "b" };
  seedAccount(storage, accountA, [originalA]);
  seedAccount(storage, accountB, [wordB]);
  storage.setItem("quizUserProfile", JSON.stringify({ email: accountA }));
  const tabA = storageTab(storage, "account-a-tab");
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (String(key).includes(`quizAccount:${accountA}:localStateTxn:`)) throw new Error("quota");
    originalSetItem(key, value);
  };

  tabA.set([originalA, pendingA]);
  assert.equal(tabA.save(), false);
  storage.setItem("quizUserProfile", JSON.stringify({ email: accountB }));
  const tabB = storageTab(storage, "account-b-tab");
  assert.equal(tabB.state().vocab.map(item => item.eng).join(","), "B");

  storage.setItem = originalSetItem;
  storage.setItem("quizUserProfile", JSON.stringify({ email: accountA }));
  assert.equal(tabA.save(), true);
  assert.equal(tabA.state().vocab.map(item => item.eng).join(","), "A old,A new");
  assert.deepEqual(JSON.parse(storage.getItem(`quizAccount:${accountB}:vocab`)).map(item => item.eng), ["B"]);
}

console.log("Frontend account persistence regression tests passed.");
