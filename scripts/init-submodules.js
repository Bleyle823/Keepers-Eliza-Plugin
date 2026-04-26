import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// Skip if SKIP_POSTINSTALL is set (useful for CI environments)
if (process.env.SKIP_POSTINSTALL === "1") {
  console.log("Skipping submodule initialization (SKIP_POSTINSTALL=1)");
  process.exit(0);
}

const gitmodulesPath = path.join(repoRoot, ".gitmodules");
if (!fs.existsSync(gitmodulesPath)) {
  // Many installs (especially on Windows) don't need submodules; don't fail.
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
