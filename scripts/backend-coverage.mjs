import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const mvnw = platform() === "win32" ? ".\\mvnw.cmd" : "./mvnw";
const result = spawnSync(mvnw, ["verify"], {
  cwd: "backend",
  shell: platform() === "win32",
  stdio: "inherit",
});

process.exit(result.status || 0);
