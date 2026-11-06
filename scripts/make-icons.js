/*
 * Orbit — draws the app icon (planet + ring + moon) without external tools and saves PNGs:
 *   build/icon.png (256), assets/icon.png (256), assets/tray.png (32)
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

/* ---------- PNG encoder ---------- */
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- drawing ---------- */
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const PINK = [255, 79, 163];
const LAVENDER = [185, 139, 255];
const SKY = [88, 199, 255];
const BG_A = [38, 22, 62];
const BG_B = [15, 11, 24];

/** Color (RGBA 0..1 alpha) of one sample point in unit space (-1..1). */
function sample(x, y, withBackground) {
  let color = null;
  let alpha = 0;
  const over = (c, a) => {
    if (a <= 0) return;
    if (!color) { color = c; alpha = a; return; }
    color = mix(color, c, a);
    alpha = alpha + a * (1 - alpha);
  };

  if (withBackground) {
    // Rounded square background.
    const r = 0.36;
    const qx = Math.max(Math.abs(x) - (1 - r), 0);
    const qy = Math.max(Math.abs(y) - (1 - r), 0);
    if (Math.hypot(qx, qy) <= r) over(mix(BG_A, BG_B, (y + 1) / 2), 1);
  }

  const k = withBackground ? 0.82 : 1; // content scale
  const ux = x / k;
  const uy = y / k;

  // Ring: ellipse rotated -22deg.
  const ang = (-22 * Math.PI) / 180;
  const rx = ux * Math.cos(ang) + uy * Math.sin(ang);
  const ry = -ux * Math.sin(ang) + uy * Math.cos(ang);
  const e = Math.hypot(rx / 0.92, ry / 0.3);
  const onRing = e > 0.86 && e < 1.0;
  const ringColor = mix(LAVENDER, PINK, (rx + 1) / 2);

  const pr = 0.5;
  const pd = Math.hypot(ux, uy);
  const onPlanet = pd <= pr;

  if (onRing && ry < 0) over(ringColor, 1); // back half of the ring
  if (onPlanet) {
    const t = Math.min(1, Math.max(0, (ux + uy) / (2 * pr) + 0.5));
    let c = mix(PINK, SKY, t);
    // soft highlight
    const hl = Math.max(0, 1 - Math.hypot(ux + 0.2, uy + 0.22) / 0.32);
    c = mix(c, [255, 255, 255], hl * 0.45);
    over(c, 1);
  }
  if (onRing && ry >= 0) over(ringColor, 1); // front half of the ring

  // Little moon.
  if (Math.hypot(ux - 0.72, uy + 0.7) <= 0.12) over(LAVENDER, 1);

  return { color: color || [0, 0, 0], alpha };
}

function draw(size, withBackground) {
  const ss = 4; // supersampling
  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / ss) / size) * 2 - 1;
          const s = sample(x, y, withBackground);
          r += s.color[0] * s.alpha; g += s.color[1] * s.alpha; b += s.color[2] * s.alpha; a += s.alpha;
        }
      }
      const n = ss * ss;
      const i = (py * size + px) * 4;
      out[i] = a ? Math.round(r / a) : 0;
      out[i + 1] = a ? Math.round(g / a) : 0;
      out[i + 2] = a ? Math.round(b / a) : 0;
      out[i + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, out);
}

function write(rel, data) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log('icon:', rel);
}

const big = draw(256, true);
write('build/icon.png', big);
write('assets/icon.png', big);
write('assets/tray.png', draw(32, false));
write('docs/images/logo.png', draw(128, true));
