const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const manifest = require("../animation-manifest.js");

const root = path.join(__dirname, "..");
const seenFiles = new Set();

function inspectPng(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

for (const movement of Object.values(manifest.strikes)) {
  assert.equal(movement.frameCount, manifest.frameLimitPerMovement, `${movement.id} must use 10 frames`);
  assert.equal(movement.sourceFacing, manifest.canonicalSourceFacing, `${movement.id} must face right at source`);
  assert.equal(movement.mirrorForFacingLeft, true, `${movement.id} must support deterministic mirroring`);
  assert.equal(movement.frameLabels.length, movement.frameCount, `${movement.id} must label every frame`);
  assert.equal(movement.frameLabels[movement.contactFrame - 1], "contact", `${movement.id} contact label is misplaced`);
  assert(!seenFiles.has(movement.file), `${movement.id} must have its own sprite sheet`);
  seenFiles.add(movement.file);

  const sheet = manifest.sheets[movement.sheet];
  assert(sheet, `${movement.id} references a missing sheet`);
  assert.equal(sheet.frames, movement.frameCount);
  assert(sheet.frames <= sheet.columns * sheet.rows, `${movement.id} exceeds its grid capacity`);

  const file = path.join(root, "public", movement.file.replace(/^\/assets\//, "assets/"));
  assert(fs.existsSync(file), `${movement.id} asset is missing: ${file}`);
  const png = inspectPng(file);
  assert.equal(png.width, sheet.fallbackWidth, `${movement.id} width differs from the manifest`);
  assert.equal(png.height, sheet.fallbackHeight, `${movement.id} height differs from the manifest`);
  assert([4, 6].includes(png.colorType), `${movement.id} must contain an alpha channel`);
  assert.equal(png.width % sheet.columns, 0, `${movement.id} columns must divide evenly`);
  assert.equal(png.height % sheet.rows, 0, `${movement.id} rows must divide evenly`);
}

console.log("Animation catalog valid: 8 isolated strikes, 10 labeled frames each, canonical right-facing source.");
