// App polish layer: preview guide, search, backup, and small UX helpers.
(function () {
const AUTH_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";
const API_FETCH = window.quizApiFetch || fetch.bind(window);
const REQUIRE_AUTH = window.quizIsProductionFrontend ? window.quizIsProductionFrontend() : false;
const CLOUD_DELETE_QUEUE_KEY = "cloudDeleteQueue";
const WRONG_BANK_CLEAR_QUEUE_KEY = "wrongBankClearQueue";
const AUTH_PROFILE_RETRY_DELAYS = [500, 1000];
const CLOUD_SYNC_META_KEY = "cloudSyncMeta";
const STALE_SYNC_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_RECOVERY_ENABLED = Boolean(window.QUIZ_APP_CONFIG?.staleRecoveryEnabled);
const DELETE_RETRY_30_SECONDS = 30 * 1000;
const DELETE_RETRY_5_MINUTES = 5 * 60 * 1000;
const DELETE_RETRY_1_HOUR = 60 * 60 * 1000;
const UI_ACTIONS = window.WordArenaUiActions;
let cloudSyncReady = false;
let cloudSyncTimer = null;
let applyingCloudSnapshot = false;
let latestProgressSummary = null;
let latestAchievements = [];
let cloudSyncState = {
hasPulledCloudSnapshot: false,
lastKnownRevision: null,
lastPullAt: null,
lastSuccessfulSyncAt: null,
cloudSnapshotUpdatedAt: null,
hadLocalDataBeforeLastPull: false,
syncReady: false,
pullInFlight: null
};
let staleRecoveryState = {
isOpen: false,
snapshot: null,
openedRevision: null,
lastFocused: null,
busy: false,
backupCreated: false,
message: ""
};
let importReviewState = {
normalized: null,
lastFocused: null,
busy: false
};

const MODAL_FOCUSABLE_SELECTOR = [
"button:not([disabled])",
"[href]",
"input:not([disabled]):not([type='hidden'])",
"select:not([disabled])",
"textarea:not([disabled])",
"[tabindex]:not([tabindex='-1'])"
].join(", ");

function isVisibleFocusable(element) {
return Boolean(element
&& !element.disabled
&& element.tabIndex >= 0
&& (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
}

function createModalFocusManager(overlay, options = {}) {
let lastFocused = null;
overlay.tabIndex = -1;

function focusableElements() {
return Array.from(overlay.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter(isVisibleFocusable);
}

function focusInitial() {
let preferred = typeof options.initialFocus === "function" ? options.initialFocus() : options.initialFocus;
let target = isVisibleFocusable(preferred) ? preferred : focusableElements()[0];
if (target) target.focus();
else overlay.focus();
}

function activate(opener = document.activeElement) {
lastFocused = opener instanceof HTMLElement ? opener : null;
requestAnimationFrame(focusInitial);
}

function restore() {
let fallback = typeof options.restoreFallback === "function" ? options.restoreFallback() : options.restoreFallback;
let target = lastFocused?.isConnected ? lastFocused : fallback;
lastFocused = null;
if (target?.isConnected && typeof target.focus === "function") target.focus();
}

function trapTab(event) {
let focusable = focusableElements();
if (!focusable.length) {
event.preventDefault();
overlay.focus();
return;
}
let first = focusable[0];
let last = focusable[focusable.length - 1];
let active = document.activeElement;
if (!overlay.contains(active)) {
event.preventDefault();
first.focus();
} else if (event.shiftKey && active === first) {
event.preventDefault();
last.focus();
} else if (!event.shiftKey && active === last) {
event.preventDefault();
first.focus();
}
}

document.addEventListener("keydown", event => {
if (overlay.classList.contains("hidden")) return;
if (event.key === "Escape") {
event.preventDefault();
options.close?.();
} else if (event.key === "Tab") {
trapTab(event);
}
});

return { activate, restore };
}

const STARTER_WORDS = [
{ eng: "resilient", vie: "kiên cường", pos: "adj", tag: "mindset", ipa: "/ri-ZIL-yuhnt/", level: "B1", context: "learning after difficulty", example: "She stayed resilient after the hard exam.", exampleMeaning: "Cô ấy vẫn kiên cường sau bài kiểm tra khó.", collocation: "resilient learner, remain resilient", synonyms: "strong, tough", antonyms: "fragile", commonMistake: "Do not use resilient for every kind of strong object.", note: "Useful for school and life." },
{ eng: "curious", vie: "tò mò", pos: "adj", tag: "mindset", ipa: "/KYUR-ee-uhs/", level: "A2", context: "learning attitude", example: "A curious learner asks better questions.", exampleMeaning: "Người học tò mò đặt câu hỏi tốt hơn.", collocation: "curious about, curious learner", synonyms: "interested", antonyms: "indifferent", commonMistake: "Curious about something, not curious with something.", note: "Good learning attitude." },
{ eng: "focus", vie: "tập trung", pos: "v", tag: "study", ipa: "/FOH-kuhs/", level: "A2", context: "study action", example: "Focus on one small step first.", exampleMeaning: "Hãy tập trung vào một bước nhỏ trước.", collocation: "focus on, stay focused", synonyms: "concentrate", antonyms: "distract", commonMistake: "Use focus on, not focus in.", note: "Can be noun or verb." },
{ eng: "review", vie: "ôn lại", pos: "v", tag: "study", ipa: "/ri-VYOO/", level: "A2", context: "spaced repetition", example: "Review the hard words tomorrow.", exampleMeaning: "Hãy ôn lại các từ khó vào ngày mai.", collocation: "review notes, review vocabulary", synonyms: "revise", antonyms: "ignore", commonMistake: "In US English, review often means study again.", note: "Core spaced repetition action." },
{ eng: "progress", vie: "tiến bộ", pos: "n", tag: "study", ipa: "/PRAH-gres/", level: "A2", context: "learning result", example: "Small progress still counts.", exampleMeaning: "Tiến bộ nhỏ vẫn đáng được ghi nhận.", collocation: "make progress, steady progress", synonyms: "improvement", antonyms: "decline", commonMistake: "Say make progress, not do progress.", note: "Motivation word." },
{ eng: "attempt", vie: "cố gắng thử", pos: "v", tag: "exam", ipa: "/uh-TEMPT/", level: "B1", context: "exam task", example: "Attempt every question calmly.", exampleMeaning: "Hãy thử làm mọi câu hỏi một cách bình tĩnh.", collocation: "attempt a question, first attempt", synonyms: "try", antonyms: "avoid", commonMistake: "Attempt is more formal than try.", note: "Try, not necessarily succeed." },
{ eng: "evidence", vie: "bằng chứng", pos: "n", tag: "exam", ipa: "/EV-i-duhns/", level: "B1", context: "essay support", example: "Use evidence to support your answer.", exampleMeaning: "Dùng bằng chứng để ủng hộ câu trả lời.", collocation: "strong evidence, provide evidence", synonyms: "proof", antonyms: "claim", commonMistake: "Evidence is usually uncountable.", note: "Common in essays." },
{ eng: "compare", vie: "so sánh", pos: "v", tag: "exam", ipa: "/kuhm-PAIR/", level: "A2", context: "task verb", example: "Compare the two ideas clearly.", exampleMeaning: "Hãy so sánh hai ý tưởng một cách rõ ràng.", collocation: "compare A with B", synonyms: "contrast", antonyms: "separate", commonMistake: "Use compare A with B for general comparison.", note: "Task verb." },
{ eng: "habit", vie: "thói quen", pos: "n", tag: "daily", ipa: "/HAB-it/", level: "A2", context: "daily routine", example: "A tiny habit can become powerful.", exampleMeaning: "Một thói quen nhỏ có thể trở nên mạnh mẽ.", collocation: "build a habit, daily habit", synonyms: "routine", antonyms: "one-time action", commonMistake: "Habit is a repeated action, not one decision.", note: "Daily routine." },
{ eng: "calm", vie: "bình tĩnh", pos: "adj", tag: "daily", ipa: "/kahm/", level: "A2", context: "emotion", example: "Stay calm before answering.", exampleMeaning: "Hãy giữ bình tĩnh trước khi trả lời.", collocation: "stay calm, calm down", synonyms: "relaxed", antonyms: "anxious", commonMistake: "Calm down can sound direct; be careful in polite speech.", note: "Mood and behavior." }
];

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
refreshOnboardingPanel();
}

function ensureSyncStatus() {
return window.WordArenaSyncStatus.ensureStatus();
}

function setSyncStatus(message, tone = "local") {
  return window.WordArenaSyncStatus.render(message, tone);
}

function initSyncRetry() {
  let btn = document.getElementById("syncRetryBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (typeof window.quizCloud?.syncNow === "function") {
      btn.disabled = true;
      Promise.resolve(retryPendingQuizAttempt())
      .then(() => window.WordArenaReviewOperationClient?.retryPending?.())
      .then(() => window.quizCloud.syncNow()).finally(() => {
        btn.disabled = false;
      });
    }
  });
}

function cloudDeleteQueueKey() {
return typeof accountStorageKey === "function"
? accountStorageKey(CLOUD_DELETE_QUEUE_KEY)
: CLOUD_DELETE_QUEUE_KEY;
}

function readPendingCloudDeletes() {
try {
let raw = localStorage.getItem(cloudDeleteQueueKey());
let items = raw ? JSON.parse(raw) : [];
if (!Array.isArray(items)) return [];
let clean = normalizeDeleteQueue(items);
if (raw && JSON.stringify(items) !== JSON.stringify(clean)) writePendingCloudDeletes(clean);
return clean;
} catch (error) {
return [];
}
}

function normalizeDeleteQueueItem(item, now = new Date().toISOString()) {
let wordUid = typeof item === "object" && item !== null ? item.wordUid : "";
let legacyWordId = typeof item === "object" && item !== null ? (item.legacyWordId || item.wordId || item.id) : item;
wordUid = String(wordUid || "").trim();
legacyWordId = String(legacyWordId || "").trim();
if (!wordUid && legacyWordId) {
let legacyWord = [...getVocab(), ...getWrongWords()].find(word => String(word?.id || "") === legacyWordId);
wordUid = String(legacyWord?.wordUid || "").trim();
}
if (!wordUid && !legacyWordId) return null;

let attempts = Number(item?.attempts || 0);
return {
wordUid: wordUid || null,
legacyWordId: legacyWordId || null,
queuedAt: item?.queuedAt || now,
attempts: Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 0,
lastAttemptAt: item?.lastAttemptAt || null,
lastStatus: item?.lastStatus || "queued",
lastError: item?.lastError || null
};
}

function normalizeDeleteQueue(items) {
let now = new Date().toISOString();
let byId = new Map();
for (let item of Array.isArray(items) ? items : []) {
let clean = normalizeDeleteQueueItem(item, now);
if (!clean) continue;

let key = clean.wordUid ? `uid:${clean.wordUid}` : `legacy:${clean.legacyWordId}`;
let existing = byId.get(key);
if (!existing || clean.attempts > existing.attempts) {
byId.set(key, { ...(existing || {}), ...clean });
}
}
return Array.from(byId.values());
}

function peekPendingCloudDeletes() {
try {
let raw = localStorage.getItem(cloudDeleteQueueKey());
let items = raw ? JSON.parse(raw) : [];
return Array.isArray(items) ? normalizeDeleteQueue(items) : [];
} catch (error) {
return [];
}
}

function writePendingCloudDeletes(items) {
let clean = normalizeDeleteQueue(items);
try {
if (clean.length) {
localStorage.setItem(cloudDeleteQueueKey(), JSON.stringify(clean));
} else {
localStorage.removeItem(cloudDeleteQueueKey());
}
} catch (error) {
// Local-first behavior stays available even if localStorage quota is unavailable.
}
return clean;
}

function wrongBankClearQueueKey() {
return typeof accountStorageKey === "function"
? accountStorageKey(WRONG_BANK_CLEAR_QUEUE_KEY)
: WRONG_BANK_CLEAR_QUEUE_KEY;
}

function readPendingWrongBankClears() {
try {
let raw = localStorage.getItem(wrongBankClearQueueKey());
let items = raw ? JSON.parse(raw) : [];
return Array.from(new Set((Array.isArray(items) ? items : [])
.map(value => String(value || "").trim())
.filter(Boolean)));
} catch (_error) {
return [];
}
}

function writePendingWrongBankClears(items) {
let clean = Array.from(new Set((Array.isArray(items) ? items : [])
.map(value => String(value || "").trim())
.filter(Boolean)));
try {
if (clean.length) localStorage.setItem(wrongBankClearQueueKey(), JSON.stringify(clean));
else localStorage.removeItem(wrongBankClearQueueKey());
} catch (_error) {
// The visible local clear remains usable if storage is temporarily unavailable.
}
return clean;
}

function queueWrongBankClears(words) {
let next = [...readPendingWrongBankClears()];
for (let word of Array.isArray(words) ? words : []) {
let wordUid = String(word?.wordUid || word?.word_uid || "").trim();
if (wordUid) next.push(wordUid);
}
return writePendingWrongBankClears(next);
}

function pendingWrongBankDeletionPayload() {
return readPendingWrongBankClears().map(wordUid => ({ wordUid }));
}

function reconcilePendingWrongBankClears(snapshot) {
if (!Array.isArray(snapshot?.wrongWords)) return;
let remainingCloudUids = new Set(snapshot.wrongWords
.map(word => String(word?.wordUid || word?.word_uid || "").trim())
.filter(Boolean));
writePendingWrongBankClears(readPendingWrongBankClears().filter(wordUid => remainingCloudUids.has(wordUid)));
}

function deleteRetryDelayMs(attempts) {
if (attempts <= 1) return 0;
if (attempts === 2) return DELETE_RETRY_30_SECONDS;
if (attempts === 3) return DELETE_RETRY_5_MINUTES;
return DELETE_RETRY_1_HOUR;
}

function deleteQueueItemReady(item, now = Date.now()) {
let delay = deleteRetryDelayMs(Number(item?.attempts || 0));
if (!delay) return true;
let lastAttempt = parseTime(item?.lastAttemptAt);
return !lastAttempt || now - lastAttempt >= delay;
}

function cloudSyncMetaKey() {
return typeof accountStorageKey === "function"
? accountStorageKey(CLOUD_SYNC_META_KEY)
: CLOUD_SYNC_META_KEY;
}

function readCloudSyncMeta() {
try {
let raw = localStorage.getItem(cloudSyncMetaKey());
let meta = raw ? JSON.parse(raw) : {};
return meta && typeof meta === "object" ? meta : {};
} catch (error) {
return {};
}
}

function writeCloudSyncMeta(patch) {
let next = {
...readCloudSyncMeta(),
...(patch || {})
};
try {
localStorage.setItem(cloudSyncMetaKey(), JSON.stringify(next));
} catch (error) {
// Sync remains safe in memory even if localStorage quota is unavailable.
}
return next;
}

function normalizeRevision(value) {
let revision = Number(value);
return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

function rememberCloudRevision(value) {
let revision = normalizeRevision(value);
if (revision === null) return false;
let currentRevision = normalizeRevision(cloudSyncState.lastKnownRevision);
let nextRevision = currentRevision === null ? revision : Math.max(currentRevision, revision);
cloudSyncState.lastKnownRevision = nextRevision;
writeCloudSyncMeta({ lastKnownRevision: nextRevision });
return true;
}

function restoreCloudSyncMeta() {
let meta = readCloudSyncMeta();
cloudSyncState.lastSuccessfulSyncAt = meta.lastSuccessfulSyncAt || null;
cloudSyncState.lastPullAt = meta.lastPullAt || null;
cloudSyncState.cloudSnapshotUpdatedAt = meta.cloudSnapshotUpdatedAt || null;
cloudSyncState.lastKnownRevision = normalizeRevision(meta.lastKnownRevision);
}

function resetCloudSyncStateForAccount() {
cloudSyncState.hasPulledCloudSnapshot = false;
cloudSyncState.cloudSnapshotUpdatedAt = null;
cloudSyncState.hadLocalDataBeforeLastPull = false;
cloudSyncState.lastKnownRevision = null;
restoreCloudSyncMeta();
}

function parseTime(value) {
let time = Date.parse(value || "");
return Number.isNaN(time) ? 0 : time;
}

function maxTime(values) {
return Math.max(0, ...(values || []).map(parseTime).filter(Boolean));
}

function snapshotUpdatedAt(snapshot) {
let times = [];
for (let word of Array.isArray(snapshot?.vocab) ? snapshot.vocab : []) {
times.push(word?.updatedAt, word?.updated_at, word?.stats?.lastReviewed, word?.stats?.nextReview);
}
for (let word of Array.isArray(snapshot?.wrongWords) ? snapshot.wrongWords : []) {
times.push(word?.updatedAt, word?.updated_at, word?.stats?.lastReviewed, word?.stats?.nextReview);
}
for (let item of Array.isArray(snapshot?.quizHistory) ? snapshot.quizHistory : []) {
times.push(item?.createdAt, item?.created_at);
}
let time = maxTime(times);
return time ? new Date(time).toISOString() : null;
}

function hasLocalSyncData() {
return getVocab().length > 0 || getWrongWords().length > 0;
}

function isStaleDeviceRisk() {
return isStaleDeviceRiskFor(
cloudSyncState.hadLocalDataBeforeLastPull,
cloudSyncState.cloudSnapshotUpdatedAt,
cloudSyncState.lastSuccessfulSyncAt
);
}

function isStaleDeviceRiskFor(hadLocalData, cloudUpdatedAt, lastSuccessfulSyncAt) {
if (!hadLocalData) return false;

let cloudUpdated = parseTime(cloudUpdatedAt);
if (!cloudUpdated) return false;

let lastSync = parseTime(lastSuccessfulSyncAt);
if (!lastSync) return false;

let staleAge = Date.now() - lastSync;
return staleAge > STALE_SYNC_THRESHOLD_MS && cloudUpdated > lastSync;
}

function blockStaleSyncPush(snapshot = staleRecoveryState.snapshot) {
setSyncStatus("Sync paused to protect your data", "warn");
if (STALE_RECOVERY_ENABLED) {
openStaleRecoveryPanel(snapshot);
}
return false;
}

function currentAccountId() {
return typeof getCurrentAccountId === "function" ? getCurrentAccountId() : "local-guest";
}

function cloneJson(value, fallback) {
try {
return JSON.parse(JSON.stringify(value));
} catch (error) {
return fallback;
}
}

function recoveryLocalState() {
return {
accountId: currentAccountId(),
vocab: cloneJson(getVocab(), []),
wrongWords: cloneJson(getWrongWords(), []),
pendingDeletes: cloneJson(readPendingCloudDeletes(), []),
syncMeta: cloneJson(readCloudSyncMeta(), {})
};
}

function restoreRecoveryLocalState(state) {
if (!state || state.accountId !== currentAccountId()) return false;
vocab = cloneJson(state.vocab, []);
wrongWords = cloneJson(state.wrongWords, []);
writePendingCloudDeletes(cloneJson(state.pendingDeletes, []));
try {
localStorage.setItem(cloudSyncMetaKey(), JSON.stringify(cloneJson(state.syncMeta, {})));
} catch (error) {
return false;
}
restoreCloudSyncMeta();
save();
refreshAccountData();
return true;
}

function rememberResponseRevision(response) {
if (!response?.ok) return false;
return rememberCloudRevision(response.headers?.get?.("X-Sync-Revision"));
}

function backupPayload(reason = "manual") {
return {
version: 2,
exportedAt: new Date().toISOString(),
reason,
accountId: currentAccountId(),
vocab: cloneJson(getVocab(), []),
wrongWords: cloneJson(getWrongWords(), []),
cloudSync: {
meta: cloneJson(readCloudSyncMeta(), {}),
pendingDeletes: cloneJson(peekPendingCloudDeletes(), [])
}
};
}

function downloadJsonBackup(payload, filenamePrefix = "vocab-quiz-backup") {
if (window.QUIZ_TEST_FORCE_EXPORT_FAILURE) {
throw new Error("Forced export failure.");
}
let blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
document.body.appendChild(a);
try {
a.click();
} finally {
a.remove();
URL.revokeObjectURL(url);
}
return true;
}

function exportLocalBackup(reason = "manual", filenamePrefix = "vocab-quiz-backup") {
downloadJsonBackup(backupPayload(reason), filenamePrefix);
return true;
}

function snapshotCounts(snapshot) {
return {
vocab: Array.isArray(snapshot?.vocab) ? snapshot.vocab.length : 0,
wrongWords: Array.isArray(snapshot?.wrongWords) ? snapshot.wrongWords.length : 0,
tombstones: Array.isArray(snapshot?.tombstones) ? snapshot.tombstones.length : 0,
pendingDeletes: readPendingCloudDeletes().length
};
}

function recoverySummary(snapshot = staleRecoveryState.snapshot) {
let counts = snapshotCounts(snapshot);
return {
lastSuccessfulSyncAt: cloudSyncState.lastSuccessfulSyncAt || "Unknown",
cloudRevision: normalizeRevision(snapshot?.revision),
localKnownRevision: cloudSyncState.lastKnownRevision,
localWords: getVocab().length,
localWrongWords: getWrongWords().length,
cloudWords: counts.vocab,
cloudWrongWords: counts.wrongWords,
cloudTombstones: counts.tombstones,
pendingDeletes: counts.pendingDeletes,
online: navigator.onLine !== false
};
}

function panelText(value) {
return value === null || value === undefined || value === "" ? "Unknown" : String(value);
}

function ensureStaleRecoveryPanel() {
let panel = document.getElementById("staleRecoveryPanel");
if (panel) return panel;

panel = document.createElement("div");
panel.id = "staleRecoveryPanel";
panel.className = "staleRecoveryOverlay hidden";
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-modal", "true");
panel.setAttribute("aria-labelledby", "staleRecoveryTitle");
panel.innerHTML = `
<section class="staleRecoveryPanel" tabindex="-1">
  <button class="staleRecoveryClose" id="staleRecoveryCloseBtn" type="button" aria-label="Cancel recovery">x</button>
  <div class="staleRecoveryHead">
    <span class="heroEyebrow">Sync paused</span>
    <h2 id="staleRecoveryTitle">Stale Device Recovery</h2>
    <p>Your local deck is older than the latest cloud activity. Push is blocked until you choose a safe path.</p>
  </div>
  <div class="staleRecoverySummary" id="staleRecoverySummary"></div>
  <div class="staleRecoveryActions">
    <button class="utilityBtn" id="staleRecoveryExportBtn" type="button">Export local backup</button>
    <button class="utilityBtn" id="staleRecoveryUseCloudBtn" type="button">Use cloud</button>
    <button class="miniBtn" id="staleRecoveryMergeBtn" type="button" disabled>Merge safely</button>
    <button class="miniBtn" id="staleRecoveryKeepLocalBtn" type="button" disabled>Keep local as new changes</button>
    <button class="miniBtn" id="staleRecoveryCancelBtn" type="button">Cancel</button>
  </div>
  <p class="staleRecoveryNote" id="staleRecoveryDisabledNote">Safe merge and local-as-new require a reliable baseline/change set, which this device does not have yet.</p>
  <p class="staleRecoveryStatus" id="staleRecoveryStatus" role="status" aria-live="polite"></p>
</section>`;
document.body.appendChild(panel);

panel.querySelector("#staleRecoveryExportBtn")?.addEventListener("click", () => {
try {
exportLocalBackup("stale-recovery", "wordarena-stale-local-backup");
staleRecoveryState.backupCreated = true;
setStaleRecoveryStatus("Local backup download started.");
toast("Exported local recovery backup.", "ok");
} catch (error) {
staleRecoveryState.backupCreated = false;
setStaleRecoveryStatus("Backup failed. Local data was not changed.");
toast("Backup failed. Local data was not changed.", "err");
}
});
panel.querySelector("#staleRecoveryUseCloudBtn")?.addEventListener("click", useCloudForStaleRecovery);
panel.querySelector("#staleRecoveryCancelBtn")?.addEventListener("click", closeStaleRecoveryPanel);
panel.querySelector("#staleRecoveryCloseBtn")?.addEventListener("click", closeStaleRecoveryPanel);
panel.addEventListener("keydown", event => {
if (event.key === "Escape" && !staleRecoveryState.busy) {
event.preventDefault();
closeStaleRecoveryPanel();
}
});
return panel;
}

function setStaleRecoveryStatus(message) {
staleRecoveryState.message = message || "";
let status = document.getElementById("staleRecoveryStatus");
if (status) status.textContent = staleRecoveryState.message;
}

function updateStaleRecoveryPanel(snapshot = staleRecoveryState.snapshot) {
let summary = recoverySummary(snapshot);
let host = document.getElementById("staleRecoverySummary");
if (!host) return;
host.innerHTML = "";
let rows = [
["Last successful sync", panelText(summary.lastSuccessfulSyncAt)],
["Local known revision", panelText(summary.localKnownRevision)],
["Cloud revision", panelText(summary.cloudRevision)],
["Local words", String(summary.localWords)],
["Cloud words", String(summary.cloudWords)],
["Wrong-bank local/cloud", `${summary.localWrongWords} / ${summary.cloudWrongWords}`],
["Pending deletions", String(summary.pendingDeletes)],
["Cloud tombstones", String(summary.cloudTombstones)],
["Connection", summary.online ? "Online" : "Offline"]
];
for (let [label, value] of rows) {
let item = document.createElement("div");
item.className = "staleRecoverySummaryItem";
let labelEl = document.createElement("span");
labelEl.textContent = label;
let valueEl = document.createElement("strong");
valueEl.textContent = value;
item.append(labelEl, valueEl);
host.appendChild(item);
}
let useCloud = document.getElementById("staleRecoveryUseCloudBtn");
if (useCloud) useCloud.disabled = staleRecoveryState.busy || !summary.online;
let exportBtn = document.getElementById("staleRecoveryExportBtn");
if (exportBtn) exportBtn.disabled = staleRecoveryState.busy;
}

function openStaleRecoveryPanel(snapshot) {
if (!snapshot) return;
let panel = ensureStaleRecoveryPanel();
staleRecoveryState.isOpen = true;
staleRecoveryState.snapshot = snapshot;
staleRecoveryState.openedRevision = normalizeRevision(snapshot.revision);
staleRecoveryState.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
staleRecoveryState.backupCreated = false;
panel.classList.remove("hidden");
document.body.classList.add("modalOpen");
updateStaleRecoveryPanel(snapshot);
setStaleRecoveryStatus("Export is available. Push remains blocked until recovery succeeds.");
panel.querySelector(".staleRecoveryPanel")?.focus();
}

function closeStaleRecoveryPanel() {
let panel = document.getElementById("staleRecoveryPanel");
if (panel) panel.classList.add("hidden");
document.body.classList.remove("modalOpen");
staleRecoveryState.isOpen = false;
staleRecoveryState.busy = false;
setSyncStatus("Sync paused to protect your data", "warn");
let focusTarget = staleRecoveryState.lastFocused;
if (focusTarget && document.contains(focusTarget)) focusTarget.focus();
}

async function fetchCloudSnapshotRaw() {
if (!cloudSyncReady) return null;
try {
let response = await API_FETCH(`${AUTH_API_ORIGIN}/api/snapshot`);
if (!response.ok) return null;
return await response.json();
} catch (error) {
return null;
}
}

function cloudOnlyWords(words, deleted) {
return (Array.isArray(words) ? words : [])
.filter(word =>
!deleted.uids.has(String(word?.wordUid || word?.word_uid || "").trim())
&& !deleted.legacyIds.has(String(word?.id || ""))
)
.map(fromServerWord)
.filter(word => word.eng && word.vie);
}

function applyCloudSnapshotAuthoritative(snapshot) {
let deleted = tombstoneIdentitySets(snapshot);
let nextVocab = cloudOnlyWords(snapshot?.vocab, deleted);
let nextWrongWords = cloudOnlyWords(snapshot?.wrongWords, deleted);
let now = new Date().toISOString();
let cloudUpdatedAt = snapshotUpdatedAt(snapshot);

vocab = nextVocab;
wrongWords = nextWrongWords;
writePendingCloudDeletes([]);
if (snapshot?.profile) applyProfile(snapshot.profile);
if (snapshot?.progress) latestProgressSummary = snapshot.progress;
if (Array.isArray(snapshot?.achievements)) latestAchievements = snapshot.achievements;
cloudSyncState.hasPulledCloudSnapshot = true;
cloudSyncState.lastPullAt = now;
cloudSyncState.lastSuccessfulSyncAt = now;
cloudSyncState.cloudSnapshotUpdatedAt = cloudUpdatedAt;
cloudSyncState.hadLocalDataBeforeLastPull = false;
rememberCloudRevision(snapshot?.revision);
writeCloudSyncMeta({
lastPullAt: cloudSyncState.lastPullAt,
lastSuccessfulSyncAt: cloudSyncState.lastSuccessfulSyncAt,
cloudSnapshotUpdatedAt: cloudSyncState.cloudSnapshotUpdatedAt
});
save();
refreshAccountData();
}

async function useCloudForStaleRecovery() {
if (staleRecoveryState.busy) return;
if (navigator.onLine === false) {
setStaleRecoveryStatus("You appear offline. Export local backup now, then retry recovery when cloud is reachable.");
return;
}
if (!confirm("Use the latest cloud copy? A local backup download will start first. Local changes are replaced only after backup and cloud fetch succeed.")) {
setStaleRecoveryStatus("Recovery cancelled. Local data was not changed.");
return;
}

let before = recoveryLocalState();
staleRecoveryState.busy = true;
updateStaleRecoveryPanel();
setStaleRecoveryStatus("Preparing local backup...");

try {
exportLocalBackup("stale-recovery-use-cloud", "wordarena-stale-local-backup");
staleRecoveryState.backupCreated = true;
setStaleRecoveryStatus("Checking latest cloud snapshot...");

let latest = await fetchCloudSnapshotRaw();
if (!latest) {
throw new Error("Cloud snapshot unavailable.");
}

let latestRevision = normalizeRevision(latest.revision);
if (staleRecoveryState.openedRevision !== null
&& latestRevision !== null
&& latestRevision !== staleRecoveryState.openedRevision) {
staleRecoveryState.snapshot = latest;
staleRecoveryState.openedRevision = latestRevision;
setStaleRecoveryStatus("Cloud changed while recovery was open. Review the refreshed summary before choosing again.");
return;
}

applyCloudSnapshotAuthoritative(latest);
closeStaleRecoveryPanel();
setSyncStatus("Synced", "ok");
toast("Cloud copy applied after local backup.", "ok");
} catch (error) {
restoreRecoveryLocalState(before);
setSyncStatus("Sync paused to protect your data", "warn");
setStaleRecoveryStatus("Recovery failed. Local data was not changed.");
toast("Recovery failed. Local data was not changed.", "err");
} finally {
staleRecoveryState.busy = false;
updateStaleRecoveryPanel();
}
}

function queuePendingCloudDelete(word) {
let clean = normalizeWord(word || {});
if (!clean.wordUid && !clean.id) return [];
return writePendingCloudDeletes([...readPendingCloudDeletes(), {
wordUid: clean.wordUid || null,
legacyWordId: clean.id || null,
queuedAt: new Date().toISOString(),
attempts: 0,
lastAttemptAt: null,
lastStatus: "queued",
lastError: null
}]);
}

async function flushPendingCloudDeletes() {
let queue = readPendingCloudDeletes();
if (!queue.length) return true;
if (!cloudSyncReady) return false;

let remaining = [];
let now = Date.now();
for (let item of queue) {
if (!deleteQueueItemReady(item, now)) {
remaining.push(item);
continue;
}

let attemptedAt = new Date().toISOString();
try {
let path = item.wordUid
? `/api/vocab/uid/${encodeURIComponent(item.wordUid)}`
: `/api/vocab/${encodeURIComponent(item.legacyWordId)}`;
let response = await API_FETCH(`${AUTH_API_ORIGIN}${path}`, {
method: "DELETE"
});
if (!response.ok && response.status !== 404) {
remaining.push({
...item,
attempts: Number(item.attempts || 0) + 1,
lastAttemptAt: attemptedAt,
lastStatus: "failed",
lastError: `HTTP ${response.status}`
});
} else {
rememberResponseRevision(response);
}
} catch (error) {
remaining.push({
...item,
attempts: Number(item.attempts || 0) + 1,
lastAttemptAt: attemptedAt,
lastStatus: "failed",
lastError: error?.message || "Network error"
});
}
}

  writePendingCloudDeletes(remaining);
  if (remaining.length) {
    setSyncStatus(`Delete pending: ${remaining.length} item(s). Sync will retry automatically.`, "warn");
    return false;
  }
return true;
}

function toServerWord(word) {
let clean = normalizeWord(word);
return {
id: clean.id,
wordUid: clean.wordUid,
eng: clean.eng,
vie: clean.vie,
pos: clean.pos,
tag: clean.tag,
ipa: clean.ipa,
level: clean.level,
context: clean.context,
example: clean.example,
exampleMeaning: clean.exampleMeaning,
collocation: clean.collocation,
synonyms: clean.synonyms,
antonyms: clean.antonyms,
commonMistake: clean.commonMistake,
note: clean.note,
favorite: clean.favorite,
mastered: clean.mastered,
stats: {
...clean.stats,
lastReviewed: clean.stats.lastReviewed || null,
nextReview: clean.stats.nextReview || null
}
};
}

function fromServerWord(word) {
return normalizeWord({
id: word?.id || null,
wordUid: word?.wordUid || word?.word_uid,
eng: word?.eng,
vie: word?.vie,
pos: word?.pos,
tag: word?.tag,
ipa: word?.ipa,
level: word?.level,
context: word?.context,
example: word?.example,
exampleMeaning: word?.exampleMeaning,
collocation: word?.collocation,
synonyms: word?.synonyms,
antonyms: word?.antonyms,
commonMistake: word?.commonMistake,
note: word?.note,
favorite: word?.favorite,
mastered: word?.mastered,
updatedAt: word?.updatedAt,
stats: word?.stats
});
}

function wordMergeKey(word) {
let wordUid = String(word?.wordUid || word?.word_uid || "").trim();
if (wordUid) return `uid:${wordUid}`;
let eng = typeof normalizeEnglishKey === "function"
? normalizeEnglishKey(word?.eng)
: String(word?.eng || "").trim().toLowerCase().replace(/\s+/g, " ");
let id = word?.id ? `id:${word.id}` : "";
return eng ? `eng:${eng}` : id;
}

function wordLegacyEnglishKey(word) {
let eng = typeof normalizeEnglishKey === "function"
? normalizeEnglishKey(word?.eng)
: String(word?.eng || "").trim().toLowerCase().replace(/\s+/g, " ");
return eng ? `eng:${eng}` : "";
}

function wordUpdatedTime(word) {
let candidates = [
word?.updatedAt,
word?.updated_at,
word?.stats?.lastReviewed,
word?.stats?.nextReview
];

for (let value of candidates) {
let time = Date.parse(value || "");
if (!Number.isNaN(time)) return time;
}

return 0;
}

function mergeWordFields(primary, secondary) {
let merged = {
...(secondary || {}),
...(primary || {}),
stats: {
...(secondary?.stats || {}),
...(primary?.stats || {})
}
};

for (let key of ["eng", "vie", "pos", "tag", "ipa", "level", "context", "example", "exampleMeaning", "collocation", "synonyms", "antonyms", "commonMistake", "note", "updatedAt"]) {
if (!merged[key] && secondary?.[key]) merged[key] = secondary[key];
}

return normalizeWord(merged);
}

function chooseMergedWord(localWord, cloudWord) {
if (!localWord) return normalizeWord(cloudWord);
if (!cloudWord) return normalizeWord(localWord);

let localTime = wordUpdatedTime(localWord);
let cloudTime = wordUpdatedTime(cloudWord);

if (localTime && cloudTime) {
return cloudTime >= localTime
? mergeWordFields(cloudWord, localWord)
: mergeWordFields(localWord, cloudWord);
}

if (cloudTime && !localTime) return mergeWordFields(cloudWord, localWord);
if (localTime && !cloudTime) return mergeWordFields(localWord, cloudWord);
return mergeWordFields(cloudWord, localWord);
}

function mergeWordLists(localList, cloudList) {
let merged = new Map();
let legacyEnglishKeys = new Map();

for (let word of Array.isArray(localList) ? localList : []) {
let clean = normalizeWord(word);
let key = wordMergeKey(clean);
if (key && clean.eng && clean.vie) {
merged.set(key, clean);
let legacyKey = wordLegacyEnglishKey(clean);
if (legacyKey && (clean._localGeneratedWordUid || !clean.id)) legacyEnglishKeys.set(legacyKey, key);
}
}

for (let word of Array.isArray(cloudList) ? cloudList : []) {
let clean = fromServerWord(word);
let key = wordMergeKey(clean);
if (!key || !clean.eng || !clean.vie) continue;
let existingKey = key;
let adoptedLegacy = false;
if (!merged.has(existingKey)) {
let legacyKey = wordLegacyEnglishKey(clean);
let legacyExistingKey = legacyEnglishKeys.get(legacyKey);
if (legacyExistingKey && merged.has(legacyExistingKey)) {
existingKey = legacyExistingKey;
adoptedLegacy = true;
}
}
let chosen = chooseMergedWord(merged.get(existingKey), clean);
if (adoptedLegacy && clean.wordUid) {
chosen.wordUid = clean.wordUid;
chosen._localGeneratedWordUid = false;
merged.delete(existingKey);
merged.set(key, chosen);
} else {
merged.set(key, chosen);
}
}

return Array.from(merged.values());
}

function tombstoneIdentitySets(snapshot) {
let tombstones = Array.isArray(snapshot?.tombstones) ? snapshot.tombstones : [];
return {
uids: new Set(tombstones
.map(item => String(item?.wordUid || item?.word_uid || "").trim())
.filter(Boolean)),
legacyIds: new Set(tombstones
.map(item => String(item?.legacyWordId || item?.legacy_word_id || "").trim())
.filter(Boolean))
};
}

function applyTombstonesToLocal(snapshot) {
let deleted = tombstoneIdentitySets(snapshot);
if (!deleted.uids.size && !deleted.legacyIds.size) return deleted;

vocab = getVocab().map(normalizeWord).filter(word =>
!deleted.uids.has(word.wordUid) && !deleted.legacyIds.has(String(word.id || ""))
);
wrongWords = getWrongWords().map(normalizeWord).filter(word =>
!deleted.uids.has(word.wordUid) && !deleted.legacyIds.has(String(word.id || ""))
);
writePendingCloudDeletes(readPendingCloudDeletes().filter(item =>
(!item.wordUid || !deleted.uids.has(item.wordUid))
&& (!item.legacyWordId || !deleted.legacyIds.has(String(item.legacyWordId)))
));
return deleted;
}

function pendingDeletionPayload() {
return readPendingCloudDeletes()
.filter(item => item.wordUid)
.map(item => ({ wordUid: item.wordUid }));
}

function profilePayload() {
let profile = getEditableProfile();
return {
name: profile.name,
avatar: profile.avatar,
birthday: profile.birthday || null,
gender: profile.gender || "",
goal: profile.goal || "",
bio: profile.bio || ""
};
}

function applyServerSnapshot(snapshot, quizResultPlan = null) {
if (!snapshot) return;
if (!rememberCloudRevision(snapshot.revision)) {
cloudSyncState.lastKnownRevision = null;
writeCloudSyncMeta({ lastKnownRevision: null });
}

applyingCloudSnapshot = true;
try {
let deleted = applyTombstonesToLocal(snapshot);
reconcilePendingWrongBankClears(snapshot);
if (snapshot.profile) applyProfile(snapshot.profile);
if (Array.isArray(snapshot.vocab)) {
let cloudVocab = snapshot.vocab.filter(word =>
!deleted.uids.has(String(word?.wordUid || word?.word_uid || "").trim())
&& !deleted.legacyIds.has(String(word?.id || ""))
);
vocab = mergeWordLists(getVocab(), cloudVocab);
}
if (Array.isArray(snapshot.wrongWords)) {
let cloudWrong = snapshot.wrongWords.filter(word =>
!deleted.uids.has(String(word?.wordUid || word?.word_uid || "").trim())
&& !deleted.legacyIds.has(String(word?.id || ""))
);
wrongWords = mergeWordLists(getWrongWords(), cloudWrong);
}
if (quizResultPlan) reconcileQuizLearningSnapshot(snapshot, quizResultPlan);
if (snapshot.progress) latestProgressSummary = snapshot.progress;
if (Array.isArray(snapshot.achievements)) latestAchievements = snapshot.achievements;
save();
refreshAccountData();
} finally {
applyingCloudSnapshot = false;
}
}

async function pullCloudSnapshot() {
if (!cloudSyncReady || applyingCloudSnapshot) return false;
if (cloudSyncState.pullInFlight) return cloudSyncState.pullInFlight;

cloudSyncState.pullInFlight = (async () => {
setSyncStatus("Waiting for cloud snapshot...", "syncing");

try {
let response = await API_FETCH(`${AUTH_API_ORIGIN}/api/snapshot`);

if (!response.ok) {
setSyncStatus("Cloud unavailable", "warn");
return false;
}

let snapshot = await response.json();
let cloudUpdatedAt = snapshotUpdatedAt(snapshot);
let hadLocalData = hasLocalSyncData();
rememberCloudRevision(snapshot.revision);
cloudSyncState.hasPulledCloudSnapshot = true;
cloudSyncState.lastPullAt = new Date().toISOString();
cloudSyncState.cloudSnapshotUpdatedAt = cloudUpdatedAt;
cloudSyncState.hadLocalDataBeforeLastPull = hadLocalData;
writeCloudSyncMeta({
lastPullAt: cloudSyncState.lastPullAt,
cloudSnapshotUpdatedAt: cloudSyncState.cloudSnapshotUpdatedAt
});
if (isStaleDeviceRiskFor(hadLocalData, cloudUpdatedAt, cloudSyncState.lastSuccessfulSyncAt)) {
staleRecoveryState.snapshot = snapshot;
blockStaleSyncPush(snapshot);
return false;
}
applyServerSnapshot(snapshot);
setSyncStatus("Synced", "ok");
return true;
} catch (error) {
setSyncStatus("Offline/local mode", "local");
return false;
} finally {
cloudSyncState.pullInFlight = null;
}
})();

return cloudSyncState.pullInFlight;
}

async function ensureCloudSnapshotBeforePush() {
if (cloudSyncState.hasPulledCloudSnapshot) return true;

setSyncStatus("Waiting for cloud snapshot...", "syncing");
return await pullCloudSnapshot();
}

async function readJsonSafely(response) {
try {
return await response.json();
} catch (error) {
return null;
}
}

async function syncCloudNow(options = {}) {
if (!cloudSyncReady || applyingCloudSnapshot) return;

try {
if (!await ensureCloudSnapshotBeforePush()) return;
if (cloudSyncState.lastKnownRevision === null) {
setSyncStatus("Waiting for cloud revision...", "syncing");
cloudSyncState.hasPulledCloudSnapshot = false;
if (!await pullCloudSnapshot() || cloudSyncState.lastKnownRevision === null) {
setSyncStatus("Cloud unavailable", "warn");
return;
}
}
if (isStaleDeviceRisk()) return blockStaleSyncPush();
setSyncStatus("Syncing...", "syncing");
await flushPendingCloudDeletes();
let response = await API_FETCH(`${AUTH_API_ORIGIN}/api/sync`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
syncContractVersion: 2,
expectedRevision: cloudSyncState.lastKnownRevision,
profile: profilePayload(),
vocab: getVocab().map(toServerWord),
deletions: pendingDeletionPayload(),
wrongWordDeletions: pendingWrongBankDeletionPayload(),
wrongWords: getWrongWords().map(toServerWord)
})
});

  if (response.status === 409) {
    await readJsonSafely(response);
    cloudSyncState.hasPulledCloudSnapshot = false;
    setSyncStatus("Sync conflict detected. Pulling latest cloud data...", "warn");
    let pulled = await pullCloudSnapshot();
    if (pulled && !options.retrying) await syncCloudNow({ retrying: true });
return;
}

if (response.status === 400) {
let error = await readJsonSafely(response);
if (error?.error === "SYNC_CLIENT_UPGRADE_REQUIRED") {
setSyncStatus("Please refresh the app before syncing.", "warn");
return;
}
setSyncStatus("Sync validation failed", "warn");
return;
}

if (!response.ok) {
setSyncStatus("Cloud unavailable", "warn");
return;
}
applyServerSnapshot(await response.json());
cloudSyncState.lastSuccessfulSyncAt = new Date().toISOString();
writeCloudSyncMeta({ lastSuccessfulSyncAt: cloudSyncState.lastSuccessfulSyncAt });
setSyncStatus("Synced", "ok");
} catch (error) {
// Local mode stays usable when the backend is offline.
setSyncStatus("Offline/local mode", "local");
}
}

