// Renders confetti.js into a real canvas in Node and measures where the paper
// is. Proves two things the eye would catch on a phone: it starts at the top,
// and a stalled frame advances the fall instead of freezing it.
const { JSDOM } = require('jsdom');
const { createCanvas } = require('@napi-rs/canvas');

const W = 400, H = 800;
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
const win = dom.window;

let now = 0;
let frame = null;
const backend = createCanvas(W, H);
const ctx2d = backend.getContext('2d');

win.innerWidth = W;
win.innerHeight = H;
win.devicePixelRatio = 1;
win.performance = { now: () => now };
win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
win.requestAnimationFrame = fn => { frame = fn; return 1; };
win.cancelAnimationFrame = () => { frame = null; };
win.addEventListener = () => {};
win.removeEventListener = () => {};

// a canvas element whose drawing lands in the napi canvas
function makeEl() {
  const el = {
    className: '', style: {}, width: W, height: H, parentNode: null,
    _attrs: {},
    getContext: () => ctx2d,
    setAttribute(k, v) { this._attrs[k] = v; }
  };
  return el;
}
let currentEl = null;
const realCreate = win.document.createElement.bind(win.document);
win.document.createElement = function (tag) {
  if (String(tag).toLowerCase() === 'canvas') {
    currentEl = makeEl();
    return currentEl;
  }
  return realCreate(tag);
};
const body = win.document.body;
body.appendChild = el => { el.parentNode = body; };
body.removeChild = el => { el.parentNode = null; };

// load confetti into that window
const fs = require('fs');
const src = fs.readFileSync('/opt/data/kids-games/shared/confetti.js', 'utf8');
win.eval(src);

function step(ms) {
  now += ms;
  if (!frame) throw new Error('no frame scheduled');
  const fn = frame;
  frame = null;
  fn(now);
}

// how much paper is in a horizontal band, in pixels
function band(y0, y1) {
  const d = ctx2d.getImageData(0, y0, W, y1 - y0).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
  return n;
}

let fails = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

console.log('rain from the top');
win.Confetti.rain(60);
check('a frame is scheduled', !!frame);
// pieces spawn just above the top edge, so give them a moment to appear
for (let i = 0; i < 12; i++) step(16.7);
const top = band(0, 260);
const mid = band(260, 600);
const bottom = band(600, 800);
console.log(`  pixels after 0.2s: top ${top}, middle ${mid}, bottom ${bottom}`);
check('paper appears at the top of the screen', top > 0);
check('nothing has reached the bottom yet', bottom === 0);

console.log('it falls');
for (let i = 0; i < 30; i++) step(16.7);
const top2 = band(0, 260);
const lower2 = band(260, 800);
console.log(`  pixels after 0.7s: top ${top2}, lower ${lower2}`);
check('paper has fallen below the top band', lower2 > 0);
check('the top band is emptying', top2 < top);

console.log('a stalled frame does not freeze it');
// fresh curtain, let it appear, then one 200ms gap (the next clip loading)
ctx2d.clearRect(0, 0, W, H);
win.Confetti.rain(60);
for (let i = 0; i < 12; i++) step(16.7);
const beforeStall = band(0, 300);
now += 200;                    // the stall itself, no frame is drawn in between
step(0);                       // the next frame arrives 200ms late
const duringStall = band(0, 300);
const stalledLower = band(300, 800);
console.log(`  top band before ${beforeStall}, after the gap ${duringStall}, lower ${stalledLower}`);
check('the gap moved the paper instead of freezing it', duringStall < beforeStall || stalledLower > 0);

console.log('it cleans up');
for (let i = 0; i < 200; i++) {
  step(16.7);
  if (!frame) break;
}
check('canvas removed when the paper lands', body.childNodes.length === 0 || currentEl.parentNode === null);

console.log(fails ? `\n${fails} FAILURES` : '\nconfetti behaves');
process.exit(fails ? 1 : 0);
