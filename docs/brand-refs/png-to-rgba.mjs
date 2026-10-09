// Converts an 8-bit RGB (PNG color type 2) screenshot into RGBA (color type
// 6) in place, using only Node's built-in zlib — Next.js's Turbopack image
// pipeline (used for src/app/favicon.ico) rejects RGB-only PNGs embedded in
// an .ico with "The PNG is not in RGBA format!".
// Usage: node png-to-rgba.mjs <in.png> <out.png>
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Usage: node png-to-rgba.mjs <in.png> <out.png>");
  process.exit(1);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const buf = readFileSync(inPath);
if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");

let offset = 8;
let ihdr = null;
const idatParts = [];
while (offset < buf.length) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString("ascii", offset + 4, offset + 8);
  const data = buf.subarray(offset + 8, offset + 8 + len);
  if (type === "IHDR") ihdr = data;
  if (type === "IDAT") idatParts.push(data);
  if (type === "IEND") break;
  offset += 12 + len;
}
if (!ihdr) throw new Error("no IHDR");

const width = ihdr.readUInt32BE(0);
const height = ihdr.readUInt32BE(4);
const bitDepth = ihdr.readUInt8(8);
const colorType = ihdr.readUInt8(9);
if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
if (colorType !== 2 && colorType !== 6) throw new Error(`unsupported color type ${colorType}`);
if (colorType === 6) {
  writeFileSync(outPath, buf);
  process.exit(0);
}

const srcBpp = 3; // RGB
const raw = inflateSync(Buffer.concat(idatParts));
const stride = width * srcBpp;

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Unfilter into a flat RGB buffer.
const rgb = Buffer.alloc(height * stride);
let prevRow = Buffer.alloc(stride);
let pos = 0;
for (let y = 0; y < height; y++) {
  const filter = raw[pos];
  pos += 1;
  const row = raw.subarray(pos, pos + stride);
  pos += stride;
  const outRow = rgb.subarray(y * stride, y * stride + stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= srcBpp ? outRow[x - srcBpp] : 0;
    const b = prevRow[x];
    const c = x >= srcBpp ? prevRow[x - srcBpp] : 0;
    let val = row[x];
    if (filter === 1) val = (val + a) & 0xff;
    else if (filter === 2) val = (val + b) & 0xff;
    else if (filter === 3) val = (val + ((a + b) >> 1)) & 0xff;
    else if (filter === 4) val = (val + paeth(a, b, c)) & 0xff;
    outRow[x] = val;
  }
  prevRow = outRow;
}

// Re-encode as RGBA, filter type None per row.
const dstBpp = 4;
const dstStride = width * dstBpp;
const out = Buffer.alloc(height * (dstStride + 1));
for (let y = 0; y < height; y++) {
  const srcRow = rgb.subarray(y * stride, y * stride + stride);
  const outOffset = y * (dstStride + 1);
  out[outOffset] = 0; // filter: None
  for (let x = 0; x < width; x++) {
    out[outOffset + 1 + x * 4] = srcRow[x * 3];
    out[outOffset + 1 + x * 4 + 1] = srcRow[x * 3 + 1];
    out[outOffset + 1 + x * 4 + 2] = srcRow[x * 3 + 2];
    out[outOffset + 1 + x * 4 + 3] = 0xff;
  }
}

const newIhdr = Buffer.from(ihdr);
newIhdr.writeUInt8(6, 9); // color type 6 = RGBA

const newIdat = deflateSync(out);
const png = Buffer.concat([
  SIG,
  chunk("IHDR", newIhdr),
  chunk("IDAT", newIdat),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(outPath, png);