function scheduleCloudSync() {
if (!cloudSyncReady || applyingCloudSnapshot) return;
if (!cloudSyncState.hasPulledCloudSnapshot) {
pullCloudSnapshot().then(pulled => {
if (pulled) syncCloudNow();
});
return;
}
clearTimeout(cloudSyncTimer);
cloudSyncTimer = setTimeout(syncCloudNow, 700);
}

async function requestJson(path, options = {}) {
if (!cloudSyncReady || applyingCloudSnapshot) return null;

try {
let response = await API_FETCH(`${AUTH_API_ORIGIN}${path}`, {
...options,
headers: { "Content-Type": "application/json", ...(options.headers || {}) }
});

if (!response.ok) return null;
rememberResponseRevision(response);
if (response.status === 204) return {};
return await response.json();
} catch (error) {
return null;
}
}

async function createCloudWord(word) {
let created = await requestJson("/api/vocab", {
method: "POST",
body: JSON.stringify(toServerWord(word))
});
return created ? fromServerWord(created) : null;
}

async function updateCloudWord(word) {
let clean = toServerWord(word);
if (!clean.id) return null;

let updated = await requestJson(`/api/vocab/${clean.id}`, {
method: "PUT",
body: JSON.stringify(clean)
});
return updated ? fromServerWord(updated) : null;
}

