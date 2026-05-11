#!/usr/bin/env node
// Replaces hardlinked workspace package copies in node_modules with directory
// junctions/symlinks pointing back at the source package directory. This is
// required on Windows where bun installs workspaces by hardlinking individual
// files at install-time, which means later-built artifacts (e.g. dist/) never
// appear under node_modules/<pkg>.
//
// Safe to run repeatedly: existing symlinks/junctions are left in place.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const PACKAGES_DIR = path.join(repoRoot, "packages");
const NODE_MODULES = path.join(repoRoot, "node_modules");

if (!fs.existsSync(PACKAGES_DIR)) {
  console.log(`No packages/ directory at ${PACKAGES_DIR}, nothing to do`);
  process.exit(0);
}

if (!fs.existsSync(NODE_MODULES)) {
  console.log(`No node_modules/ directory; run "bun install" first.`);
  process.exit(0);
}

const symlinkType = process.platform === "win32" ? "junction" : "dir";

const stats = { linked: 0, skipped: 0, missing: 0 };

for (const entry of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgPath = path.join(PACKAGES_DIR, entry.name);
  const pkgJsonPath = path.join(pkgPath, "package.json");
  if (!fs.existsSync(pkgJsonPath)) continue;

  let pkgJson;
  try {
    pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  } catch (err) {
    console.warn(`! Could not parse ${pkgJsonPath}: ${err.message}`);
    continue;
  }

  const name = pkgJson.name;
  if (!name) continue;

  const linkTarget = path.join(NODE_MODULES, ...name.split("/"));
  const parent = path.dirname(linkTarget);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  let existing;
  try {
    existing = fs.lstatSync(linkTarget);
  } catch {
    existing = null;
  }

  if (existing) {
    if (existing.isSymbolicLink()) {
      stats.skipped++;
      continue;
    }
    fs.rmSync(linkTarget, { recursive: true, force: true });
  } else {
    stats.missing++;
  }

  try {
    fs.symlinkSync(pkgPath, linkTarget, symlinkType);
    console.log(`✓ Linked ${name} -> ${path.relative(repoRoot, pkgPath)}`);
    stats.linked++;
  } catch (err) {
    console.error(
      `✗ Failed to link ${name} -> ${pkgPath}: ${err.message}\n` +
        `  (On Windows you may need Developer Mode enabled or to run as administrator.)`
    );
    process.exitCode = 1;
  }
}

console.log(
  `\nWorkspace links: ${stats.linked} created, ${stats.skipped} already linked, ${stats.missing} were absent.`
);
