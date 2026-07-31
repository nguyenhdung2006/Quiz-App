import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fail, pass, reportDir, writeJson } from "./lib.mjs";

const control = "frontend-static-build";
const findings = [];
const checkedJs = [];
const checkedHtml = [];

function walk(dir, predicate, output = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, predicate, output);
    else if (predicate(path)) output.push(path);
  }
  return output;
}

for (const file of walk("frontend", (path) => path.endsWith(".js"))) {
  checkedJs.push(file);
  try {
    new Function(readFileSync(file, "utf8"));
  } catch (error) {
    findings.push({ file, message: "JavaScript syntax parse failed.", output: String(error.message || error).slice(0, 4000) });
  }
}

for (const file of walk("frontend", (path) => path.endsWith(".html"))) {
  checkedHtml.push(file);
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(/<(?:script|link|img|source|audio)[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
    const ref = match[1].split("#")[0].split("?")[0];
    if (/^(https?:)?\/\//i.test(ref) || ref.startsWith("#") || ref.startsWith("data:")) continue;
    const target = join("frontend", ref.replace(/^\.?\//, ""));
    if (!existsSync(target)) {
      findings.push({ file, message: "Referenced frontend asset is missing.", asset: ref });
    }
  }
}

writeJson(join(reportDir, "frontend-static-build.json"), {
  checkedJs,
  checkedHtml,
  findings
});

if (findings.length) {
  fail(control, { checkedJs: checkedJs.length, checkedHtml: checkedHtml.length, findings });
} else {
  pass(control, { checkedJs: checkedJs.length, checkedHtml: checkedHtml.length });
}
