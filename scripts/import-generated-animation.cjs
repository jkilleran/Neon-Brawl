"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const [, , inputArgument, outputArgument, ...flags] = process.argv;
assert(
  inputArgument && outputArgument,
  "Usage: node scripts/import-generated-animation.cjs <transparent-grid.png> <normalized-sheet.png> [--scale=1 | --multiply=1] [--repeat-first]",
);

const scaleFlag = flags.find((flag) => flag.startsWith("--scale="));
const poseScale = scaleFlag ? Number(scaleFlag.slice("--scale=".length)) : 1;
assert(Number.isFinite(poseScale) && poseScale > 0 && poseScale <= 1, "--scale must be greater than 0 and no more than 1");
const multiplyFlag = flags.find((flag) => flag.startsWith("--multiply="));
const uniformMultiplier = multiplyFlag ? Number(multiplyFlag.slice("--multiply=".length)) : null;
assert(!(scaleFlag && multiplyFlag), "Use either --scale or --multiply, not both");
assert(
  uniformMultiplier === null || (Number.isFinite(uniformMultiplier) && uniformMultiplier > 0 && uniformMultiplier <= 1.5),
  "--multiply must be greater than 0 and no more than 1.5",
);
const repeatFirst = flags.includes("--repeat-first");

const input = path.resolve(inputArgument);
const output = path.resolve(outputArgument);
const columns = 5;
const rows = 2;
const frames = 10;
const cellWidth = 384;
const cellHeight = 341;
const targetWidth = columns * cellWidth;
const targetHeight = rows * cellHeight;
const targetMaxWidth = 330 * poseScale;
const targetMaxHeight = 310 * poseScale;
const baseline = 333;

function findImageMagick() {
  for (const command of ["magick", "convert"]) {
    if (spawnSync(command, ["-version"], { encoding: "utf8" }).status === 0) return command;
  }
  throw new Error("ImageMagick is required to import generated animation sheets.");
}

const imageMagick = findImageMagick();

function run(args) {
  const result = spawnSync(imageMagick, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${imageMagick} ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
}

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

assert(fs.existsSync(input), `Input sheet not found: ${input}`);
const sourceSize = readPngSize(input);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "neon-brawl-generated-grid-"));
let current = path.join(temporary, "sheet-00.png");

try {
  run(["-size", `${targetWidth}x${targetHeight}`, "xc:none", current]);

  for (let frame = 0; frame < frames; frame += 1) {
    const sourceFrame = repeatFirst ? 0 : frame;
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    const sourceColumn = sourceFrame % columns;
    const sourceRow = Math.floor(sourceFrame / columns);
    const x0 = Math.round(sourceColumn * sourceSize.width / columns);
    const x1 = Math.round((sourceColumn + 1) * sourceSize.width / columns);
    const y0 = Math.round(sourceRow * sourceSize.height / rows);
    const y1 = Math.round((sourceRow + 1) * sourceSize.height / rows);
    const cropped = path.join(temporary, `frame-${String(frame + 1).padStart(2, "0")}-crop.png`);
    const normalized = path.join(temporary, `frame-${String(frame + 1).padStart(2, "0")}.png`);

    run([
      input,
      "-gravity", "northwest",
      "-crop", `${x1 - x0}x${y1 - y0}+${x0}+${y0}`,
      "+repage",
      "-trim",
      "+repage",
      cropped,
    ]);

    const croppedSize = readPngSize(cropped);
    const scale = uniformMultiplier
      ?? Math.min(targetMaxWidth / croppedSize.width, targetMaxHeight / croppedSize.height);
    const width = Math.max(1, Math.round(croppedSize.width * scale));
    const height = Math.max(1, Math.round(croppedSize.height * scale));
    run([cropped, "-filter", "Lanczos", "-resize", `${width}x${height}!`, normalized]);

    const destinationX = column * cellWidth + Math.floor((cellWidth - width) / 2);
    const destinationY = row * cellHeight + baseline - height;
    const next = path.join(temporary, `sheet-${String(frame + 1).padStart(2, "0")}.png`);
    run([
      current,
      normalized,
      "-gravity", "northwest",
      "-geometry", `+${destinationX}+${destinationY}`,
      "-composite",
      next,
    ]);
    current = next;
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(current, output);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log(`Imported 10 frames: ${input} -> ${output}`);
