import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function walk(dir) {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function normalizePath(...parts) {
  const joined = parts
    .filter(Boolean)
    .join("/")
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/");
  return joined.startsWith("/") ? joined : `/${joined}`;
}

function collectControllerRoutes() {
  const files = walk("backend/src/main/java").filter((file) => file.endsWith("Controller.java"));
  const routes = [];
  const classMappingRegex = /@RequestMapping\("([^"]*)"\)[\s\S]*?class\s+\w+/;
  const methodMappingRegex = /@(Get|Post|Put|Delete|Patch)Mapping\("([^"]*)"\)/g;

  for (const file of files) {
    const source = read(file);
    const basePath = classMappingRegex.exec(source)?.[1] ?? "";
    for (const match of source.matchAll(methodMappingRegex)) {
      routes.push({
        method: match[1].toUpperCase(),
        path: normalizePath(basePath, match[2]),
        file
      });
    }
  }
  return routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

function collectEnvKeys() {
  const files = [
    "backend/src/main/resources/application.yml",
    "backend/src/main/resources/application.properties",
    "backend/src/main/resources/application-prod.yml"
  ];
  const keys = new Set();
  const envRegex = /\$\{([A-Z][A-Z0-9_]*)(?=[:}])/g;
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(envRegex)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function collectMigrationVersions() {
  return walk("backend/src/main/resources/db/migration")
    .map((file) => path.basename(file))
    .map((fileName) => {
      const match = /^V(\d+)__.*\.sql$/.exec(fileName);
      return match ? { version: Number(match[1]), fileName } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
}

function includesRoute(apiDocs, route) {
  return apiDocs.includes(`${route.method} \`${route.path}\``)
    || apiDocs.includes(`| ${route.method} | \`${route.path}\``);
}

const failures = [];
const apiDocs = read("docs/API.md");
const testingDocs = read("docs/TESTING.md");
const databaseDocs = read("docs/DATABASE.md");
const deploymentDocs = read("docs/DEPLOYMENT.md");
const backendPostgresDocs = read("docs/backend-postgres.md");
const productDocs = read("docs/product.md");

for (const route of collectControllerRoutes()) {
  if (!includesRoute(apiDocs, route)) {
    failures.push(`docs/API.md is missing ${route.method} ${route.path} from ${route.file}.`);
  }
}

const requiredPublicRoutes = [
  "/api/health/**",
  "/api/csrf",
  "/api/me",
  "/actuator/health",
  "/actuator/info",
  "/actuator/metrics",
  "/actuator/metrics/**"
];
for (const route of requiredPublicRoutes) {
  if (!apiDocs.includes(`\`${route}\``)) {
    failures.push(`docs/API.md is missing public route classification for ${route}.`);
  }
}

const migrations = collectMigrationVersions();
const latestMigration = migrations.at(-1);
if (!latestMigration) {
  failures.push("No Flyway migrations were found.");
} else {
  for (const [file, docs] of [
    ["docs/API.md", apiDocs],
    ["docs/TESTING.md", testingDocs],
    ["docs/DATABASE.md", databaseDocs]
  ]) {
    if (!docs.includes(latestMigration.fileName)) {
      failures.push(`${file} does not mention latest migration ${latestMigration.fileName}.`);
    }
  }
  if (/V1\s*[-\u2192>]+\s*V3/.test(testingDocs)) {
    failures.push("docs/TESTING.md still claims the PostgreSQL migration path stops at V3.");
  }
}

for (const key of collectEnvKeys()) {
  if (!apiDocs.includes(`\`${key}\``) && !deploymentDocs.includes(`\`${key}\``)) {
    failures.push(`Environment key ${key} is not documented in docs/API.md or docs/DEPLOYMENT.md.`);
  }
}

if (productDocs.includes("- CSV import/export.")) {
  failures.push("docs/product.md still lists CSV import/export as a future roadmap item.");
}
if (!productDocs.includes("CSV bulk import") || !productDocs.includes("CSV template download")) {
  failures.push("docs/product.md must document current CSV import/template support.");
}

if (backendPostgresDocs.includes("All app APIs require an authenticated Google session except the OAuth/login routes.")) {
  failures.push("docs/backend-postgres.md still overstates that every non-OAuth app API requires auth.");
}
for (const publicRoute of ["/api/health", "/api/csrf", "/api/me", "/actuator/metrics"]) {
  if (!backendPostgresDocs.includes(`\`${publicRoute}\``)) {
    failures.push(`docs/backend-postgres.md is missing public endpoint note for ${publicRoute}.`);
  }
}

if (failures.length > 0) {
  console.error("Docs drift check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Docs drift check passed: ${collectControllerRoutes().length} controller routes, ${collectEnvKeys().length} env keys, latest migration ${latestMigration.fileName}.`);