function submitReviewAction(word, action, callbacks = {}) {
let clean = normalizeWord(word || {});
return window.WordArenaReviewOperationClient.run({ wordId: clean.id,
action: action === "known" ? "known" : "mark-hard", ...callbacks });
}

async function clearMasteredWrongWords(words) {
queueWrongBankClears(words);
if (!cloudSyncReady) return false;
await syncCloudNow();
return readPendingWrongBankClears().length === 0;
}

async function deleteCloudWord(word) {
let clean = normalizeWord(word || {});
if (!clean.wordUid && !clean.id) return null;

  queuePendingCloudDelete(clean);
  setSyncStatus(`Deleting ${readPendingCloudDeletes().length} item(s)...`, "syncing");
  let flushed = await flushPendingCloudDeletes();
if (!flushed) {
  console.warn("[SYNC] Cloud delete pending; retry will continue automatically.");
  return null;
}
setSyncStatus("Synced", "ok");
return {};
}

async function importCloudSamples() {
let snapshot = await requestJson("/api/admin/sample-words", { method: "POST" });
if (!snapshot) return false;
applyServerSnapshot(snapshot);
return true;
}

window.quizCloud = {
createWord: createCloudWord,
updateWord: updateCloudWord,
deleteWord: deleteCloudWord,
markKnown: (word, callbacks) => submitReviewAction(word, "known", callbacks),
markHard: (word, callbacks) => submitReviewAction(word, "hard", callbacks),
saveLocalReview: () => originalSave(),
clearMasteredWrongWords,
rememberResponseRevision,
importSamples: importCloudSamples,
syncNow: syncCloudNow,
pullNow: pullCloudSnapshot,
isReady: () => cloudSyncReady,
state: () => ({ ...cloudSyncState, pullInFlight: Boolean(cloudSyncState.pullInFlight) })
};

