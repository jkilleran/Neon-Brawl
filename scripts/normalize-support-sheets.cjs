"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const cellWidth = 384;
const cellHeight = 341;
const targetMaxHeight = 310;
const baseline = 333;

const jobs = [
  { source: "public/assets/anim-guards-v2.png", output: "public/assets/animations/support/guards-v3.png", columns: 5, rows: 4, frames: 20, sourceHeight: 1120 },
  { source: "public/assets/anim-footwork-v2.png", output: "public/assets/animations/support/footwork-v3.png", columns: 5, rows: 4, frames: 20, sourceHeight: 1120 },
  { source: "public/assets/anim-hit-reactions-v2.png", output: "public/assets/animations/support/hit-reactions-v3.png", columns: 5, rows: 4, frames: 20, sourceHeight: 1120 },
  {
    source: "public/assets/animations/support/hit-reactions-v3.png",
    output: "public/assets/animations/support/hit-reactions-v4.png",
    columns: 5,
    rows: 4,
    frames: 20,
    sourceHeight: 1364,
    frameMap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 13, 12, 11, 10],
  },
  { source: "public/assets/animations/strikes/left-punch-body-v4.png", output: "public/assets/animations/strikes/left-punch-body-v4.png", columns: 4, rows: 3, frames: 10, sourceHeight: 1023 },
  { source: "public/assets/animations/strikes/right-punch-body-v4.png", output: "public/assets/animations/strikes/right-punch-body-v4.png", columns: 4, rows: 3, frames: 10, sourceHeight: 1023 },
  { source: "public/assets/animations/strikes/right-kick-head-v4.png", output: "public/assets/animations/strikes/right-kick-head-v4.png", columns: 4, rows: 3, frames: 10, sourceHeight: 1023 },
  { source: "public/assets/animations/strikes/right-kick-body-v4.png", output: "public/assets/animations/strikes/right-kick-body-v4.png", columns: 4, rows: 3, frames: 10, sourceHeight: 1023 },
  { source: "public/assets/animations/strikes/left-punch-body-v5.png", output: "public/assets/animations/strikes/left-punch-body-v5.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/strikes/right-kick-head-v5.png", output: "public/assets/animations/strikes/right-kick-head-v5.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/strikes/right-kick-body-v5.png", output: "public/assets/animations/strikes/right-kick-body-v5.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/support/head-knockdown-v1.png", output: "public/assets/animations/support/head-knockdown-v1.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/support/body-knockdown-v1.png", output: "public/assets/animations/support/body-knockdown-v1.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/support/head-knockout-v1.png", output: "public/assets/animations/support/head-knockout-v1.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/support/body-knockout-v1.png", output: "public/assets/animations/support/body-knockout-v1.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/support/head-knockdown-forward-v2.png", output: "public/assets/animations/support/head-knockdown-forward-v2.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
  { source: "public/assets/animations/support/body-knockdown-kneel-v2.png", output: "public/assets/animations/support/body-knockdown-kneel-v2.png", columns: 5, rows: 2, frames: 10, sourceHeight: 682 },
];

function findImageMagick() {
  for (const command of ["magick", "convert"]) {
    const probe = spawnSync(command, ["-version"], { encoding: "utf8" });
    if (probe.status === 0) return command;
  }
  throw new Error("ImageMagick is required to rebuild support sheets");
}

const imageMagick = findImageMagick();

function run(args, options = {}) {
  const result = spawnSync(imageMagick, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${imageMagick} ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function componentsFor(source, job) {
  const report = run([
    source,
    "-alpha", "extract",
    "-threshold", "1",
    "-define", "connected-components:verbose=true",
    "-connected-components", "8",
    "null:",
  ]);

  const components = [];
  const pattern = /^\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+([\d.]+),([\d.]+)\s+(\d+)/;
  for (const line of report.split("\n")) {
    const match = line.match(pattern);
    if (!match) continue;
    const [, width, height, x, y, centerX, centerY, area] = match.map(Number);
    if (area < 5000 || area > 200000 || width < 60 || height < 100) continue;
    components.push({ width, height, x, y, centerX, centerY, area });
  }

  assert.equal(components.length, job.frames, `${source} must contain ${job.frames} complete fighters`);
  const sourceCellHeight = job.sourceHeight / job.rows;
  return components.sort((a, b) => {
    const rowA = Math.min(job.rows - 1, Math.floor(a.centerY / sourceCellHeight));
    const rowB = Math.min(job.rows - 1, Math.floor(b.centerY / sourceCellHeight));
    return rowA - rowB || a.centerX - b.centerX;
  });
}

function normalize(job) {
  const source = path.join(root, job.source);
  const output = path.join(root, job.output);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "neon-brawl-support-"));

  try {
    const workingSource = source === output ? path.join(temporary, "source.png") : source;
    if (source === output) fs.copyFileSync(source, workingSource);
    const sourceComponents = componentsFor(workingSource, job);
    if (job.frameMap) {
      assert.equal(job.frameMap.length, job.frames, `${job.output} frame map must contain ${job.frames} entries`);
      job.frameMap.forEach((frame) => assert(sourceComponents[frame], `${job.output} references missing source frame ${frame}`));
    }
    const components = job.frameMap
      ? job.frameMap.map((frame) => sourceComponents[frame])
      : sourceComponents;
    const scale = targetMaxHeight / Math.max(...components.map((component) => component.height));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    run(["-size", `${job.columns * cellWidth}x${job.rows * cellHeight}`, "xc:none", output]);

    components.forEach((component, frame) => {
      const width = Math.round(component.width * scale);
      const height = Math.round(component.height * scale);
      const frameFile = path.join(temporary, `frame-${frame}.png`);
      const nextOutput = path.join(temporary, `sheet-${frame}.png`);
      run([
        workingSource,
        "-gravity", "northwest",
        "-crop", `${component.width}x${component.height}+${component.x}+${component.y}`,
        "+repage",
        "-resize", `${width}x${height}!`,
        frameFile,
      ]);

      const column = frame % job.columns;
      const row = Math.floor(frame / job.columns);
      const x = column * cellWidth + Math.floor((cellWidth - width) / 2);
      const y = row * cellHeight + baseline - height;
      run([output, frameFile, "-gravity", "northwest", "-geometry", `+${x}+${y}`, "-composite", nextOutput]);
      fs.copyFileSync(nextOutput, output);
      fs.unlinkSync(nextOutput);
    });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  console.log(`Normalized ${job.source} -> ${job.output}`);
}

const filters = process.argv.slice(2);
const selectedJobs = filters.length === 0
  ? jobs
  : jobs.filter((job) => filters.some((filter) => job.source.includes(filter) || job.output.includes(filter)));
assert(selectedJobs.length > 0, `No animation sheet matched: ${filters.join(", ")}`);
selectedJobs.forEach(normalize);
