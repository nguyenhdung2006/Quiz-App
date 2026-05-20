// App polish layer: preview guide, search, backup, and small UX helpers.
(function () {
const AUTH_API_ORIGIN = "http://localhost:8080";

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
updateProfilePanel();
renderLeaderboard();
}

function getTotalCorrect() {
return getVocab().reduce((sum, word) => sum + Number(word?.stats?.correct || 0), 0);
}

function getBestStreak() {
let streaks = getVocab().map(word => Number(word?.stats?.bestStreak || word?.stats?.streak || 0));
return streaks.length ? Math.max(...streaks, 0) : 0;
}

function updateProfilePanel() {
let words = getVocab();
let mastered = words.filter(word => {
if (word.mastered) return true;
if (typeof getMasteryLabel === "function") return getMasteryLabel(word) === "Mastered";
return false;
}).length;
let xp = words.length * 25 + getTotalCorrect() * 12 + mastered * 50;
let level = Math.max(1, Math.floor(xp / 250) + 1);
let levelProgress = Math.min(100, Math.round((xp % 250) / 250 * 100));
let mastery = words.length ? Math.round(mastered / words.length * 100) : 0;

let profileLevel = document.getElementById("profileLevel");
let profileXp = document.getElementById("profileXp");
let profileXpBar = document.getElementById("profileXpBar");
let profileStreak = document.getElementById("profileStreak");
let profileMastery = document.getElementById("profileMastery");
let profileAchievements = document.getElementById("profileAchievements");

if (profileLevel) profileLevel.textContent = String(level);
if (profileXp) profileXp.textContent = String(xp);
if (profileXpBar) profileXpBar.style.width = levelProgress + "%";
if (profileStreak) profileStreak.textContent = String(getBestStreak());
if (profileMastery) profileMastery.textContent = mastery + "%";
if (profileAchievements) profileAchievements.textContent = String(3 + Math.min(4, Math.floor(words.length / 10)));
}

function renderLeaderboard() {
let list = document.getElementById("leaderboardList");
if (!list) return;

let xp = getVocab().length * 25 + getTotalCorrect() * 12;
let currentPlayer = getCurrentPlayer();
let words = getVocab();
let mastered = words.filter(word => {
if (word.mastered) return true;
if (typeof getMasteryLabel === "function") return getMasteryLabel(word) === "Mastered";
return false;
}).length;
let mastery = words.length ? Math.round(mastered / words.length * 100) : 0;
let weekly = [
{ name: currentPlayer.name || "You", score: xp || 0, tag: "XP" },
{ name: "Best streak", score: getBestStreak(), tag: "days" },
{ name: "Mastery", score: mastery, tag: "%" },
{ name: "Word bank", score: words.length, tag: "words" }
];

list.innerHTML = "";
weekly.forEach((player, index) => {
let item = document.createElement("li");

let rank = document.createElement("span");
rank.className = "leaderRank";
rank.textContent = `#${index + 1}`;

let name = document.createElement("strong");
name.textContent = player.name;

let score = document.createElement("span");
score.textContent = `${player.score} ${player.tag}`;

item.append(rank, name, score);
list.appendChild(item);
});
}

function getCurrentPlayer() {
try {
return JSON.parse(localStorage.getItem("quizUserProfile") || "{}");
} catch (error) {
return {};
}
}

function cacheCurrentPlayer(profile) {
localStorage.setItem("quizUserProfile", JSON.stringify(profile));
}

function setText(id, value) {
let element = document.getElementById(id);
if (element) element.textContent = value;
}

function setImage(id, value) {
let element = document.getElementById(id);
if (element && value) element.src = value;
}

function applyProfile(profile) {
let safeProfile = {
name: profile?.name || "Vocabulary Runner",
email: profile?.email || "Signed in with Google",
avatar: profile?.avatar || "images/icon.png"
};

cacheCurrentPlayer(safeProfile);
setText("profileName", safeProfile.name);
setText("profileNameSmall", safeProfile.name.split(" ")[0] || "Account");
setText("profileMenuName", safeProfile.name);
setText("profileMenuEmail", safeProfile.email);
setImage("profileAvatarSmall", safeProfile.avatar);
setImage("profileMenuAvatar", safeProfile.avatar);
renderLeaderboard();
}

async function loadAuthenticatedProfile() {
let cached = getCurrentPlayer();
if (cached.name || cached.email || cached.avatar) {
applyProfile(cached);
}

try {
let response = await fetch(`${AUTH_API_ORIGIN}/api/me`, {
credentials: "include"
});

if (response.status === 401 || response.status === 403) {
window.location.href = `${AUTH_API_ORIGIN}/oauth2/authorization/google`;
return;
}

if (!response.ok) return;

let profile = await response.json();
if (profile?.authenticated) {
applyProfile(profile);
}
} catch (error) {
toast("Could not sync Google profile. Check that the backend is running.", "warn", 3200);
}
}

function initProfileMenu() {
let trigger = document.getElementById("profileTrigger");
let menu = document.getElementById("profileMenu");
let logoutButtons = [
document.getElementById("logoutBtn"),
document.getElementById("profileLogoutBtn")
].filter(Boolean);
let settingsBtn = document.getElementById("profileSettingsBtn");

if (!trigger || !menu) return;

function closeMenu() {
menu.classList.add("hidden");
trigger.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
let willOpen = menu.classList.contains("hidden");
menu.classList.toggle("hidden", !willOpen);
trigger.setAttribute("aria-expanded", String(willOpen));
}

trigger.addEventListener("click", event => {
event.stopPropagation();
toggleMenu();
});

document.addEventListener("click", event => {
if (!menu.contains(event.target) && event.target !== trigger) closeMenu();
});

document.addEventListener("keydown", event => {
if (event.key === "Escape") closeMenu();
});

logoutButtons.forEach(button => {
button.addEventListener("click", () => {
localStorage.removeItem("quizUserProfile");
window.location.href = `${AUTH_API_ORIGIN}/logout`;
});
});

settingsBtn?.addEventListener("click", () => {
closeMenu();
toast("Settings panel is not available yet.", "warn");
});
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
initProfileMenu();
loadAuthenticatedProfile();
updateStats();

let originalRenderTable = window.renderTable;
if (typeof originalRenderTable === "function") {
window.renderTable = function (...args) {
let result = originalRenderTable.apply(this, args);
updateStats();
return result;
};
}

let originalRenderMistakeTable = window.renderMistakeTable;
if (typeof originalRenderMistakeTable === "function") {
window.renderMistakeTable = function (...args) {
let result = originalRenderMistakeTable.apply(this, args);
updateStats();
return result;
};
}
})();