let pendingQuizResultContext = null;

function reconcileQuizLearningSnapshot(snapshot, plan) {
// Only attempt completion overrides local learning; editable-field sync keeps its existing merge rules.
let wordIds = new Set(plan.items.map(item => Number(item.word.id)));
let serverWords = new Map((snapshot.vocab || []).map(word => [Number(word.id), fromServerWord(word)]));
vocab = getVocab().map(word => {
let serverWord = wordIds.has(Number(word.id)) && serverWords.get(Number(word.id));
return serverWord ? { ...word, mastered: serverWord.mastered, stats: { ...serverWord.stats } } : word;
});
let serverWrong = new Map((snapshot.wrongWords || []).map(word => [Number(word.id), fromServerWord(word)]));
wrongWords = getWrongWords().flatMap(word => {
if (!wordIds.has(Number(word.id))) return [word];
let serverWord = serverWrong.get(Number(word.id));
return serverWord ? [serverWord] : [];
});
}

function applyQuizLocalResultOnce(context) {
if (context.localApplied || pendingQuizResultContext !== context
|| context.accountId !== currentAccountId()
|| context.attemptId !== window.WordArenaQuizAttemptClient?.state?.()?.attemptId) return;
for (let item of context.localPlan.items) {
window.recordLocalQuizAnswer(item.word, item.isCorrect, context.localPlan.practice);
}
context.localApplied = true;
// Persist learning only: no sync scheduling, reward mutation, or fabricated revision.
originalSave();
refreshAccountData();
}

