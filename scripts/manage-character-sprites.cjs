"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const manifest = require("../animation-manifest.js");

const root = path.join(__dirname, "..");
const publicRoot = path.join(root, "public", "assets");
const charactersRoot = path.join(publicRoot, "characters");
const archiveRoot = path.join(
  charactersRoot,
  "prototype-fighter",
  "source-archive",
  "original-assets",
);

const movementEntries = Object.entries(manifest.movements);
const characterEntries = Object.entries(manifest.characters);
const resolveMovement = (characterId, movement) => manifest.resolveMovement(characterId, movement);

function findImageMagick() {
  for (const command of ["magick", "convert"]) {
    const probe = spawnSync(command, ["-version"], { encoding: "utf8" });
    if (probe.status === 0) return command;
  }
  throw new Error("ImageMagick is required for sprite extraction and sheet rebuilding.");
}

let imageMagick;

function runImageMagick(args) {
  imageMagick ??= findImageMagick();
  const result = spawnSync(imageMagick, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${imageMagick} ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
}

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function frameName(index, label) {
  return `frame-${String(index + 1).padStart(2, "0")}-${slug(label)}.png`;
}

function movementFolder(characterId, movement) {
  return path.join(charactersRoot, characterId, movement.folder);
}

function sheetFile(characterId, movement) {
  return path.join(movementFolder(characterId, movement), "sheet.png");
}

function framesFolder(characterId, movement) {
  return path.join(movementFolder(characterId, movement), "frames");
}

function frameBounds(grid, frame) {
  const column = frame % grid.columns;
  const row = Math.floor(frame / grid.columns);
  const x0 = Math.round(column * grid.fallbackWidth / grid.columns);
  const x1 = Math.round((column + 1) * grid.fallbackWidth / grid.columns);
  const y0 = Math.round(row * grid.fallbackHeight / grid.rows);
  const y1 = Math.round((row + 1) * grid.fallbackHeight / grid.rows);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function frameRecords(characterId, movement) {
  return movement.frameLabels.map((label, index) => ({
    index: index + 1,
    label,
    file: `${movement.folder}/frames/${frameName(index, label)}`,
  }));
}

function movementRecord(characterId, movement) {
  return {
    id: movement.id,
    label: movement.label,
    category: movement.category,
    target: movement.target ?? null,
    result: movement.result ?? null,
    variant: movement.variant ?? null,
    limb: movement.limb ?? null,
    supportLimb: movement.supportLimb ?? null,
    input: movement.input ?? null,
    folder: movement.folder,
    runtimeSheet: `${movement.folder}/sheet.png`,
    frameCount: movement.frameCount,
    contactFrame: movement.contactFrame ?? null,
    canonicalFacing: movement.sourceFacing,
    mirrorForFacingLeft: movement.mirrorForFacingLeft,
    grid: movement.grid,
    provenance: movement.provenance,
    verification: movement.verification,
    archiveSource: movement.archiveSource
      ? `/assets/characters/prototype-fighter/source-archive/original-assets/${movement.archiveSource}`
      : null,
    frames: frameRecords(characterId, movement),
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCatalog(characterId) {
  const character = manifest.characters[characterId];
  assert(character, `Unknown character: ${characterId}`);
  const characterRoot = path.join(charactersRoot, characterId);
  const movements = movementEntries.map(([, movement]) => (
    movementRecord(characterId, resolveMovement(characterId, movement))
  ));

  writeJson(path.join(characterRoot, "character.json"), {
    schemaVersion: manifest.assetSchemaVersion,
    id: character.id,
    displayName: character.displayName,
    role: character.role,
    animationProfile: character.animationProfile,
    palette: character.palette,
    canonicalFacing: manifest.canonicalSourceFacing,
    movementList: "movement-list.json",
    animationRoot: "animations",
    movementCount: movements.length,
  });

  writeJson(path.join(characterRoot, "movement-list.json"), {
    schemaVersion: manifest.assetSchemaVersion,
    characterId: character.id,
    displayName: character.displayName,
    canonicalFacing: manifest.canonicalSourceFacing,
    frameReplacementWorkflow: [
      "Replace one PNG inside the movement frames directory.",
      `Run: npm run sprites:build -- ${characterId} <movementId>`,
      "Run: npm run check",
    ],
    movements,
  });

  for (const [, baseMovement] of movementEntries) {
    const movement = resolveMovement(characterId, baseMovement);
    writeJson(
      path.join(movementFolder(characterId, movement), "movement.json"),
      movementRecord(characterId, movement),
    );
  }
}

function extractMovement(characterId, movement, overwrite = false) {
  const source = sheetFile(characterId, movement);
  assert(fs.existsSync(source), `Missing runtime sheet: ${source}`);
  const size = readPngSize(source);
  assert.deepEqual(size, {
    width: movement.grid.fallbackWidth,
    height: movement.grid.fallbackHeight,
  }, `${movement.id} sheet dimensions do not match its grid`);

  const output = framesFolder(characterId, movement);
  fs.mkdirSync(output, { recursive: true });

  movement.frameLabels.forEach((label, index) => {
    const target = path.join(output, frameName(index, label));
    if (fs.existsSync(target) && !overwrite) {
      throw new Error(`Frame already exists: ${target}. Use --force to replace extracted frames.`);
    }
    const bounds = frameBounds(movement.grid, index);
    runImageMagick([
      source,
      "-gravity", "northwest",
      "-crop", `${bounds.width}x${bounds.height}+${bounds.x}+${bounds.y}`,
      "+repage",
      target,
    ]);
  });
}

function buildMovement(characterId, movement) {
  const output = sheetFile(characterId, movement);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "neon-brawl-sprite-build-"));
  let current = path.join(temporary, "sheet-0.png");

  try {
    runImageMagick([
      "-size",
      `${movement.grid.fallbackWidth}x${movement.grid.fallbackHeight}`,
      "xc:none",
      current,
    ]);

    movement.frameLabels.forEach((label, index) => {
      const frame = path.join(framesFolder(characterId, movement), frameName(index, label));
      assert(fs.existsSync(frame), `Missing frame: ${frame}`);
      const bounds = frameBounds(movement.grid, index);
      assert.deepEqual(readPngSize(frame), {
        width: bounds.width,
        height: bounds.height,
      }, `${movement.id} frame ${index + 1} has the wrong dimensions`);

      const next = path.join(temporary, `sheet-${index + 1}.png`);
      runImageMagick([
        current,
        frame,
        "-gravity", "northwest",
        "-geometry", `+${bounds.x}+${bounds.y}`,
        "-composite",
        next,
      ]);
      current = next;
    });

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(current, output);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function seedMovement(characterId, movement, overwrite) {
  assert(movement.archiveSource, `${characterId}/${movement.id} has no archived seed; add generated frames and run sprites:build`);
  const source = path.join(archiveRoot, movement.archiveSource);
  const output = sheetFile(characterId, movement);
  assert(fs.existsSync(source), `Missing archived source: ${source}`);
  if (fs.existsSync(output) && !overwrite) {
    throw new Error(`Runtime sheet already exists: ${output}. Use --force to reseed it.`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });

  if (movement.archiveGrid) {
    const sourceCellHeight = movement.archiveGrid.fallbackHeight / movement.archiveGrid.rows;
    const startRow = Math.floor(movement.archiveFrameOffset / movement.archiveGrid.columns);
    const y = Math.round(startRow * sourceCellHeight);
    runImageMagick([
      source,
      "-gravity", "northwest",
      "-crop", `${movement.grid.fallbackWidth}x${movement.grid.fallbackHeight}+0+${y}`,
      "+repage",
      output,
    ]);
  } else {
    fs.copyFileSync(source, output);
  }

  extractMovement(characterId, movement, overwrite);
}

function selectedEntries(characterId, movementId) {
  const characters = characterId
    ? [[characterId, manifest.characters[characterId]]]
    : characterEntries;
  characters.forEach(([id, character]) => assert(character, `Unknown character: ${id}`));

  const movements = movementId
    ? [[movementId, manifest.movements[movementId]]]
    : movementEntries;
  movements.forEach(([id, movement]) => assert(movement, `Unknown movement: ${id}`));
  return { characters, movements };
}

function validateLibrary() {
  for (const [characterId, character] of characterEntries) {
    const characterRoot = path.join(charactersRoot, characterId);
    const characterMetadata = JSON.parse(fs.readFileSync(path.join(characterRoot, "character.json"), "utf8"));
    const movementList = JSON.parse(fs.readFileSync(path.join(characterRoot, "movement-list.json"), "utf8"));
    assert.equal(characterMetadata.id, characterId);
    assert.equal(characterMetadata.displayName, character.displayName);
    assert.equal(movementList.movements.length, movementEntries.length);
    assert.deepEqual(
      movementList.movements.map(({ id }) => id),
      movementEntries.map(([id]) => id),
      `${characterId} movement list is out of sync`,
    );

    for (const [movementId, baseMovement] of movementEntries) {
      const movement = resolveMovement(characterId, baseMovement);
      const runtimeSheet = sheetFile(characterId, movement);
      assert(fs.existsSync(runtimeSheet), `${characterId}/${movementId} runtime sheet is missing`);
      assert.deepEqual(readPngSize(runtimeSheet), {
        width: movement.grid.fallbackWidth,
        height: movement.grid.fallbackHeight,
      });

      const metadataFile = path.join(movementFolder(characterId, movement), "movement.json");
      const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
      assert.equal(metadata.id, movementId);
      assert.equal(metadata.frames.length, movement.frameCount);

      movement.frameLabels.forEach((label, index) => {
        const frame = path.join(framesFolder(characterId, movement), frameName(index, label));
        assert(fs.existsSync(frame), `${characterId}/${movementId} frame ${index + 1} is missing`);
        const bounds = frameBounds(movement.grid, index);
        assert.deepEqual(readPngSize(frame), { width: bounds.width, height: bounds.height });
      });
    }
  }
  console.log(`Character sprite library valid: ${characterEntries.length} characters, ${movementEntries.length} movements each.`);
}

function listLibrary() {
  console.log("CHARACTERS");
  characterEntries.forEach(([id, character]) => (
    console.log(`- ${id}: ${character.displayName} (${character.role}) [${character.animationProfile}]`)
  ));
  console.log("\nMOVEMENTS");
  movementEntries.forEach(([id, movement]) => {
    console.log(`- ${id.padEnd(30)} ${movement.category.padEnd(12)} ${movement.folder}`);
  });
}

const [command = "list", characterId, movementId, ...flags] = process.argv.slice(2);
const overwrite = flags.includes("--force") || process.argv.includes("--force");
const selected = selectedEntries(characterId, movementId);

switch (command) {
  case "seed":
    selected.characters.forEach(([id]) => {
      selected.movements.forEach(([, movement]) => seedMovement(id, resolveMovement(id, movement), overwrite));
      writeCatalog(id);
    });
    break;
  case "extract":
    selected.characters.forEach(([id]) => {
      selected.movements.forEach(([, movement]) => extractMovement(id, resolveMovement(id, movement), overwrite));
      writeCatalog(id);
    });
    break;
  case "build":
    assert(characterId && movementId, "Usage: npm run sprites:build -- <characterId> <movementId>");
    buildMovement(characterId, resolveMovement(characterId, manifest.movements[movementId]));
    writeCatalog(characterId);
    break;
  case "catalog":
    selected.characters.forEach(([id]) => writeCatalog(id));
    break;
  case "validate":
    validateLibrary();
    break;
  case "list":
    listLibrary();
    break;
  default:
    throw new Error(`Unknown command: ${command}`);
}
