(function () {
const AI_API_ORIGIN = window.quizApiOrigin ? window.quizApiOrigin() : "";
const AI_EXPLAIN_COOLDOWN_MS = 7000;
const aiExplainCooldowns = new WeakMap();

function ensurePanel(card) {
let panel = card.querySelector(".aiExplainPanel");
if (!panel) {
panel = document.createElement("section");
panel.className = "aiExplainPanel";
card.appendChild(panel);
}
return panel;
}

function setLoading(button, loading) {
if (!button) return;
button.disabled = loading;
button.textContent = loading ? "Explaining..." : "Explain";
}

function ensureCooldownMessage(panel) {
let message = panel.querySelector(".aiExplainCooldownMessage");
if (!message) {
message = document.createElement("p");
message.className = "apiStateMessage apiStateMessage--warn aiExplainCooldownMessage";
panel.appendChild(message);
}
return message;
}

function updateCooldownButton(button, panel, availableAt) {
if (!button) return;
let remaining = Math.max(0, availableAt - Date.now());
if (remaining <= 0) {
setLoading(button, false);
panel.querySelector(".aiExplainCooldownMessage")?.remove();
return;
}
let wait = Math.ceil(remaining / 1000);
button.disabled = true;
button.textContent = `Wait ${wait}s`;
ensureCooldownMessage(panel).textContent = `AI is cooling down. Try again in ${wait}s.`;
setTimeout(() => updateCooldownButton(button, panel, availableAt), Math.min(1000, remaining));
}

function fallbackExplanation(request) {
let word = clean(request.word, "this word");
let correctAnswer = clean(request.correctAnswer, "the correct answer");
let userAnswer = clean(request.userAnswer, "your answer");
return {
word,
shortMeaning: correctAnswer,
whyWrong: `Bạn chọn "${userAnswer}", nhưng đáp án đúng là "${correctAnswer}". Hãy kiểm tra nghĩa chính và ngữ cảnh trước khi chọn.`,
correctUsage: `Dùng "${word}" khi ngữ cảnh khớp với nghĩa "${correctAnswer}".`,
example: clean(request.example, `Try using "${word}" in a short English sentence.`),
memoryTip: `Gắn "${word}" với một hình ảnh hoặc tình huống quen thuộc, rồi tự nhắc lại nghĩa tiếng Việt.`,
collocations: [`${word} in context`, `use ${word} correctly`],
commonMistake: `Dễ chọn nhầm nếu chỉ nhìn từ gần nghĩa mà không đọc kỹ câu hỏi.`,
source: "local-fallback"
};
}

async function requestExplanation(request) {
try {
let response = await fetch(`${AI_API_ORIGIN}/api/ai/explain-wrong-answer`, {
method: "POST",
headers: { "Content-Type": "application/json" },
credentials: "include",
body: JSON.stringify(request)
});

if (!response.ok) {
throw new Error("AI explanation request failed.");
}
return await response.json();
} catch (error) {
return fallbackExplanation(request);
}
}

function render(panel, data) {
panel.innerHTML = "";

let title = document.createElement("h4");
title.textContent = "Why this answer was wrong";
panel.appendChild(title);

if (data.source === "local-fallback") {
let warning = document.createElement("p");
warning.className = "apiStateMessage apiStateMessage--warn";
warning.textContent = "AI explanation API is unavailable. Showing a local fallback.";
panel.appendChild(warning);
}

let meaning = line("Short meaning", data.shortMeaning);
let why = line("Why wrong", data.whyWrong);
let usage = line("Correct usage", data.correctUsage);
let example = line("Example", data.example);
let tip = line("Memory tip", data.memoryTip);
let mistake = line("Common mistake", data.commonMistake);

panel.append(meaning, why, usage, example, tip, mistake);

if (Array.isArray(data.collocations) && data.collocations.length) {
let chips = document.createElement("div");
chips.className = "aiExplainChips";
data.collocations.slice(0, 4).forEach(value => {
let chip = document.createElement("span");
chip.textContent = value;
chips.appendChild(chip);
});
panel.appendChild(chips);
}
}

function line(label, value) {
let item = document.createElement("p");
let strong = document.createElement("strong");
strong.textContent = `${label}: `;
item.appendChild(strong);
item.appendChild(document.createTextNode(clean(value, "Chưa có dữ liệu.")));
return item;
}

function clean(value, fallback) {
if (value === null || value === undefined || String(value).trim() === "") {
return fallback;
}
return String(value).trim();
}

window.aiExplainWrongAnswer = {
async open(request, card, button) {
let panel = ensurePanel(card);
let cooldownKey = button || card;
let now = Date.now();
let availableAt = cooldownKey ? aiExplainCooldowns.get(cooldownKey) || 0 : 0;
if (button?.disabled) return;
if (cooldownKey && now < availableAt) {
panel.innerHTML = "";
let wait = Math.ceil((availableAt - now) / 1000);
let message = document.createElement("p");
message.className = "apiStateMessage apiStateMessage--warn";
message.textContent = `Please wait ${wait}s before asking again.`;
panel.appendChild(message);
return;
}
let availableAfterRequest = now + AI_EXPLAIN_COOLDOWN_MS;
if (cooldownKey) aiExplainCooldowns.set(cooldownKey, availableAfterRequest);
panel.innerHTML = "";
let loading = document.createElement("p");
loading.className = "apiStateMessage apiStateMessage--loading";
loading.textContent = "Generating explanation...";
panel.appendChild(loading);
setLoading(button, true);
try {
let explanation = await requestExplanation(request);
render(panel, explanation);
} finally {
updateCooldownButton(button, panel, availableAfterRequest);
}
}
};
})();
