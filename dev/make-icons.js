// Draws the app icons. Run from a machine with @napi-rs/canvas:
//   NODE_PATH=/tmp/gt/node_modules node dev/make-icons.js
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

function star(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function draw(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');

  // Full bleed: the OS applies its own rounded mask, and pre-rounding the art
  // would show up as a cream border inside iOS's corner radius.
  ctx.fillStyle = '#f97316';
  ctx.fillRect(0, 0, size, size);

  // the star, pulled in for the maskable version so a circular crop keeps it
  const outer = size * (maskable ? 0.30 : 0.36);
  ctx.fillStyle = '#fff7ed';
  // a star's mass sits high, so nudge it down for optical centring
  star(ctx, size / 2, size / 2 + size * 0.012, outer, outer * 0.45, 5);

  return c;
}

const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-180.png', 180, {}],
  ['icon-maskable-512.png', 512, { maskable: true }]
];

for (const [name, size, opts] of jobs) {
  const canvas = draw(size, opts);
  fs.writeFileSync(path.join(OUT, name), canvas.toBuffer('image/png'));
  const bytes = fs.statSync(path.join(OUT, name)).size;
  console.log(`${name.padEnd(24)} ${String(size).padStart(4)}px  ${bytes} bytes`);
}
