(function (global) {
"use strict";

const limits = Object.freeze({
eng: 255,
vie: 255,
pos: 50,
tag: 100,
ipa: 120,
level: 40,
context: 2000,
example: 2000,
exampleMeaning: 2000,
collocation: 2000,
synonyms: 2000,
antonyms: 2000,
commonMistake: 2000,
note: 2000
});

const labels = Object.freeze({
eng: "English word",
vie: "Vietnamese meaning",
pos: "Part of speech",
tag: "Tag",
ipa: "IPA",
level: "Level",
context: "Context",
example: "Example",
exampleMeaning: "Example meaning",
collocation: "Collocation",
synonyms: "Synonyms",
antonyms: "Antonyms",
commonMistake: "Common mistake",
note: "Note"
});

function validate(word) {
let errors = [];
let eng = String(word?.eng || "").trim();
let vie = String(word?.vie || "").trim();
if (!eng) errors.push({ field: "eng", message: "English word is required." });
if (!vie) errors.push({ field: "vie", message: "Vietnamese meaning is required." });
for (let [field, max] of Object.entries(limits)) {
let value = String(word?.[field] || "");
if (value.length > max) {
errors.push({ field, message: `${labels[field]} must be ${max} characters or less.` });
}
}
return errors;
}

function firstMessage(word) {
return validate(word)[0]?.message || "";
}

global.WordArenaVocabularyContract = Object.freeze({ limits, labels, validate, firstMessage });
})(typeof window !== "undefined" ? window : globalThis);
