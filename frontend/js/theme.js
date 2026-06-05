(function () {
const storageKey = "wordArenaTheme";
const root = document.documentElement;

function storedTheme() {
try {
return localStorage.getItem(storageKey);
} catch (error) {
return null;
}
}

function saveTheme(theme) {
try {
localStorage.setItem(storageKey, theme);
} catch (error) {
// Theme still applies for this page view if storage is unavailable.
}
}

function preferredTheme() {
const saved = storedTheme();
if (saved === "light" || saved === "dark") return saved;
return "dark";
}

function applyTheme(theme) {
const nextTheme = theme === "light" ? "light" : "dark";
root.dataset.theme = nextTheme;
root.style.colorScheme = nextTheme;
document.querySelectorAll("[data-theme-toggle]").forEach(button => {
button.setAttribute("aria-pressed", String(nextTheme === "dark"));
button.setAttribute("title", nextTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
let label = button.querySelector("[data-theme-label]");
if (label) label.textContent = nextTheme === "dark" ? "Dark" : "Light";
});
}

function toggleTheme() {
const current = root.dataset.theme === "light" ? "light" : "dark";
const nextTheme = current === "dark" ? "light" : "dark";
saveTheme(nextTheme);
applyTheme(nextTheme);
}

applyTheme(preferredTheme());

document.addEventListener("DOMContentLoaded", () => {
applyTheme(preferredTheme());
document.querySelectorAll("[data-theme-toggle]").forEach(button => {
button.addEventListener("click", toggleTheme);
});
});
})();
