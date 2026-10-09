// Wraps a 32x32 PNG in a minimal single-image ICO container.
// PNG-compressed ICO entries are valid since Windows Vista, so no BMP
// re-encoding is needed — just an ICONDIR header pointing at the raw PNG.
// Usage: node make-ico.mjs <in.png> <out.ico>
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Usage: node make-ico.mjs <in.png> <out.ico>");
  process.exit(1);
}

const png = readFileSync(inPath);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count

const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // color count (0 = no palette)
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8); // size of image data
entry.writeUInt32LE(22, 12); // offset of image data (6 + 16)

writeFileSync(outPath, Buffer.concat([header, entry, png]));