function updateRecordedQuizHistory(createdAt, outcome) {
if (!createdAt || !outcome) return;
let history = getQuizHistory();
let entry = history.find(item => item.createdAt === createdAt);
if (!entry) return;
entry.totalQuestions = Number(outcome.totalQuestions);
entry.correctAnswers = Number(outcome.correctAnswers);
entry.wrongAnswers = Number(outcome.wrongAnswers);
entry.score = Number(outcome.score);
entry.maxCombo = Number(outcome.maxCombo);
saveQuizHistory(history);
}

function applyQuizAttemptSubmission(result, context) {
if (!result?.ok || !result.body?.outcome || !result.body?.snapshot) return false;
if (!context || pendingQuizResultContext !== context
|| context.accountId !== currentAccountId()
|| context.attemptId !== result.body.attemptId
|| context.attemptId !== window.WordArenaQuizAttemptClient?.state?.()?.attemptId) return false;
rememberResponseRevision(result.response);
applyServerSnapshot(result.body.snapshot, context.localPlan);
applyAuthoritativeQuizOutcome(result.body.outcome);
updateRecordedQuizHistory(context?.historyCreatedAt, result.body.outcome);
pendingQuizResultContext = null;
updateStats();
setSyncStatus(result.body.replayed ? "Quiz save confirmed (no duplicate reward)" : "Quiz saved securely", "ok");
return true;
}

async function submitIssuedQuizAttempt(context) {
let client = window.WordArenaQuizAttemptClient;
let attemptId = client?.state?.()?.attemptId;
if (!attemptId) return false;
let submissionContext = { ...context, attemptId, accountId: context.localPlan.accountId, localApplied: false };
pendingQuizResultContext = submissionContext;
applyQuizLocalResultOnce(submissionContext);
let result = await client.submit(submissionContext.localPlan.items.map(item => item.selectedAnswer));
return applyQuizAttemptSubmission(result, submissionContext);
}

async function retryPendingQuizAttempt() {
if (!pendingQuizResultContext) return false;
let context = pendingQuizResultContext;
if (context.accountId !== currentAccountId()
|| context.attemptId !== window.WordArenaQuizAttemptClient?.state?.()?.attemptId) {
pendingQuizResultContext = null;
return false;
}
let result = await window.WordArenaQuizAttemptClient?.retryActiveSubmission?.();
return applyQuizAttemptSubmission(result, context);
}

function updateStats() {
let topWords = document.getElementById("totalWordsTop");
let topWrong = document.getElementById("totalWrongWordsTop");
let dueToday = document.getElementById("dueTodayTop");
let weeklyCorrect = document.getElementById("weeklyCorrectTop");
let accuracyTop = document.getElementById("accuracyTop");
let weakWordsTop = document.getElementById("weakWordsTop");

if (topWords) topWords.textContent = String(getVocab().length);
if (topWrong) topWrong.textContent = String(getWrongWords().length);
if (dueToday) dueToday.textContent = String(getDueTodayCount());
if (weeklyCorrect) weeklyCorrect.textContent = String(getWeeklyCorrectCount());
if (accuracyTop) accuracyTop.textContent = `${getAverageAccuracy()}%`;
if (weakWordsTop) weakWordsTop.textContent = String(getWeakWordCandidates().length);
updateProfilePanel();
renderLeaderboard();
renderWeakWordsCenter();
}

function getTotalCorrect() {
return getVocab().reduce((sum, word) => sum + Number(word?.stats?.correct || 0), 0);
}

function getTotalReviews() {
return getVocab().reduce((sum, word) => {
let stats = word?.stats || {};
return sum + Math.max(Number(stats.seen || 0), Number(stats.correct || 0) + Number(stats.wrong || 0));
}, 0);
}

function getAverageAccuracy() {
let total = getTotalReviews();
return total ? Math.round(getTotalCorrect() / total * 100) : 0;
}

function getMasteredCount(words = getVocab()) {
return words.filter(word => {
if (word.mastered) return true;
if (typeof getMasteryLabel === "function") return getMasteryLabel(word) === "Mastered";
return false;
}).length;
}

function getProfileXp(words = getVocab()) {
return words.length * 25 + getTotalCorrect() * 12 + getMasteredCount(words) * 50;
}

function getBestStreak() {
let streaks = getVocab().map(word => Number(word?.stats?.bestStreak || word?.stats?.streak || 0));
return streaks.length ? Math.max(...streaks, 0) : 0;
}

function getDueTodayCount() {
let now = Date.now();
return getVocab().filter(word => {
let nextReview = word?.stats?.nextReview;
if (!nextReview) return Number(word?.stats?.seen || 0) > 0 && !word.mastered;
let due = new Date(nextReview).getTime();
return !Number.isNaN(due) && due <= now;
}).length;
}

function getWordReviewCount(word) {
let stats = word?.stats || {};
return Math.max(Number(stats.seen || 0), Number(stats.correct || 0) + Number(stats.wrong || 0));
}

function getWordAccuracy(word) {
let total = getWordReviewCount(word);
return total ? Math.round(Number(word?.stats?.correct || 0) / total * 100) : 0;
}

function getWeakWordCandidates(limit = 8) {
let now = Date.now();
return getVocab()
.map(word => {
let stats = word?.stats || {};
let nextReview = stats.nextReview ? new Date(stats.nextReview).getTime() : null;
let overdue = nextReview && !Number.isNaN(nextReview) && nextReview <= now;
let mastery = typeof getMasteryLabel === "function" ? getMasteryLabel(word) : "";
let wrong = Number(stats.wrong || 0);
let reviews = getWordReviewCount(word);
let accuracy = getWordAccuracy(word);
let weak = wrong >= 2 || (reviews >= 3 && accuracy < 70) || (overdue && mastery !== "Mastered");
let score = wrong * 4 + (100 - accuracy) / 10 + (overdue ? 12 : 0);
return { word, wrong, reviews, accuracy, overdue, score, weak };
})
.filter(item => item.word?.eng && item.word?.vie && item.weak)
.sort((a, b) => b.score - a.score)
.slice(0, limit);
}

