(function () {
"use strict";

const COMPACT_MESSAGES = {
  "Offline/local mode": "Local mode",
  "Not signed in. Local mode.": "Local mode",
  "Checking session...": "Checking session",
  "Cloud session is temporarily unavailable. Retrying...": "Cloud retrying",
  "Cloud session temporarily unavailable": "Cloud unavailable",
  "Session expired. Please sign in again.": "Sign in again"
};

function compactMessage(message) {
  let value = String(message || "").trim();
  return COMPACT_MESSAGES[value] || value || "Local mode";
}

function ensureStatus(documentRef = window.document) {
  if (!documentRef) return null;

  let existing = documentRef.getElementById("cloudSyncStatus");
  if (existing) return existing;

  let host = documentRef.querySelector(".appTopbarStatus") || documentRef.querySelector(".utilityBar");
  if (!host) return null;

  let status = documentRef.createElement("span");
  status.id = "cloudSyncStatus";
  status.className = "syncStatus syncStatus--local";
  status.textContent = "Local mode";
  host.appendChild(status);
  return status;
}

function render(message, tone = "local", documentRef = window.document) {
  let status = ensureStatus(documentRef);
  if (!status) return null;

  let fullMessage = String(message || "");
  status.textContent = compactMessage(fullMessage);
  status.className = `syncStatus syncStatus--${tone}`;
  status.title = fullMessage;
  status.setAttribute("aria-label", fullMessage);

  let retryBtn = documentRef.getElementById("syncRetryBtn");
  if (retryBtn) retryBtn.hidden = tone === "syncing" || tone === "ok";
  return status;
}

window.WordArenaSyncStatus = Object.freeze({
  compactMessage,
  ensureStatus,
  render
});
})();
