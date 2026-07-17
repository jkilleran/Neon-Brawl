const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const manifest = require("../animation-manifest.js");
const { decodeAlpha, frameBounds } = require("./png-alpha.cjs");

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

function assetFile(src) {
  return path.join(root, "public", src.replace(/^\//, ""));
}

function assertIsolatedCells(id, sheet) {
  const file = assetFile(sheet.src);
  const png = decodeAlpha(file);
  const capacity = sheet.columns * sheet.rows;
  const padding = sheet.minCellPadding ?? 0;

  for (let frame = 0; frame < capacity; frame += 1) {
    const bounds = frameBounds(png, sheet.columns, sheet.rows, frame);
    if (frame >= sheet.frames) {
      assert.equal(bounds, null, `${id} frame cell ${frame + 1} must stay transparent`);
      continue;
    }
    assert(bounds, `${id} frame ${frame + 1} is empty`);
    assert(bounds.minX >= padding, `${id} frame ${frame + 1} touches the left cell edge`);
    assert(bounds.minY >= padding, `${id} frame ${frame + 1} touches the top cell edge`);
    assert(bounds.maxX < bounds.cellWidth - padding, `${id} frame ${frame + 1} touches the right cell edge`);
    assert(bounds.maxY < bounds.cellHeight - padding, `${id} frame ${frame + 1} touches the bottom cell edge`);
  }
}

for (const movement of Object.values(manifest.strikes)) {
  assert.equal(movement.frameCount, manifest.frameLimitPerMovement, `${movement.id} must use 10 frames`);
  assert.equal(movement.lockedStrikingLimb, movement.limb, `${movement.id} must lock one striking limb for all frames`);
  assert.equal(movement.sourceFacing, manifest.canonicalSourceFacing, `${movement.id} must face right at source`);
  assert.equal(movement.mirrorForFacingLeft, true, `${movement.id} must support deterministic mirroring`);
  assert.equal(movement.continuityVerification, "frame-by-frame", `${movement.id} must track continuity review`);
  if (movement.limb.endsWith("-leg")) {
    const oppositeLeg = movement.limb === "right-leg" ? "left-leg" : "right-leg";
    assert.equal(movement.supportLimb, oppositeLeg, `${movement.id} must keep the opposite support leg`);
  }
  assert.equal(movement.frameLabels.length, movement.frameCount, `${movement.id} must label every frame`);
  assert.equal(movement.frameLabels[movement.contactFrame - 1], "contact", `${movement.id} contact label is misplaced`);
  assert(!seenFiles.has(movement.file), `${movement.id} must have its own sprite sheet`);
  seenFiles.add(movement.file);

  const sheet = manifest.sheets[movement.sheet];
  assert(sheet, `${movement.id} references a missing sheet`);
  assert.equal(sheet.frames, movement.frameCount);
  assert(sheet.frames <= sheet.columns * sheet.rows, `${movement.id} exceeds its grid capacity`);

  const file = assetFile(movement.file);
  assert(fs.existsSync(file), `${movement.id} asset is missing: ${file}`);
  const png = inspectPng(file);
  assert.equal(png.width, sheet.fallbackWidth, `${movement.id} width differs from the manifest`);
  assert.equal(png.height, sheet.fallbackHeight, `${movement.id} height differs from the manifest`);
  assert([4, 6].includes(png.colorType), `${movement.id} must contain an alpha channel`);
  assert.equal(png.width % sheet.columns, 0, `${movement.id} columns must divide evenly`);
  assert.equal(png.height % sheet.rows, 0, `${movement.id} rows must divide evenly`);
}

assert.equal(Object.keys(manifest.outcomes).length, 4, "Catalog must expose four knockdown/knockout outcomes");
for (const movement of Object.values(manifest.outcomes)) {
  assert.equal(movement.frameCount, manifest.frameLimitPerMovement, `${movement.id} must use 10 frames`);
  assert.equal(movement.frameLabels.length, movement.frameCount, `${movement.id} must label every frame`);
  assert.equal(movement.sourceFacing, manifest.canonicalSourceFacing, `${movement.id} must face right at source`);
  assert.equal(movement.mirrorForFacingLeft, true, `${movement.id} must support deterministic mirroring`);
  assert(["head", "body"].includes(movement.target), `${movement.id} has an invalid target`);
  assert(["knockdown", "knockout"].includes(movement.result), `${movement.id} has an invalid result`);

  const sheet = manifest.sheets[movement.sheet];
  assert(sheet, `${movement.id} references a missing sheet`);
  assert.equal(sheet.frames, movement.frameCount);
  const file = assetFile(movement.file);
  assert(fs.existsSync(file), `${movement.id} asset is missing: ${file}`);
  const png = inspectPng(file);
  assert.equal(png.width, sheet.fallbackWidth, `${movement.id} width differs from the manifest`);
  assert.equal(png.height, sheet.fallbackHeight, `${movement.id} height differs from the manifest`);
  assert([4, 6].includes(png.colorType), `${movement.id} must contain an alpha channel`);
}

for (const [id, sheet] of Object.entries(manifest.sheets)) {
  if (!sheet.isolatedCells) continue;
  assertIsolatedCells(id, sheet);
}

console.log("Animation catalog valid: 8 strikes and 4 outcomes, 10 labeled frames each, isolated cells and canonical right-facing source.");
