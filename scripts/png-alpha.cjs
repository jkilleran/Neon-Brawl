"use strict";

const fs = require("node:fs");
const zlib = require("node:zlib");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const prediction = a + b - c;
  const distanceA = Math.abs(prediction - a);
  const distanceB = Math.abs(prediction - b);
  const distanceC = Math.abs(prediction - c);
  if (distanceA <= distanceB && distanceA <= distanceC) return a;
  if (distanceB <= distanceC) return b;
  return c;
}

function decodeAlpha(file) {
  const buffer = fs.readFileSync(file);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${file} is not a PNG`);

  let width;
  let height;
  let bitDepth;
  let colorType;
  const idat = [];

  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || ![4, 6].includes(colorType)) {
    throw new Error(`${file} must be an 8-bit grayscale-alpha or RGBA PNG`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);

  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rowOffset = y * stride;
    const previousOffset = rowOffset - stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[inputOffset + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[previousOffset + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[previousOffset + x - bytesPerPixel]
        : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + above;
      else if (filter === 3) value = raw + Math.floor((left + above) / 2);
      else if (filter === 4) value = raw + paeth(left, above, upperLeft);
      else throw new Error(`${file} uses unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = value & 255;
    }
    inputOffset += stride;
  }

  const alphaOffset = bytesPerPixel - 1;
  const alpha = Buffer.alloc(width * height);
  for (let index = 0; index < width * height; index += 1) {
    alpha[index] = pixels[index * bytesPerPixel + alphaOffset];
  }
  return { width, height, alpha };
}

function frameBounds(png, columns, rows, frame, alphaThreshold = 8) {
  const cellWidth = png.width / columns;
  const cellHeight = png.height / rows;
  const column = frame % columns;
  const row = Math.floor(frame / columns);
  const originX = column * cellWidth;
  const originY = row * cellHeight;
  let minX = cellWidth;
  let minY = cellHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < cellHeight; y += 1) {
    const pixelY = originY + y;
    for (let x = 0; x < cellWidth; x += 1) {
      if (png.alpha[pixelY * png.width + originX + x] <= alphaThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX < 0 ? null : { minX, minY, maxX, maxY, cellWidth, cellHeight };
}

module.exports = { decodeAlpha, frameBounds };
