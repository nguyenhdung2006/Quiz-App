import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const frontendDir = "frontend";
const cssDir = join(frontendDir, "css");
const allowlist = new Map();

function walk(dir, predicate, output = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) walk(fullPath, predicate, output);
    else if (predicate(fullPath)) output.push(normalize(fullPath));
  }
  return output;
}

function cleanRef(ref) {
  return ref.split("#")[0].split("?")[0].replace(/^\.?\//, "");
}

function toRepoPath(path) {
  return normalize(path).replaceAll("\\", "/");
}

function resolveAsset(fromFile, ref) {
  const cleaned = cleanRef(ref);
  if (/^(https?:)?\/\//i.test(cleaned) || cleaned.startsWith("data:") || cleaned.startsWith("#")) {
    return null;
  }

  if (cleaned.startsWith("css/")) return normalize(join(frontendDir, cleaned));
  return normalize(join(dirname(fromFile), cleaned));
}

const cssFiles = new Set(walk(cssDir, (path) => path.endsWith(".css")));
const referencedCss = new Map();
const missingReferences = [];

for (const htmlFile of walk(frontendDir, (path) => path.endsWith(".html"))) {
  const html = readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(/<link\b[^>]*rel=["'][^"']*\bstylesheet\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const target = resolveAsset(htmlFile, match[1]);
    if (!target) continue;
    if (!existsSync(target)) missingReferences.push({ source: toRepoPath(htmlFile), ref: match[1] });
    else referencedCss.set(target, [...(referencedCss.get(target) || []), toRepoPath(htmlFile)]);
  }
}

for (const cssFile of cssFiles) {
  const css = readFileSync(cssFile, "utf8");
  for (const match of css.matchAll(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?/gi)) {
    const target = resolveAsset(cssFile, match[1]);
    if (!target) continue;
    if (!existsSync(target)) missingReferences.push({ source: toRepoPath(cssFile), ref: match[1] });
    else referencedCss.set(target, [...(referencedCss.get(target) || []), toRepoPath(cssFile)]);
  }
}

const orphanCss = [...cssFiles]
  .filter((file) => !referencedCss.has(file) && !allowlist.has(toRepoPath(file)))
  .map(toRepoPath)
  .sort();

const inventory = [...cssFiles].sort().map((file) => {
  const repoPath = toRepoPath(file);
  const references = referencedCss.get(file) || [];
  return {
    file: repoPath,
    referencedBy: references.length ? references.join(", ") : allowlist.get(repoPath) || "UNREFERENCED",
  };
});

for (const row of inventory) {
  console.log(`${row.file} <- ${row.referencedBy}`);
}

if (missingReferences.length || orphanCss.length) {
  if (missingReferences.length) {
    console.error("Missing CSS references:");
    for (const item of missingReferences) console.error(`- ${item.source} -> ${item.ref}`);
  }
  if (orphanCss.length) {
    console.error("Unreferenced CSS files:");
    for (const file of orphanCss) console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`CSS asset check passed: ${cssFiles.size} stylesheet files are referenced or allowlisted.`);
