// Generates the app icons (PNG + favicon SVG) with no extra dependencies.
//
// Run with:  npm run icons
//
// The icon is a six-segment ring in the emotion-wheel colors on a soft
// off-white tile. We draw it pixel by pixel and encode the PNG by hand using
// Node's built-in zlib, so there is no image library to install.
import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BACKGROUND = [251, 250, 246];
const INK = [38, 36, 46];
// Hue order around the ring (starting at 12 o'clock, clockwise).
const SEGMENTS = [
  [227, 73, 72], // red    – Anger
  [237, 161, 0], // yellow – Happy
  [0, 131, 0], // green  – Fear
  [18, 168, 200], // cyan   – Surprise
  [42, 120, 214], // blue   – Sad
  [139, 111, 217], // purple – Disgust
];
const GAP_DEGREES = 7; // empty space between ring segments

/** Returns the color of one point; x and y are in the range -0.5 … 0.5. */
function colorAt(x, y, ringOuter) {
  const radius = Math.hypot(x, y);
  const ringInner = ringOuter * 0.58;
  const dotRadius = ringOuter * 0.26;

  if (radius <= dotRadius) return INK;
  if (radius < ringInner || radius > ringOuter) return BACKGROUND;

  // Angle measured clockwise from the top, 0 … 360.
  const degrees = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  const segmentSize = 360 / SEGMENTS.length;
  const positionInSegment = degrees % segmentSize;
  if (positionInSegment < GAP_DEGREES / 2 || positionInSegment > segmentSize - GAP_DEGREES / 2) {
    return BACKGROUND;
  }
  return SEGMENTS[Math.floor(degrees / segmentSize)];
}

/** Draws the icon into raw RGBA bytes, averaging 4×4 samples per pixel. */
function drawIcon(size, ringOuter) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / size - 0.5;
          const y = (py + (sy + 0.5) / samples) / size - 0.5;
          const [r, g, b] = colorAt(x, y, ringOuter);
          red += r;
          green += g;
          blue += b;
        }
      }
      const total = samples * samples;
      const offset = (py * size + px) * 4;
      pixels[offset] = Math.round(red / total);
      pixels[offset + 1] = Math.round(green / total);
      pixels[offset + 2] = Math.round(blue / total);
      pixels[offset + 3] = 255; // fully opaque (required for iOS icons)
    }
  }
  return pixels;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  // Each row is prefixed with a "filter" byte; 0 means "no filter".
  const rowLength = size * 4 + 1;
  const raw = Buffer.alloc(rowLength * size);
  for (let row = 0; row < size; row += 1) {
    pixels.copy(raw, row * rowLength + 1, row * size * 4, (row + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeFaviconSvg() {
  const toHex = ([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  const outer = 40;
  const inner = outer * 0.58;
  const point = (radius, degrees) => {
    const radians = (degrees * Math.PI) / 180;
    return `${(50 + radius * Math.sin(radians)).toFixed(2)} ${(50 - radius * Math.cos(radians)).toFixed(2)}`;
  };
  const segmentSize = 360 / SEGMENTS.length;
  const paths = SEGMENTS.map((color, index) => {
    const start = index * segmentSize + GAP_DEGREES / 2;
    const end = (index + 1) * segmentSize - GAP_DEGREES / 2;
    return `  <path fill="${toHex(color)}" d="M ${point(outer, start)} A ${outer} ${outer} 0 0 1 ${point(outer, end)} L ${point(inner, end)} A ${inner} ${inner} 0 0 0 ${point(inner, start)} Z"/>`;
  });
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`,
    `  <rect width="100" height="100" rx="22" fill="${toHex(BACKGROUND)}"/>`,
    ...paths,
    `  <circle cx="50" cy="50" r="${(outer * 0.26).toFixed(2)}" fill="${toHex(INK)}"/>`,
    `</svg>`,
    ``,
  ].join("\n");
  writeFileSync(join(publicDir, "favicon.svg"), svg);
}

mkdirSync(join(publicDir, "icons"), { recursive: true });

// ringOuter is a fraction of the icon width. Maskable icons get a smaller
// ring because Android may crop them to a circle (the "safe zone" is the
// middle 80%).
const icons = [
  { file: "icons/pwa-192.png", size: 192, ringOuter: 0.36 },
  { file: "icons/pwa-512.png", size: 512, ringOuter: 0.36 },
  { file: "icons/maskable-512.png", size: 512, ringOuter: 0.29 },
  { file: "icons/apple-touch-icon.png", size: 180, ringOuter: 0.34 },
];

for (const { file, size, ringOuter } of icons) {
  writeFileSync(join(publicDir, file), encodePng(size, drawIcon(size, ringOuter)));
  console.log(`wrote public/${file} (${size}×${size})`);
}
writeFaviconSvg();
console.log("wrote public/favicon.svg");
