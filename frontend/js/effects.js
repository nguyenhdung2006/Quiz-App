function updateCombo(isCorrect) {
let comboEl = document.getElementById("comboDisplay");

if (isCorrect) {
combo++;

if (combo > maxCombo) maxCombo = combo;

comboEl.innerText = "Combo x" + combo;

let milestones = {
3: ["Nice Combo!", "soundSmall", false],
5: ["Hot Streak!", "soundSmall", false],
10: ["UNSTOPPABLE!", "soundMedium", true],
20: ["GODLIKE!", "soundMedium", false],
30: ["LEGENDARY!", "soundMedium", false],
50: ["IMMORTAL!", "sound50", true],
100: ["COMBO MASTER!", "sound100", true]
};

let milestone = milestones[combo];
if (milestone) {
comboExplosion(milestone[0]);
if (milestone[2]) fireworks();
screenShake();
playSound(milestone[1]);
}
} else {
combo = 0;
comboEl.innerText = "Combo x0";
}
}

function comboExplosion(text) {
let div = document.createElement("div");

div.className = "comboPopup";
div.innerText = text;

document.body.appendChild(div);

setTimeout(() => {
div.remove();
}, 1500);
}

function fireworks() {
let host = document.createDocumentFragment();

for (let i = 0; i < 40; i++) {
let p = document.createElement("div");

p.className = "particle";
p.style.background = `hsl(${Math.random() * 360},100%,60%)`;
p.style.left = window.innerWidth / 2 + "px";
p.style.top = window.innerHeight / 2 + "px";

let x = (Math.random() - 0.5) * 400;
let y = (Math.random() - 0.5) * 400;

p.style.setProperty("--x", x + "px");
p.style.setProperty("--y", y + "px");

host.appendChild(p);
setTimeout(() => p.remove(), 1000);
}

document.body.appendChild(host);
}

function screenShake() {
document.body.classList.add("shake");

setTimeout(() => {
document.body.classList.remove("shake");
}, 400);
}

function playSound(id) {
let s = document.getElementById(id);
if (!s) return;

s.currentTime = 0;

let playPromise = s.play();
if (playPromise && typeof playPromise.catch === "function") {
playPromise.catch(() => {});
}
}

function progressSpark() {
if (!progress || progress.offsetParent === null) return;

let rect = progress.getBoundingClientRect();
let host = document.createDocumentFragment();

for (let i = 0; i < 4; i++) {
let s = document.createElement("div");

s.className = "spark";
s.style.left = rect.right + "px";
s.style.top = rect.top + rect.height / 2 + "px";

let x = (Math.random() - 0.5) * 30;
let y = (Math.random() - 0.5) * 30;

s.style.setProperty("--x", x + "px");
s.style.setProperty("--y", y + "px");

host.appendChild(s);
setTimeout(() => s.remove(), 600);
}

document.body.appendChild(host);
}