function renderWeakWordsCenter() {
let list = document.getElementById("weakWordsCenterList");
let summary = document.getElementById("weakWordsCenterSummary");
let button = document.getElementById("weakWordsReviewBtn");
if (!list) return;

let items = getWeakWordCandidates(6);
list.innerHTML = "";
if (summary) {
summary.textContent = items.length
? `${items.length} focus words based on mistakes, mastery, and due status.`
: "Focus words appear after quizzes or reviews reveal what needs another pass.";
}
if (button) button.disabled = items.length === 0;

if (!items.length) {
let empty = document.createElement("div");
empty.className = "emptyStudio emptyStudio--action";
let message = document.createElement("p");
message.textContent = getVocab().length
? "No focus words yet. Keep reviewing and this section will surface words that need attention."
: "No vocabulary yet. Add words or generate an AI Deck to start learning.";
let actions = document.createElement("div");
actions.className = "emptyStudioActions";
let primary = document.createElement("button");
primary.className = "miniBtn";
primary.type = "button";
primary.textContent = getVocab().length ? "Start Review" : "Add Words";
primary.addEventListener("click", () => showAppPage(getVocab().length ? "review" : "vocabulary"));
let secondary = document.createElement("button");
secondary.className = "miniBtn";
secondary.type = "button";
secondary.textContent = "Generate Deck";
secondary.addEventListener("click", () => showAppPage("aiDeck"));
actions.append(primary, secondary);
empty.append(message, actions);
list.appendChild(empty);
return;
}

items.forEach(item => {
let card = document.createElement("article");
card.className = "weakFixCard";
let main = document.createElement("div");
main.className = "weakFixMain";
let title = document.createElement("strong");
title.textContent = item.word.eng;
let meaning = document.createElement("span");
meaning.className = "weakFixMeaning";
meaning.textContent = item.word.vie;
main.append(title, meaning);
let meta = document.createElement("small");
meta.className = "weakFixStats";
let dueText = item.overdue ? "overdue" : `${item.reviews} reviews`;
meta.textContent = `${item.accuracy}% accuracy | ${item.wrong} wrong | ${dueText} | ${item.word.tag || "untagged"}`;
card.append(main, meta);
list.appendChild(card);
});
}

function startWeakWordsReview() {
let words = getWeakWordCandidates(12).map(item => item.word);
if (!words.length) return;
if (typeof startWordSetQuiz === "function") {
startWordSetQuiz(words, "mixed", { kind: "weak-words" });
} else if (typeof showAppPage === "function") {
showAppPage("review");
}
}

function getQuizHistory() {
try {
let raw = localStorage.getItem(accountStorageKey("quizHistory"));
let parsed = raw ? JSON.parse(raw) : [];
return Array.isArray(parsed) ? parsed : [];
} catch (error) {
return [];
}
}

function saveQuizHistory(history) {
localStorage.setItem(accountStorageKey("quizHistory"), JSON.stringify(history.slice(-80)));
}

function getWeeklyCorrectCount() {
if (latestProgressSummary?.weeklyCorrectAnswers != null) {
return latestProgressSummary.weeklyCorrectAnswers;
}

let cutoff = Date.now() - 7 * 86400000;
return getQuizHistory()
.filter(item => new Date(item.createdAt).getTime() >= cutoff)
.reduce((sum, item) => sum + Number(item.correctAnswers || 0), 0);
}

function recordLocalQuizHistory() {
if (!Array.isArray(quizData) || quizData.length === 0) return;

let history = getQuizHistory();
let createdAt = new Date().toISOString();
history.push({
createdAt,
quizMode: window.currentQuizKind || modeSelect?.value || currentMode || "mixed",
challengeSeconds: isChallengeMode ? questionTime : null,
totalQuestions: quizData.length,
correctAnswers: correctCount,
wrongAnswers: quizData.length - correctCount,
score: quizData.length ? Number((correctCount / quizData.length * 10).toFixed(2)) : 0,
maxCombo
});
saveQuizHistory(history);
return createdAt;
}

function updateProfilePanel() {
let words = getVocab();
let mastered = getMasteredCount(words);
let xp = getProfileXp(words);
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
if (profileAchievements) {
let fallbackBadges = 3 + Math.min(4, Math.floor(words.length / 10));
profileAchievements.textContent = String(latestAchievements.length || fallbackBadges);
}
}

