"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const charactersRoot = path.join(root, "dist", "assets", "characters");
const archive = path.join(charactersRoot, "prototype-fighter");

function removeFrameDirectories(directory) {
  if (!fs.existsSync(directory)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = path.join(directory, entry.name);
    if (entry.name === "frames") {
      fs.rmSync(target, { recursive: true, force: true });
      removed += 1;
    } else {
      removed += removeFrameDirectories(target);
    }
  }
  return removed;
}

if (!fs.existsSync(charactersRoot)) {
  throw new Error("Production character assets are missing. Run Vite before pruning.");
}

if (fs.existsSync(archive)) fs.rmSync(archive, { recursive: true, force: true });
const removedFrameDirectories = removeFrameDirectories(charactersRoot);

console.log(`Production assets pruned: source archive removed and ${removedFrameDirectories} frame directories excluded.`);
