"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const manifest = require("../animation-manifest.js");
const { decodeAlpha, frameBounds } = require("./png-alpha.cjs");

const root = path.join(__dirname, "..");
const movementEntries = Object.entries(manifest.movements);
const characterEntries = Object.entries(manifest.characters);

function inspectPng(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

function assetFile(src) {
  return path.join(root, "public", src.replace(/^\//, ""));
}

function assertIsolatedCells(characterId, movementId, sheet) {
  const png = decodeAlpha(assetFile(sheet.src));
  const capacity = sheet.columns * sheet.rows;
  const padding = sheet.minCellPadding ?? 0;

  for (let frame = 0; frame < capacity; frame += 1) {
    const bounds = frameBounds(png, sheet.columns, sheet.rows, frame);
    const label = `${characterId}/${movementId} frame ${frame + 1}`;
    if (frame >= sheet.frames) {
      assert.equal(bounds, null, `${label} must stay transparent`);
      continue;
    }
    assert(bounds, `${label} is empty`);
    assert(bounds.minX >= padding, `${label} touches the left cell edge`);
    assert(bounds.minY >= padding, `${label} touches the top cell edge`);
    assert(bounds.maxX < bounds.cellWidth - padding, `${label} touches the right cell edge`);
    assert(bounds.maxY < bounds.cellHeight - padding, `${label} touches the bottom cell edge`);
  }
}

assert.equal(characterEntries.length, 2, "Catalog must expose the Rook and Vex sprite libraries");
assert.equal(Object.keys(manifest.strikes).length, 8, "Catalog must expose eight strikes");
assert.equal(Object.keys(manifest.outcomes).length, 18, "Catalog must expose ten knockdowns and eight knockouts");
assert.equal(Object.keys(manifest.support).length, 9, "Catalog must expose nine independent support movements");
assert.equal(Object.keys(manifest.legacy).length, 1, "Catalog must preserve the disabled legacy ground movement");
assert.equal(movementEntries.length, 36, "Each character must expose 36 movements");

for (const movement of Object.values(manifest.strikes)) {
  assert.equal(movement.frameCount, manifest.frameLimitPerMovement, `${movement.id} must use 10 frames`);
  assert.equal(movement.lockedStrikingLimb, movement.limb, `${movement.id} must lock one striking limb`);
  assert.equal(movement.sourceFacing, manifest.canonicalSourceFacing, `${movement.id} must face right at source`);
  assert.equal(movement.mirrorForFacingLeft, true, `${movement.id} must support deterministic mirroring`);
  assert.equal(movement.continuityVerification, "frame-by-frame", `${movement.id} must track continuity review`);
  if (movement.limb.endsWith("-leg")) {
    const oppositeLeg = movement.limb === "right-leg" ? "left-leg" : "right-leg";
    assert.equal(movement.supportLimb, oppositeLeg, `${movement.id} must keep the opposite support leg`);
  }
  assert.equal(movement.frameLabels[movement.contactFrame - 1], "contact", `${movement.id} contact label is misplaced`);
}

for (const movement of Object.values(manifest.outcomes)) {
  assert(["head", "body"].includes(movement.target), `${movement.id} has an invalid target`);
  assert(["knockdown", "knockout"].includes(movement.result), `${movement.id} has an invalid result`);
  assert.equal(typeof movement.variant, "string", `${movement.id} must label its visual variant`);
  assert(movement.variant.length > 0, `${movement.id} has an empty visual variant`);
}

for (const [movementId, movement] of movementEntries) {
  assert.equal(movement.frameLabels.length, movement.frameCount, `${movementId} must label every frame`);
  assert.equal(movement.grid.frames, movement.frameCount, `${movementId} grid/frame count mismatch`);
  assert(movement.grid.frames <= movement.grid.columns * movement.grid.rows, `${movementId} exceeds its grid`);
  assert.equal(movement.sourceFacing, manifest.canonicalSourceFacing, `${movementId} source facing mismatch`);
  assert.equal(movement.mirrorForFacingLeft, true, `${movementId} must support mirroring`);
  assert.equal(typeof movement.folder, "string", `${movementId} must define a folder`);
}

for (const [characterId, character] of characterEntries) {
  assert.equal(Object.keys(character.sheets).length, movementEntries.length, `${characterId} sheet list is incomplete`);
  const sources = new Set();

  for (const [movementId, movement] of movementEntries) {
    const sheet = character.sheets[movement.sheet];
    assert(sheet, `${characterId}/${movementId} references a missing sheet`);
    assert(!sources.has(sheet.src), `${characterId}/${movementId} must have its own runtime sheet`);
    sources.add(sheet.src);
    assert.equal(sheet.frames, movement.frameCount);

    const file = assetFile(sheet.src);
    assert(fs.existsSync(file), `${characterId}/${movementId} asset is missing: ${file}`);
    const png = inspectPng(file);
    assert.equal(png.width, sheet.fallbackWidth, `${characterId}/${movementId} width differs from the manifest`);
    assert.equal(png.height, sheet.fallbackHeight, `${characterId}/${movementId} height differs from the manifest`);
    assert([4, 6].includes(png.colorType), `${characterId}/${movementId} must contain an alpha channel`);
    if (sheet.isolatedCells) assertIsolatedCells(characterId, movementId, sheet);
  }
}

console.log("Animation catalog valid: 2 character libraries, 36 labeled movements each, isolated cells and canonical right-facing source.");
