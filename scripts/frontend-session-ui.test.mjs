import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("frontend/js/session-ui.js", "utf8");
const context = vm.createContext({ window: {} });
vm.runInContext(source, context, { filename: "frontend/js/session-ui.js" });

const helpers = context.window.WordArenaSessionUi;
assert.equal(typeof helpers.normalizeDisplayName, "function");
assert.equal(typeof helpers.buildTriggerLabel, "function");
assert.equal(typeof helpers.buildProfileModel, "function");
assert.equal(typeof helpers.renderProfileSummary, "function");

assert.equal(helpers.normalizeDisplayName("  Ada Lovelace  "), "Ada Lovelace");
assert.equal(helpers.normalizeDisplayName("   "), "Vocabulary Runner");
assert.equal(helpers.buildTriggerLabel("Ada Lovelace"), "Open account menu for Ada Lovelace");

const authenticated = helpers.buildProfileModel({
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatar: "images/ada.png"
});
assert.equal(authenticated.displayName, "Ada Lovelace");
assert.equal(authenticated.shortName, "Ada");
assert.equal(authenticated.identity, "Signed in as ada@example.com");
assert.equal(authenticated.triggerLabel, "Open account menu for Ada Lovelace");
assert.equal(authenticated.avatar, "images/ada.png");

const localGuest = helpers.buildProfileModel({});
assert.equal(localGuest.displayName, "Vocabulary Runner");
assert.equal(localGuest.shortName, "Vocabulary");
assert.equal(localGuest.identity, "Local guest profile");
assert.equal(localGuest.avatar, "images/icon.png");

const textIds = [
  "profileName",
  "profileNameSmall",
  "profileMenuName",
  "profileMenuEmail",
  "profileIdentityLine",
  "profileEditorAccount"
];
const imageIds = [
  "profileAvatarSmall",
  "profileMenuAvatar",
  "profileAvatarLarge",
  "profileEditorAvatarPreview"
];

function createElement(id) {
  return {
    id,
    textContent: "",
    src: "",
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  };
}

function createDocument(ids) {
  const elements = new Map(ids.map(id => [id, createElement(id)]));
  return {
    elements,
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
}

const documentRef = createDocument([...textIds, ...imageIds, "profileTrigger"]);
let sanitizedAvatarInput = null;
const rendered = helpers.renderProfileSummary({
  name: "<b>Safe Text</b>",
  email: "learner@example.com",
  avatar: "data:text/html,unsafe"
}, {
  documentRef,
  sanitizeAvatar(value) {
    sanitizedAvatarInput = value;
    return "images/icon.png";
  }
});

assert.equal(sanitizedAvatarInput, "data:text/html,unsafe");
assert.equal(rendered.displayName, "<b>Safe Text</b>");
assert.equal(rendered.avatar, "images/icon.png");
assert.equal(documentRef.elements.get("profileName").textContent, "<b>Safe Text</b>");
assert.equal(documentRef.elements.get("profileNameSmall").textContent, "<b>Safe");
assert.equal(documentRef.elements.get("profileMenuEmail").textContent, "Signed in as learner@example.com");
assert.equal(
  documentRef.elements.get("profileTrigger").attributes["aria-label"],
  "Open account menu for <b>Safe Text</b>"
);
for (const id of imageIds) {
  assert.equal(documentRef.elements.get(id).src, "images/icon.png");
}

assert.doesNotThrow(() => helpers.renderProfileSummary({ name: "Partial DOM" }, {
  documentRef: createDocument(["profileName"])
}));

console.log("Frontend session UI helper tests passed.");
