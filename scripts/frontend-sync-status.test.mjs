import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("frontend/js/sync-status.js", "utf8");
const context = vm.createContext({ window: {} });
vm.runInContext(source, context, { filename: "frontend/js/sync-status.js" });

const helpers = context.window.WordArenaSyncStatus;
assert.equal(typeof helpers.compactMessage, "function");
assert.equal(typeof helpers.ensureStatus, "function");
assert.equal(typeof helpers.render, "function");

const compactCases = [
  ["Offline/local mode", "Local mode"],
  ["Not signed in. Local mode.", "Local mode"],
  ["Checking session...", "Checking session"],
  ["Cloud session is temporarily unavailable. Retrying...", "Cloud retrying"],
  ["Cloud session temporarily unavailable", "Cloud unavailable"],
  ["Session expired. Please sign in again.", "Sign in again"],
  ["  Sync paused to protect your data  ", "Sync paused to protect your data"],
  ["", "Local mode"]
];

for (const [message, expected] of compactCases) {
  assert.equal(helpers.compactMessage(message), expected);
}

function createElement(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    id: "",
    className: "",
    textContent: "",
    title: "",
    hidden: false,
    children: [],
    attributes: {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  };
}

function createDocument({ topbar = true, utility = false } = {}) {
  const topbarHost = topbar ? createElement("div") : null;
  const utilityHost = utility ? createElement("aside") : null;
  const retryButton = createElement("button");
  retryButton.id = "syncRetryBtn";
  const roots = [retryButton, topbarHost, utilityHost].filter(Boolean);

  function allElements() {
    const result = [];
    const visit = (element) => {
      result.push(element);
      element.children.forEach(visit);
    };
    roots.forEach(visit);
    return result;
  }

  return {
    topbarHost,
    utilityHost,
    retryButton,
    getElementById(id) {
      return allElements().find(element => element.id === id) || null;
    },
    querySelector(selector) {
      if (selector === ".appTopbarStatus") return topbarHost;
      if (selector === ".utilityBar") return utilityHost;
      return null;
    },
    createElement
  };
}

const documentRef = createDocument();
const created = helpers.ensureStatus(documentRef);
assert.equal(created.id, "cloudSyncStatus");
assert.equal(created.className, "syncStatus syncStatus--local");
assert.equal(created.textContent, "Local mode");
assert.equal(documentRef.topbarHost.children.length, 1);
assert.equal(helpers.ensureStatus(documentRef), created);
assert.equal(documentRef.topbarHost.children.length, 1);

const warning = "Cloud session temporarily unavailable";
assert.equal(helpers.render(warning, "warn", documentRef), created);
assert.equal(created.textContent, "Cloud unavailable");
assert.equal(created.className, "syncStatus syncStatus--warn");
assert.equal(created.title, warning);
assert.equal(created.attributes["aria-label"], warning);
assert.equal(documentRef.retryButton.hidden, false);

helpers.render("Checking session...", "syncing", documentRef);
assert.equal(created.textContent, "Checking session");
assert.equal(documentRef.retryButton.hidden, true);

helpers.render("Synced", "ok", documentRef);
assert.equal(created.textContent, "Synced");
assert.equal(documentRef.retryButton.hidden, true);

helpers.render("Offline/local mode", "local", documentRef);
assert.equal(created.textContent, "Local mode");
assert.equal(documentRef.retryButton.hidden, false);

const utilityDocument = createDocument({ topbar: false, utility: true });
assert.equal(helpers.ensureStatus(utilityDocument), utilityDocument.utilityHost.children[0]);
assert.equal(helpers.ensureStatus(createDocument({ topbar: false })), null);

console.log("Frontend sync status helper tests passed.");
