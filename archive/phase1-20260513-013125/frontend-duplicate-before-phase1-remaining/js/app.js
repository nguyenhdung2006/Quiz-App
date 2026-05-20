// App polish layer: preview guide, search, backup, and small UX helpers.
(function () {
function getVocab() {
return typeof vocab !== "undefined" && Array.isArray(vocab) ? vocab : [];
}

function getWrongWords() {
return typeof wrongWords !== "undefined" && Array.isArray(wrongWords) ? wrongWords : [];
}

function setData(nextVocab, nextWrongWords) {
vocab = nextVocab;
wrongWords = nextWrongWords;
save();
renderTable();
renderMistakeTable();
updateStats();
}

function updateStats() {
let topWords = document.getElementById("totalWordsTop");
let topWrong = document.getElementById("totalWrongWordsTop");

if (topWords) topWords.textContent = String(getVocab().length);
if (topWrong) topWrong.textContent = String(getWrongWords().length);
}

function ensureToastHost() {
let host = document.querySelector(".toastHost");
if (host) return host;

host = document.createElement("div");
host.className = "toastHost";
document.body.appendChild(host);
return host;
}

function toast(message, kind = "ok", ms = 2200) {
let host = ensureToastHost();
let el = document.createElement("div");
el.className = `toast toast--${kind}`;
el.textContent = message;
host.appendChild(el);

setTimeout(() => {
el.style.opacity = "0";
el.style.transform = "translateY(6px)";
el.style.transition = "all 180ms ease";
setTimeout(() => el.remove(), 220);
}, ms);
}

function initSearch() {
let input = document.getElementById("vocabSearch");
let clearBtn = document.getElementById("clearSearch");

window.vocabFilterQuery = "";
if (!input) return;

function update() {
window.vocabFilterQuery = (input.value || "").trim();
renderTable();
}

input.addEventListener("input", update);
clearBtn?.addEventListener("click", () => {
input.value = "";
input.focus();
update();
});
}

function exportData() {
let data = {
version: 1,
exportedAt: new Date().toISOString(),
vocab: getVocab(),
wrongWords: getWrongWords()
};

let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = `vocab-quiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);

toast("Exported backup JSON.", "ok");
}

function cleanWord(word) {
if (!word || typeof word !== "object") return null;

let cleaned = normalizeWord(word);

if (!cleaned.eng || !cleaned.vie) return null;

return cleaned;
}

function normalizeImported(payload) {
if (!payload) return null;

let importedVocab = [];
let importedWrong = [];

if (Array.isArray(payload)) {
importedVocab = payload;
} else if (typeof payload === "object") {
importedVocab = Array.isArray(payload.vocab) ? payload.vocab : [];
importedWrong = Array.isArray(payload.wrongWords) ? payload.wrongWords : [];
} else {
return null;
}

return {
vocab: importedVocab.map(cleanWord).filter(Boolean),
wrongWords: importedWrong.map(cleanWord).filter(Boolean)
};
}

function mergeByEnglish(base, incoming) {
let merged = [...base];
let existing = new Set(base.map(w => String(w.eng || "").toLowerCase()));

incoming.forEach(w => {
let key = String(w.eng || "").toLowerCase();
if (!key || existing.has(key)) return;
existing.add(key);
merged.push(w);
});

return merged;
}

function initImportExport() {
let exportBtn = document.getElementById("exportBtn");
let importBtn = document.getElementById("importBtn");
let file = document.getElementById("importFile");

exportBtn?.addEventListener("click", exportData);
importBtn?.addEventListener("click", () => file?.click());

file?.addEventListener("change", async () => {
let selectedFile = file.files?.[0];
file.value = "";
if (!selectedFile) return;

try {
let text = await selectedFile.text();
let normalized = normalizeImported(JSON.parse(text));

if (!normalized || normalized.vocab.length === 0) {
toast("Import file has no valid vocab.", "warn");
return;
}

let replace = confirm(
`Import ${normalized.vocab.length} words.\n\nOK = Replace current data\nCancel = Merge into current`
);

if (replace) {
setData(normalized.vocab, normalized.wrongWords);
} else {
setData(
mergeByEnglish(getVocab(), normalized.vocab),
mergeByEnglish(getWrongWords(), normalized.wrongWords)
);
}

toast("Imported successfully.", "ok");
} catch (error) {
toast("Import failed. Please use a valid JSON backup.", "err");
}
});
}

function initPreview() {
let overlay = document.getElementById("appPreview");
let openBtn = document.getElementById("previewBtn");
let closeBtn = document.getElementById("previewCloseBtn");

if (!overlay || !openBtn || !closeBtn) return;

function open() {
overlay.classList.remove("hidden");
document.body.classList.add("modalOpen");
}

function close() {
overlay.classList.add("hidden");
document.body.classList.remove("modalOpen");
}

openBtn.addEventListener("click", open);
closeBtn.addEventListener("click", close);

overlay.addEventListener("click", event => {
if (event.target === overlay) close();
});

document.addEventListener("keydown", event => {
if (event.key === "Escape" && !overlay.classList.contains("hidden")) close();
});
}

initSearch();
initImportExport();
initPreview();
updateStats();
})();
