import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const frontendDir = "frontend";

const allowlist = [
  {
    file: "frontend/js/theme.js",
    source: "root.style.colorScheme = nextTheme;",
    count: 1,
    reason: "Browser color-scheme hint follows the selected theme."
  },
  {
    file: "frontend/js/login.js",
    source: "b.el.style.backgroundImage = `url(${framePaths[Math.floor(b.frame) % framePaths.length]})`;",
    count: 1,
    reason: "Animated login scene selects a runtime sprite frame."
  },
  {
    file: "frontend/js/login.js",
    source: "b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${angle}rad) scale(${depth})`;",
    count: 1,
    reason: "Animated login scene needs arbitrary per-frame coordinates."
  },
  {
    file: "frontend/js/login.js",
    source: "b.shadow.style.transform = `translate3d(${b.x}px, ${b.y + 22}px, 0) scale(${depth * 0.75})`;",
    count: 1,
    reason: "Animated login shadow follows arbitrary per-frame coordinates."
  },
  {
    file: "frontend/js/login.js",
    source: "b.shadow.style.opacity = String(0.16 + depth * 0.22);",
    count: 1,
    reason: "Animated login shadow opacity is continuous."
  },
  {
    file: "frontend/js/login.js",
    source: "dot.el.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0)`;",
    count: 1,
    reason: "Animated login particle coordinates are continuous."
  },
  {
    file: "frontend/js/login.js",
    source: "dot.el.style.opacity = String(Math.min(0.75, dot.life / 100));",
    count: 1,
    reason: "Animated login particle opacity is continuous."
  },
  {
    file: "frontend/js/analytics-dashboard.js",
    source: "fill.style.width = `${Math.round(Number(value) / max * 100)}%`;",
    count: 1,
    reason: "Analytics bars represent arbitrary measured percentages."
  },
  {
    file: "frontend/js/ui.js",
    source: "helper.style.display = \"block\";",
    count: 1,
    reason: "Legacy think-helper visibility remains for a later UI-state batch."
  },
  {
    file: "frontend/js/ui.js",
    source: "helper.style.display = \"none\";",
    count: 1,
    reason: "Legacy think-helper visibility remains for a later UI-state batch."
  },
  {
    file: "frontend/js/ui.js",
    source: "document.getElementById(\"think-helper\").style.display = \"none\";",
    count: 1,
    reason: "Legacy think-helper visibility remains for a later UI-state batch."
  },
  {
    file: "frontend/js/effects.js",
    source: "p.style.background = `hsl(${Math.random() * 360},100%,60%)`;",
    count: 1,
    reason: "Confetti uses an arbitrary runtime hue."
  },
  {
    file: "frontend/js/effects.js",
    source: "p.style.left = window.innerWidth / 2 + \"px\";",
    count: 1,
    reason: "Confetti origin follows the runtime viewport."
  },
  {
    file: "frontend/js/effects.js",
    source: "p.style.top = window.innerHeight / 2 + \"px\";",
    count: 1,
    reason: "Confetti origin follows the runtime viewport."
  },
  {
    file: "frontend/js/effects.js",
    source: "p.style.setProperty(\"--x\", x + \"px\");",
    count: 1,
    reason: "Confetti endpoint is an arbitrary generated coordinate."
  },
  {
    file: "frontend/js/effects.js",
    source: "p.style.setProperty(\"--y\", y + \"px\");",
    count: 1,
    reason: "Confetti endpoint is an arbitrary generated coordinate."
  },
  {
    file: "frontend/js/effects.js",
    source: "s.style.left = rect.right + \"px\";",
    count: 1,
    reason: "Progress spark origin follows measured element geometry."
  },
  {
    file: "frontend/js/effects.js",
    source: "s.style.top = rect.top + rect.height / 2 + \"px\";",
    count: 1,
    reason: "Progress spark origin follows measured element geometry."
  },
  {
    file: "frontend/js/effects.js",
    source: "s.style.setProperty(\"--x\", x + \"px\");",
    count: 1,
    reason: "Progress spark endpoint is an arbitrary generated coordinate."
  },
  {
    file: "frontend/js/effects.js",
    source: "s.style.setProperty(\"--y\", y + \"px\");",
    count: 1,
    reason: "Progress spark endpoint is an arbitrary generated coordinate."
  },
  {
    file: "frontend/js/timer.js",
    source: "progress.style.width = \"100%\";",
    count: 1,
    reason: "Timed quiz completion uses an arbitrary progress value boundary."
  },
  {
    file: "frontend/js/app.js",
    source: "if (profileXpBar) profileXpBar.style.width = levelProgress + \"%\";",
    count: 1,
    reason: "Profile XP bar represents an arbitrary calculated percentage."
  },
  {
    file: "frontend/js/review-today.js",
    source: "fill.style.width = percent + \"%\";",
    count: 1,
    reason: "Review progress represents an arbitrary calculated percentage."
  },
  {
    file: "frontend/js/quiz.js",
    source: "progress.style.width = \"0%\";",
    count: 2,
    reason: "Quiz progress resets to the semantic lower boundary."
  },
  {
    file: "frontend/js/quiz.js",
    source: "progress.style.width = percent + \"%\";",
    count: 1,
    reason: "Quiz progress represents an arbitrary calculated percentage."
  },
  {
    file: "frontend/js/quiz.js",
    source: "progress.style.width = \"100%\";",
    count: 1,
    reason: "Quiz completion uses the semantic upper boundary."
  }
];

