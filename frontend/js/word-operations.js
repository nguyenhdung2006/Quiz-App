(function (global) {
"use strict";

const versions = new Map();

function uid(value) {
return String(value?.wordUid || value?.word_uid || value || "").trim();
}

function begin(word) {
let key = uid(word);
if (!key) return null;
let token = (versions.get(key) || 0) + 1;
versions.set(key, token);
return Object.freeze({ key, token, expectedUpdatedAt: String(word?.updatedAt || word?.updated_at || "") });
}

function invalidate(word) {
let key = uid(word);
if (key) versions.set(key, (versions.get(key) || 0) + 1);
}

function accept(items, operation, serverWord, normalize) {
if (!operation || versions.get(operation.key) !== operation.token) return { applied: false, items };
let responseUid = uid(serverWord);
if (!responseUid || responseUid !== operation.key) return { applied: false, items };
let index = items.findIndex(item => uid(item) === operation.key);
if (index < 0) return { applied: false, items };
let currentUpdatedAt = String(items[index]?.updatedAt || items[index]?.updated_at || "");
if (currentUpdatedAt !== operation.expectedUpdatedAt) return { applied: false, items };
let next = items.slice();
next[index] = normalize(serverWord);
return { applied: true, items: next };
}

global.WordArenaWordOperations = Object.freeze({ begin, invalidate, accept });
})(typeof window !== "undefined" ? window : globalThis);