function renderLeaderboard() {
let list = document.getElementById("leaderboardList");
if (!list) return;

let xp = getProfileXp();
let currentPlayer = getCurrentPlayer();
let words = getVocab();
let mastered = getMasteredCount(words);
let mastery = words.length ? Math.round(mastered / words.length * 100) : 0;
let weekly = [
{ name: currentPlayer.name || "You", score: xp || 0, tag: "XP" },
{ name: "Best streak", score: getBestStreak(), tag: "combo" },
{ name: "Mastery", score: mastery, tag: "%" },
{ name: "Due today", score: getDueTodayCount(), tag: "words" },
{ name: "Week correct", score: getWeeklyCorrectCount(), tag: "answers" }
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
return typeof getCachedProfile === "function" ? getCachedProfile() : {};
}

function cacheCurrentPlayer(profile) {
if (typeof switchAccountStorage === "function") {
return switchAccountStorage(profile);
}

localStorage.setItem("quizUserProfile", JSON.stringify(profile));
return profile;
}

function redirectToLogin() {
let target = new URL("login.html", window.location.href);
window.location.replace(target.href);
}

function wait(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCurrentUserOnce() {
let response = await API_FETCH(`${AUTH_API_ORIGIN}/api/me`);

if (response.status === 401 || response.status === 403) {
return { status: "unauthenticated" };
}

if (!response.ok) {
return { status: "transientFailure", httpStatus: response.status };
}

let profile = await response.json();
return profile?.authenticated
? { status: "authenticated", profile }
: { status: "unauthenticated" };
}

async function fetchCurrentUserWithRetry() {
for (let attempt = 0; attempt <= AUTH_PROFILE_RETRY_DELAYS.length; attempt++) {
try {
let result = await fetchCurrentUserOnce();
if (result.status !== "transientFailure") return result;
} catch (error) {
// Retry below; a warm session can outlive a brief network or backend hiccup.
}

if (attempt < AUTH_PROFILE_RETRY_DELAYS.length) {
setSyncStatus("Cloud session is temporarily unavailable. Retrying...", "warn");
await wait(AUTH_PROFILE_RETRY_DELAYS[attempt]);
}
}

return { status: "transientFailure" };
}

const APP_PAGE_LABELS = {
dashboard: { eyebrow: "Workspace", title: "Dashboard" },
vocabulary: { eyebrow: "Word Bank", title: "Vocabulary" },
review: { eyebrow: "Spaced Repetition", title: "Review" },
aiDeck: { eyebrow: "Generator", title: "AI Deck" },
analytics: { eyebrow: "Insights", title: "Analytics" },
studio: { eyebrow: "Learning Tools", title: "Studio" }
};

function showAppPage(page = "dashboard") {
let nextPage = APP_PAGE_LABELS[page] ? page : "dashboard";
document.body.dataset.appPage = nextPage;

document.querySelectorAll("[data-app-page-panel]").forEach(panel => {
panel.classList.toggle("is-active-page", panel.dataset.appPagePanel === nextPage);
});

document.querySelectorAll("[data-app-page]").forEach(button => {
let isActive = button.dataset.appPage === nextPage;
button.classList.toggle("is-active", isActive);
if (button.classList.contains("appNavBtn") && isActive) button.setAttribute("aria-current", "page");
else button.removeAttribute("aria-current");
});

let label = APP_PAGE_LABELS[nextPage];
setText("appPageEyebrow", label.eyebrow);
setText("appPageTitle", label.title);

document.getElementById("home")?.classList.remove("hidden");
document.getElementById("quizScreen")?.classList.add("hidden");
document.getElementById("resultScreen")?.classList.add("hidden");
document.getElementById("reviewScreen")?.classList.add("hidden");
document.getElementById("mistakeScreen")?.classList.add("hidden");
document.getElementById("challengeMenu")?.classList.add("hidden");
document.getElementById("challengeMenu")?.classList.remove("show");
document.querySelector(".heroPanel")?.classList.toggle("hidden", nextPage !== "dashboard");

if (nextPage === "analytics") window.analyticsDashboard?.refresh?.();
if (nextPage === "review") window.reviewToday?.refresh?.();
window.scrollTo({ top: 0, behavior: "smooth" });
}

function refreshOnboardingPanel() {
let panel = document.getElementById("startHerePanel");
if (!panel) return;

let wordCount = getVocab().length;
let quizButton = document.getElementById("startHereQuizBtn");
let quizStatus = document.getElementById("startHereQuizStatus");
let remaining = Math.max(4 - wordCount, 0);

panel.hidden = wordCount >= 12;
if (quizButton) quizButton.disabled = wordCount < 4;
if (quizStatus) {
quizStatus.textContent = wordCount >= 4
? "Ready for your first quiz? Try a short mixed round when you feel ready."
: `Add at least ${remaining} more ${remaining === 1 ? "word" : "words"} to start a quiz.`;
}
}

function openStarterDeckFromOnboarding(deckKey = "daily-life") {
showAppPage("studio");
document.getElementById("studioBtn")?.click();
window.setTimeout(() => {
document.querySelector(".studioTab[data-studio-tab='decks']")?.click();
let select = document.getElementById("curatedTopicSelect");
if (select && deckKey) select.value = deckKey;
document.getElementById("curatedGenerateBtn")?.focus();
}, 0);
}

function initOnboarding() {
document.getElementById("startHereStarterBtn")?.addEventListener("click", () => openStarterDeckFromOnboarding("daily-life"));
document.querySelectorAll("[data-onboarding-deck]").forEach(button => {
button.addEventListener("click", () => openStarterDeckFromOnboarding(button.dataset.onboardingDeck || "daily-life"));
});
document.getElementById("startHereAiDeckBtn")?.addEventListener("click", () => showAppPage("aiDeck"));
document.getElementById("startHereAddWordBtn")?.addEventListener("click", () => {
showAppPage("vocabulary");
document.getElementById("engInput")?.focus();
});
document.getElementById("startHereQuizBtn")?.addEventListener("click", () => {
if (getVocab().length >= 4 && typeof startQuiz === "function") {
startQuiz();
return;
}
showAppPage("vocabulary");
document.getElementById("engInput")?.focus();
});
refreshOnboardingPanel();
}

function initAppShell() {
initInlineFreeActions();
document.querySelectorAll("[data-app-page]").forEach(button => {
button.addEventListener("click", () => showAppPage(button.dataset.appPage));
});
initSidebarToolsMenu();
document.getElementById("weakWordsReviewBtn")?.addEventListener("click", startWeakWordsReview);
initOnboarding();
showAppPage(document.body.dataset.appPage || "dashboard");
}

window.showAppPage = showAppPage;

function initInlineFreeActions() {
document.addEventListener("click", event => {
let button = event.target.closest("[data-ui-action]");
if (!button) return;
event.preventDefault();
UI_ACTIONS.dispatch(button.dataset.uiAction, button);
});
}

function initSidebarToolsMenu() {
let toggle = document.getElementById("sidebarToolsToggle");
let panel = document.getElementById("sidebarToolsPanel");
if (!toggle || !panel) return;

let mobileQuery = window.matchMedia("(max-width: 620px)");

function setToolsOpen(open) {
panel.classList.toggle("is-open", open);
toggle.setAttribute("aria-expanded", String(open));
toggle.setAttribute("aria-label", open ? "Close tools menu" : "Open tools menu");
if (mobileQuery.matches) panel.hidden = !open;
else panel.hidden = false;
}

function syncToolsMode() {
let isMobile = mobileQuery.matches;
toggle.hidden = !isMobile;
panel.hidden = isMobile && !panel.classList.contains("is-open");
if (!isMobile) setToolsOpen(false);
}

toggle.addEventListener("click", () => setToolsOpen(!panel.classList.contains("is-open")));
panel.addEventListener("click", event => {
if (mobileQuery.matches && event.target.closest("button")) setToolsOpen(false);
});
document.addEventListener("click", event => {
if (!mobileQuery.matches || panel.hidden) return;
if (!panel.contains(event.target) && event.target !== toggle) setToolsOpen(false);
});
document.addEventListener("keydown", event => {
if (event.key === "Escape" && mobileQuery.matches && !panel.hidden) {
event.preventDefault();
setToolsOpen(false);
toggle.focus();
}
});
mobileQuery.addEventListener?.("change", syncToolsMode);
syncToolsMode();
}

function setText(id, value) {
let element = document.getElementById(id);
if (element) element.textContent = value;
}

function setImage(id, value) {
let element = document.getElementById(id);
if (element) element.src = typeof safeProfileAvatar === "function" ? safeProfileAvatar(value) : (value || "images/icon.png");
}

function applyProfile(profile) {
let safeProfile = typeof sanitizeProfile === "function" ? sanitizeProfile(profile || {}) : {
name: profile?.name || "Vocabulary Runner",
email: profile?.email || "",
avatar: profile?.avatar || "images/icon.png",
birthday: profile?.birthday || "",
gender: profile?.gender || "",
goal: profile?.goal || "",
bio: profile?.bio || ""
};

safeProfile = cacheCurrentPlayer(safeProfile) || safeProfile;
window.WordArenaSessionUi.renderProfileSummary(safeProfile, {
sanitizeAvatar: typeof safeProfileAvatar === "function" ? safeProfileAvatar : undefined
});
renderLeaderboard();
}

function refreshAccountData() {
wrongWords = wrongWords.map(w => ({
...w,
mastered: w.mastered || false
}));

let autoSpeakToggle = document.getElementById("autoSpeakToggle");
if (autoSpeakToggle && typeof accountStorageKey === "function") {
autoSpeak = localStorage.getItem(accountStorageKey("autoSpeak")) === "true";
autoSpeakToggle.checked = autoSpeak;
}

renderTable();
renderMistakeTable();
updateStats();
refreshOnboardingPanel();
}

let profileEditorPendingAvatar = "";
let profileEditorFocusManager = null;

async function loadAuthenticatedProfile() {
let cached = getCurrentPlayer();
if (!REQUIRE_AUTH && (cached.name || cached.email || cached.avatar)) {
applyProfile(cached);
}

setSyncStatus("Checking session...", "syncing");
let result = await fetchCurrentUserWithRetry();

if (result.status === "authenticated") {
applyProfile(result.profile);
resetCloudSyncStateForAccount();
refreshAccountData();
await window.quizCsrf?.refresh?.();
cloudSyncReady = true;
cloudSyncState.syncReady = true;
let pulled = await pullCloudSnapshot();
if (pulled) syncCloudNow();
return;
}

  if (result.status === "unauthenticated") {
    if (REQUIRE_AUTH) redirectToLogin();
    else {
      let hasCached = cached.name || cached.email || cached.avatar;
      setSyncStatus(
        hasCached ? "Session expired. Please sign in again." : "Not signed in. Local mode.",
        "local"
      );
    }
    return;
  }

if (cached.name || cached.email || cached.avatar) {
applyProfile(cached);
}
if (sessionStorage.getItem("backendLoginWarned") !== "true") {
toast("Cloud session is temporarily unavailable. Your local words are still safe.", "warn", 3600);
sessionStorage.setItem("backendLoginWarned", "true");
}
setSyncStatus("Cloud session temporarily unavailable", "warn");
}

function getEditableProfile() {
let base = getCurrentPlayer();
let accountProfile = typeof getAccountProfile === "function" ? getAccountProfile() : {};
return {
name: accountProfile.name || base.name || "Vocabulary Runner",
email: accountProfile.email || base.email || "",
avatar: accountProfile.avatar || base.avatar || "images/icon.png",
birthday: accountProfile.birthday || "",
gender: accountProfile.gender || "",
goal: accountProfile.goal || "",
bio: accountProfile.bio || ""
};
}

function populateProfileForm(profile = getEditableProfile()) {
let name = document.getElementById("profileFormName");
let email = document.getElementById("profileFormEmail");
let birthday = document.getElementById("profileFormBirthday");
let gender = document.getElementById("profileFormGender");
let goal = document.getElementById("profileFormGoal");
let bio = document.getElementById("profileFormBio");

if (name) name.value = profile.name || "";
if (email) email.value = profile.email || "local-guest";
if (birthday) birthday.value = profile.birthday || "";
if (gender) gender.value = profile.gender || "";
if (goal) goal.value = profile.goal || "";
if (bio) bio.value = profile.bio || "";
setImage("profileEditorAvatarPreview", profile.avatar || "images/icon.png");
}

function openProfileEditor(opener = document.activeElement) {
let overlay = document.getElementById("profileEditor");
if (!overlay) return;

populateProfileForm();
profileEditorPendingAvatar = "";
overlay.classList.remove("hidden");
document.body.classList.add("modalOpen");
profileEditorFocusManager?.activate(opener);
}

function closeProfileEditor() {
let overlay = document.getElementById("profileEditor");
if (!overlay) return;

let wasOpen = !overlay.classList.contains("hidden");
overlay.classList.add("hidden");
document.body.classList.remove("modalOpen");
if (wasOpen) profileEditorFocusManager?.restore();
}

function initProfileEditor() {
let overlay = document.getElementById("profileEditor");
let closeBtn = document.getElementById("profileEditorCloseBtn");
let form = document.getElementById("profileForm");
let pickBtn = document.getElementById("profileAvatarPickBtn");
let fileInput = document.getElementById("profileAvatarInput");
let resetBtn = document.getElementById("profileResetBtn");
let avatarPreview = document.getElementById("profileEditorAvatarPreview");

if (!overlay || !form) return;

profileEditorFocusManager = createModalFocusManager(overlay, {
close: closeProfileEditor,
initialFocus: closeBtn,
restoreFallback: () => document.getElementById("profileTrigger")
});

closeBtn?.addEventListener("click", closeProfileEditor);
overlay.addEventListener("click", event => {
if (event.target === overlay) closeProfileEditor();
});

pickBtn?.addEventListener("click", () => fileInput?.click());
resetBtn?.addEventListener("click", () => {
profileEditorPendingAvatar = "images/icon.png";
if (avatarPreview) avatarPreview.src = profileEditorPendingAvatar;
});

fileInput?.addEventListener("change", () => {
let file = fileInput.files?.[0];
fileInput.value = "";
if (!file) return;

if (!PROFILE_AVATAR_SAFE_FILE_TYPES?.has(file.type)) {
toast("Please choose a PNG, JPG, GIF, or WebP image.", "warn");
return;
}

if (file.size > PROFILE_AVATAR_MAX_FILE_BYTES) {
toast("Profile photo must be 64 KB or less.", "warn");
return;
}

let reader = new FileReader();
reader.onload = () => {
let nextAvatar = typeof safeProfileAvatar === "function"
? safeProfileAvatar(reader.result)
: String(reader.result || "");
if (nextAvatar === "images/icon.png" && String(reader.result || "").trim() !== "images/icon.png") {
toast("That profile photo format is not supported.", "warn");
return;
}
profileEditorPendingAvatar = nextAvatar;
if (avatarPreview) avatarPreview.src = profileEditorPendingAvatar;
};
reader.readAsDataURL(file);
});

form.addEventListener("submit", event => {
event.preventDefault();

let current = getEditableProfile();
let nextProfile = {
...current,
name: safeProfileText(document.getElementById("profileFormName")?.value, 120) || "Vocabulary Runner",
email: current.email || "",
avatar: safeProfileAvatar(profileEditorPendingAvatar || current.avatar || "images/icon.png"),
birthday: safeProfileText(document.getElementById("profileFormBirthday")?.value, 20),
gender: safeProfileText(document.getElementById("profileFormGender")?.value, 40),
goal: safeProfileText(document.getElementById("profileFormGoal")?.value, 160),
bio: safeProfileText(document.getElementById("profileFormBio")?.value, 2000, true)
};

profileEditorPendingAvatar = "";
applyProfile(nextProfile);
closeProfileEditor();
toast("Profile saved for this account.", "ok");
});

}

function initProfileMenu() {
let trigger = document.getElementById("profileTrigger");
let menu = document.getElementById("profileMenu");
let logoutButtons = [
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
button.addEventListener("click", async () => {
button.disabled = true;
closeMenu();
window.WordArenaQuizAttemptClient?.reset?.();
window.WordArenaReviewOperationClient?.reset?.();
pendingQuizResultContext = null;
try {
await API_FETCH(`${AUTH_API_ORIGIN}/logout`, { method: "POST" });
} catch (error) {
// Local cleanup and redirect still keep the visible app state consistent.
} finally {
window.quizCsrf?.clear?.();
localStorage.removeItem("quizUserProfile");
window.location.href = new URL("login.html?loggedOut=true", window.location.href).href;
}
});
});

settingsBtn?.addEventListener("click", () => {
closeMenu();
openProfileEditor(trigger);
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
el.classList.add("is-hiding");
setTimeout(() => el.remove(), 220);
}, ms);
}

function initSearch() {
let input = document.getElementById("vocabSearch");
let clearBtn = document.getElementById("clearSearch");
let filterControls = [
document.getElementById("filterPos"),
document.getElementById("filterTag"),
document.getElementById("filterMastery"),
document.getElementById("filterFavorites"),
document.getElementById("filterDue")
].filter(Boolean);

window.vocabFilterQuery = "";

function update() {
window.vocabFilterQuery = (input?.value || "").trim();
renderTable();
}

input?.addEventListener("input", update);
filterControls.forEach(control => control.addEventListener("change", update));
clearBtn?.addEventListener("click", () => {
if (input) {
input.value = "";
input.focus();
}
filterControls.forEach(control => {
if (control.type === "checkbox") control.checked = false;
else control.value = "";
});
update();
});
}

function exportData() {
try {
exportLocalBackup("manual");
toast("Exported backup JSON.", "ok");
return true;
} catch (error) {
toast("Export failed. Please try again.", "err");
return false;
}
}

function cleanWord(word) {
if (!word || typeof word !== "object") return null;

let cleaned = normalizeWord(word);

if (!cleaned.eng || !cleaned.vie) return null;

return cleaned;
}

function normalizeImported(payload) {
return window.WordArenaImport.normalizeImported(payload, { cleanWord });
}

function mergeByEnglish(base, incoming) {
return window.WordArenaImport.mergeByEnglish(base, incoming, importHelperOptions());
}

function mergeByEnglishWithStats(base, incoming) {
return window.WordArenaImport.mergeByEnglishWithStats(base, incoming, importHelperOptions());
}

function importHelperOptions() {
return {
normalizeEnglishKey,
normalizeWord,
stampWordUpdatedAt
};
}

function importReviewSummary(normalized) {
return window.WordArenaImport.importReviewSummary(normalized, {
currentVocab: getVocab(),
currentWrongWords: getWrongWords(),
pendingDeletes: peekPendingCloudDeletes()
}, importHelperOptions());
}

function setImportReviewText(id, value) {
let element = document.getElementById(id);
if (element) element.textContent = String(value);
}

function updateImportReviewDialog() {
let normalized = importReviewState.normalized;
if (!normalized) return;
let summary = importReviewSummary(normalized);
setImportReviewText("importCurrentCount", summary.currentVocab);
setImportReviewText("importIncomingCount", summary.incomingVocab);
setImportReviewText("importWrongCount", summary.incomingWrong);
setImportReviewText("importDuplicateCount", summary.duplicates);
setImportReviewText("importInvalidCount", summary.invalid);
setImportReviewText("importMergeFinalCount", summary.mergeFinal);
setImportReviewText("importReplaceFinalCount", summary.replaceFinal);
setImportReviewText("importPendingDeleteCount", summary.pendingDeletes);
setImportReviewText(
"importMetadataNote",
summary.includesSyncMetadata
? "This backup contains sync metadata. Import ignores it and preserves this account's current sync metadata and pending deletions."
: "Import preserves this account's current sync metadata and pending deletions."
);
}

function importDialogFocusable() {
let dialog = document.getElementById("importReviewDialog");
if (!dialog) return [];
return Array.from(dialog.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"))
.filter(element => !element.hidden && element.getClientRects().length > 0);
}

function closeImportReviewDialog() {
if (importReviewState.busy) return;
let dialog = document.getElementById("importReviewDialog");
if (!dialog || dialog.classList.contains("hidden")) return;
dialog.classList.add("hidden");
document.body.classList.remove("modalOpen");
let lastFocused = importReviewState.lastFocused;
importReviewState.normalized = null;
importReviewState.lastFocused = null;
setImportReviewStatus("");
lastFocused?.focus?.();
}

function setImportReviewBusy(busy) {
importReviewState.busy = Boolean(busy);
["importCancelBtn", "importMergeBtn", "importReplaceBtn", "importReviewCloseBtn"].forEach(id => {
let button = document.getElementById(id);
if (button) button.disabled = importReviewState.busy;
});
}

function setImportReviewStatus(message, tone = "") {
let status = document.getElementById("importReviewStatus");
if (!status) return;
status.textContent = message || "";
status.dataset.tone = tone;
}

function openImportReviewDialog(normalized, opener) {
let dialog = document.getElementById("importReviewDialog");
if (!dialog) return false;
importReviewState.normalized = normalized;
importReviewState.lastFocused = opener || document.activeElement;
setImportReviewBusy(false);
setImportReviewStatus("Review the counts, then choose an import mode.");
updateImportReviewDialog();
dialog.classList.remove("hidden");
document.body.classList.add("modalOpen");
window.setTimeout(() => document.getElementById("importCancelBtn")?.focus(), 0);
return true;
}

function restoreStorageValue(key, rawValue) {
if (rawValue === null) localStorage.removeItem(key);
else localStorage.setItem(key, rawValue);
}

function persistImportedData(nextVocab, nextWrongWords) {
let accountId = currentAccountId();
let vocabKey = typeof accountStorageKey === "function" ? accountStorageKey("vocab", accountId) : "vocab";
let wrongKey = typeof accountStorageKey === "function" ? accountStorageKey("wrongWords", accountId) : "wrongWords";
let probeKey = typeof accountStorageKey === "function" ? accountStorageKey("importCapacityProbe", accountId) : "importCapacityProbe";
let previousVocabRaw = localStorage.getItem(vocabKey);
let previousWrongRaw = localStorage.getItem(wrongKey);
let serializedVocab;
let serializedWrong;
let serializedProbe;
let wroteVocab = false;
let wroteWrong = false;

try {
serializedVocab = JSON.stringify(nextVocab);
serializedWrong = JSON.stringify(nextWrongWords);
serializedProbe = JSON.stringify({ vocab: nextVocab, wrongWords: nextWrongWords });
localStorage.setItem(probeKey, serializedProbe);
localStorage.removeItem(probeKey);
localStorage.setItem(vocabKey, serializedVocab);
wroteVocab = true;
localStorage.setItem(wrongKey, serializedWrong);
wroteWrong = true;
} catch (error) {
try {
localStorage.removeItem(probeKey);
if (wroteVocab) restoreStorageValue(vocabKey, previousVocabRaw);
if (wroteWrong) restoreStorageValue(wrongKey, previousWrongRaw);
} catch (rollbackError) {
return { ok: false, error, rollbackError };
}
return { ok: false, error };
}

vocab = nextVocab;
wrongWords = nextWrongWords;
renderTable();
renderMistakeTable();
updateStats();
refreshOnboardingPanel();
return { ok: true };
}

function buildImportState(mode, normalized) {
return window.WordArenaImport.buildImportState(mode, normalized, {
currentVocab: getVocab(),
currentWrongWords: getWrongWords()
}, importHelperOptions());
}

function isValidImportState(state) {
if (!state || !Array.isArray(state.vocab) || !Array.isArray(state.wrongWords)) return false;
return [...state.vocab, ...state.wrongWords].every(word =>
word && typeof word === "object"
&& normalizeEnglishKey(word.eng)
&& String(word.vie || "").trim()
);
}

function commitReviewedImport(mode) {
let normalized = importReviewState.normalized;
if (!normalized || importReviewState.busy || !["merge", "replace"].includes(mode)) return;
setImportReviewBusy(true);

let next;
try {
next = buildImportState(mode, normalized);
} catch (error) {
setImportReviewBusy(false);
setImportReviewStatus("The import could not be prepared. Local data was not changed.", "err");
return;
}
if (!isValidImportState(next)) {
setImportReviewBusy(false);
setImportReviewStatus("The prepared import state is invalid. Local data was not changed.", "err");
return;
}

if (mode === "replace") {
try {
setImportReviewStatus("Creating a recovery backup before replace...", "warn");
exportLocalBackup("pre-import-replace", "wordarena-pre-import-backup");
} catch (error) {
setImportReviewBusy(false);
setImportReviewStatus("Backup failed. Replace was blocked and local data was not changed.", "err");
toast("Backup failed. Replace was blocked.", "err");
return;
}
}

let result = persistImportedData(next.vocab, next.wrongWords);
if (!result.ok) {
setImportReviewBusy(false);
setImportReviewStatus(
result.rollbackError
? "Save failed and storage rollback could not be verified. Stop importing and export the current data before continuing."
: "Save failed, possibly because browser storage is full. Local data was kept unchanged.",
"err"
);
toast("Import was not saved. Local data was kept unchanged.", "err");
return;
}

setImportReviewBusy(false);
closeImportReviewDialog();
if (mode === "replace") {
toast(`Backup downloaded. Replaced local data with ${next.added} imported words.`, "ok");
} else {
toast(`Imported ${next.added} words. Kept local fields and skipped ${next.skipped} duplicates.`, next.added ? "ok" : "warn");
}
}

function initImportReviewDialog() {
let dialog = document.getElementById("importReviewDialog");
if (!dialog) return;
document.getElementById("importCancelBtn")?.addEventListener("click", closeImportReviewDialog);
document.getElementById("importReviewCloseBtn")?.addEventListener("click", closeImportReviewDialog);
document.getElementById("importMergeBtn")?.addEventListener("click", () => commitReviewedImport("merge"));
document.getElementById("importReplaceBtn")?.addEventListener("click", () => commitReviewedImport("replace"));
dialog.addEventListener("click", event => {
if (event.target === dialog) closeImportReviewDialog();
});
dialog.addEventListener("keydown", event => {
if (event.key === "Escape" && !importReviewState.busy) {
event.preventDefault();
closeImportReviewDialog();
return;
}
if (event.key !== "Tab") return;
let focusable = importDialogFocusable();
if (!focusable.length) return;
let first = focusable[0];
let last = focusable[focusable.length - 1];
if (event.shiftKey && document.activeElement === first) {
event.preventDefault();
last.focus();
} else if (!event.shiftKey && document.activeElement === last) {
event.preventDefault();
first.focus();
}
});
}

async function importStarterWords() {
if (await window.quizCloud?.importSamples()) {
toast("Imported starter words to your cloud deck.", "ok");
refreshOnboardingPanel();
return;
}

let incoming = STARTER_WORDS.map(cleanWord).filter(Boolean);
let result = mergeByEnglishWithStats(getVocab(), incoming);
setData(result.merged, getWrongWords());
toast(
result.added ? `Imported ${result.added} starter words. Skipped ${result.skipped} duplicates.` : `No new starter words imported. ${result.skipped} duplicates already exist.`,
result.added ? "ok" : "warn"
);
syncCloudNow();
}

function initImportExport() {
let exportBtn = document.getElementById("exportBtn");
let importBtn = document.getElementById("importBtn");
let sampleImportBtn = document.getElementById("sampleImportBtn");
let file = document.getElementById("importFile");

exportBtn?.addEventListener("click", exportData);
importBtn?.addEventListener("click", () => file?.click());
sampleImportBtn?.addEventListener("click", importStarterWords);
initImportReviewDialog();

file?.addEventListener("change", async () => {
let selectedFile = file.files?.[0];
file.value = "";
if (!selectedFile) return;

try {
let text = await selectedFile.text();
if (!text.trim()) {
toast("Import file appears empty.", "warn");
return;
}

let payload;
try {
payload = JSON.parse(text);
} catch (error) {
toast("This JSON file is invalid.", "err");
return;
}

let normalized = normalizeImported(payload);

if (!normalized || normalized.vocab.length === 0) {
toast("Import file has no valid vocab.", "warn");
return;
}
openImportReviewDialog(normalized, importBtn);
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

let focusManager = createModalFocusManager(overlay, {
close,
initialFocus: closeBtn,
restoreFallback: openBtn
});

function open() {
overlay.classList.remove("hidden");
document.body.classList.add("modalOpen");
focusManager.activate(openBtn);
}

function close() {
let wasOpen = !overlay.classList.contains("hidden");
overlay.classList.add("hidden");
document.body.classList.remove("modalOpen");
if (wasOpen) focusManager.restore();
}

openBtn.addEventListener("click", open);
closeBtn.addEventListener("click", close);

overlay.addEventListener("click", event => {
if (event.target === overlay) close();
});

}

initAppShell();
initSearch();
initImportExport();
initPreview();
initProfileEditor();
initProfileMenu();
ensureSyncStatus();
initSyncRetry();
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

let originalSave = window.save;
if (typeof originalSave === "function") {
window.save = function (...args) {
let result = originalSave.apply(this, args);
scheduleCloudSync();
return result;
};
}

let originalFinishQuiz = window.finishQuiz;
if (typeof originalFinishQuiz === "function") {
window.finishQuiz = function (...args) {
let result = originalFinishQuiz.apply(this, args);
let attemptState = window.WordArenaQuizAttemptClient?.state?.();
let localPlan = null;
if (window.quizUsesIssuedAttempt()) {
if (attemptState?.status !== "issued") return result;
localPlan = window.captureQuizLocalResultPlan();
if (localPlan.accountId !== currentAccountId()) return result;
}
let historyCreatedAt = recordLocalQuizHistory();
updateStats();
if (localPlan) {
submitIssuedQuizAttempt({ historyCreatedAt, localPlan });
}
return result;
};
}
})();
