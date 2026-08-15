(function () {
"use strict";

const DEFAULT_DISPLAY_NAME = "Vocabulary Runner";
const DEFAULT_AVATAR = "images/icon.png";
const TEXT_TARGETS = {
  profileName: "displayName",
  profileNameSmall: "shortName",
  profileMenuName: "displayName",
  profileMenuEmail: "identity",
  profileIdentityLine: "identity",
  profileEditorAccount: "identity"
};
const IMAGE_TARGETS = [
  "profileAvatarSmall",
  "profileMenuAvatar",
  "profileAvatarLarge",
  "profileEditorAvatarPreview"
];

function normalizeDisplayName(value) {
  return String(value || "").trim() || DEFAULT_DISPLAY_NAME;
}

function buildTriggerLabel(displayName) {
  return `Open account menu for ${normalizeDisplayName(displayName)}`;
}

function buildProfileModel(profile = {}) {
  let displayName = normalizeDisplayName(profile?.name);
  let email = String(profile?.email || "").trim();
  return {
    displayName,
    shortName: displayName.split(/\s+/)[0] || "Account",
    identity: email ? `Signed in as ${email}` : "Local guest profile",
    triggerLabel: buildTriggerLabel(displayName),
    avatar: profile?.avatar || DEFAULT_AVATAR
  };
}

function renderProfileSummary(profile, options = {}) {
  let documentRef = options.documentRef || window.document;
  let model = buildProfileModel(profile);
  if (!documentRef) return model;

  Object.entries(TEXT_TARGETS).forEach(([id, field]) => {
    let element = documentRef.getElementById(id);
    if (element) element.textContent = model[field];
  });

  let trigger = documentRef.getElementById("profileTrigger");
  if (trigger) trigger.setAttribute("aria-label", model.triggerLabel);

  let safeAvatar = typeof options.sanitizeAvatar === "function"
    ? options.sanitizeAvatar(model.avatar)
    : model.avatar;
  IMAGE_TARGETS.forEach(id => {
    let image = documentRef.getElementById(id);
    if (image) image.src = safeAvatar || DEFAULT_AVATAR;
  });

  return { ...model, avatar: safeAvatar || DEFAULT_AVATAR };
}

window.WordArenaSessionUi = Object.freeze({
  normalizeDisplayName,
  buildTriggerLabel,
  buildProfileModel,
  renderProfileSummary
});
})();
