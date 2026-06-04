(function () {
const AI_API_ORIGIN = "http://localhost:8080";

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

function fallbackExplanation(request) {
let word = clean(request.word, "this word");
let correctAnswer = clean(request.correctAnswer, "the correct answer");
let userAnswer = clean(request.userAnswer, "your answer");
return {
word,
shortMeaning: correctAnswer,
whyWrong: `Ban chon "${userAnswer}", nhung dap an dung la "${correctAnswer}". Hay kiem tra nghia chinh va ngu canh truoc khi chon.`,
correctUsage: `Dung "${word}" khi ngu canh khop voi nghia "${correctAnswer}".`,
example: clean(request.example, `Try using "${word}" in a short English sentence.`),
memoryTip: `Gan "${word}" voi mot hinh anh hoac tinh huong quen thuoc, roi tu nhac lai nghia tieng Viet.`,
collocations: [`${word} in context`, `use ${word} correctly`],
commonMistake: `De chon nham neu chi nhin tu gan nghia ma khong doc ky cau hoi.`,
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

let meaning = line("Short meaning", data.shortMeaning);
let why = line("Why wrong", data.whyWrong);
let usage = line("Correct usage", data.correctUsage);
let example = line("Example", data.example);
let tip = line("Memory tip", data.memoryTip);
let mistake = line("Common mistake", data.commonMistake);

panel.append(title, meaning, why, usage, example, tip, mistake);

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
item.appendChild(document.createTextNode(clean(value, "Chua co du lieu.")));
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
panel.textContent = "Generating explanation...";
setLoading(button, true);
let explanation = await requestExplanation(request);
render(panel, explanation);
setLoading(button, false);
}
};
})();
