import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

if (process.env.SKIP_POSTINSTALL === "1") {
  console.log("Skipping submodule initialization (SKIP_POSTINSTALL=1)");
  process.exit(0);
}

const gitmodulesPath = path.join(repoRoot, ".gitmodules");
if (!fs.existsSync(gitmodulesPath)) {
  process.exit(0);
}

console.log("Initializing git submodules...");
const result = spawnSync("git", ["submodule", "update", "--init", "--recursive"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Error: Failed to run git (${result.error.message})`);
  process.exit(1);
}

process.exit(result.status ?? 1);

