import { pass, fail, blocked, notRun } from "./lib.mjs";

const [, , name, status, ...messageParts] = process.argv;
const message = messageParts.join(" ").trim();

if (!name || !status) {
  console.error("Usage: node scripts/production-release-gate/mark-control.mjs <name> <PASS|FAIL|BLOCKED|NOT_RUN> [message]");
  process.exit(2);
}

const details = message ? { message } : {};
switch (status.toUpperCase()) {
  case "PASS":
    pass(name, details);
    break;
  case "FAIL":
    fail(name, details);
    break;
  case "BLOCKED":
    blocked(name, details);
    break;
  case "NOT_RUN":
    notRun(name, details);
    break;
  default:
    console.error(`Unknown status: ${status}`);
    process.exit(2);
}