function walk(dir, output = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) walk(fullPath, output);
    else if (entry.endsWith(".js") || entry.endsWith(".html")) output.push(fullPath);
  }
  return output;
}

function repoPath(file) {
  return normalize(file).replaceAll("\\", "/");
}

function sourceLine(content, offset) {
  const lineStart = content.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = content.indexOf("\n", offset);
  return content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
    .trim()
    .replace(/\s+/g, " ");
}

function lineNumber(content, offset) {
  return content.slice(0, offset).split("\n").length;
}

function collect(file, content, kind, regex, output) {
  for (const match of content.matchAll(regex)) {
    output.push({
      file: repoPath(file),
      line: lineNumber(content, match.index),
      kind,
      source: sourceLine(content, match.index)
    });
  }
}

const findings = [];
for (const file of walk(frontendDir)) {
  const content = readFileSync(file, "utf8");
  if (file.endsWith(".html")) {
    collect(file, content, "html-style-attribute", /\sstyle\s*=/gi, findings);
    continue;
  }

  collect(file, content, "dom-style-api", /\.style\b/g, findings);
  collect(file, content, "bracket-style-api", /\[\s*["']style["']\s*\]/g, findings);
  collect(file, content, "set-style-attribute", /\bsetAttribute\s*\(\s*["']style["']/g, findings);
  collect(file, content, "css-text-api", /\bcssText\b/g, findings);
}

function signature(item) {
  return `${item.file}\u0000${item.kind || "dom-style-api"}\u0000${item.source}`;
}

const expected = new Map(allowlist.map(item => [signature(item), item]));
const actualCounts = new Map();
for (const finding of findings) {
  const key = signature(finding);
  actualCounts.set(key, (actualCounts.get(key) || 0) + 1);
}

const unexpected = findings.filter(finding => !expected.has(signature(finding)));
const countMismatches = allowlist.filter(item => (actualCounts.get(signature(item)) || 0) !== item.count);

for (const finding of findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  const approved = expected.get(signature(finding));
  console.log(`${finding.file}:${finding.line} [${finding.kind}] ${approved ? "ALLOW" : "NEW"} ${finding.source}`);
}

if (unexpected.length || countMismatches.length) {
  if (unexpected.length) {
    console.error("Unexpected inline style usage:");
    for (const item of unexpected) console.error(`- ${item.file}:${item.line} ${item.source}`);
  }
  if (countMismatches.length) {
    console.error("Inline style allowlist count mismatch:");
    for (const item of countMismatches) {
      console.error(`- ${item.file}: expected ${item.count}, found ${actualCounts.get(signature(item)) || 0}: ${item.source}`);
    }
  }
  process.exit(1);
}

const files = new Set(findings.map(item => item.file));
console.log(`Inline style guard passed: ${findings.length} allowlisted usages across ${files.size} files; no HTML style attributes or unapproved JS style APIs.`);
