// Session 2: same store, new page load. Checks the level survived the reload
// and that already-seen words are not counted as new.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8099';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));

const stub = {
  beforeParse(window) {
    window.__spoken = [];
    const voices = [{ name: 'Test Voice', lang: 'en-US', localService: true }];
    window.speechSynthesis = {
      getVoices: () => voices,
      speak: u => { if (u && u.text) window.__spoken.push(String(u.text).trim()); },
      cancel: () => {}, addEventListener: () => {}
    };
    // confetti is a no-op without a canvas backend
    window.HTMLCanvasElement.prototype.getContext = function () { return null; };
    window.Audio = function () {
      return {
        _src: '', preload: 'auto',
        get src() { return this._src; }, set src(v) { this._src = v; },
        play: function () { return Promise.reject(new Error('no media in jsdom')); },
        pause: function () {}, load: function () {}, currentTime: 0, onerror: null
      };
    };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    if (window.__seed) window.localStorage.setItem('kg.progress.v1', window.__seed);
  }
};

(async () => {
  // session 1: play 14 answers to build up state
  const d1 = await JSDOM.fromURL(BASE + '/games/speak-build/index.html', {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse: stub.beforeParse
  });
  const w1 = d1.window, doc1 = w1.document;
  await new Promise(r => w1.addEventListener('load', r));
  await sleep(300);
  doc1.querySelector('#startBtn').click();
  await sleep(300);
  const click = (doc, letters) => letters.split('').forEach(ch => {
    const t = Array.from(doc.querySelectorAll('#tiles .tile')).find(b => !b.classList.contains('used') && b.textContent === ch);
    if (t) t.click();
  });
  const wordNow = w => { const s = w.__spoken.filter(Boolean); return s[s.length - 1].replace(/[^a-z]/gi, '').toLowerCase(); };
  for (let i = 0; i < 13; i++) {
    if (!doc1.querySelector('#summary').classList.contains('hidden')) break;
    const word = wordNow(w1);
    if (!word) { await sleep(200); continue; }
    click(doc1, word);
    await sleep(1300);
  }
  const saved = w1.localStorage.getItem('kg.progress.v1');
  const level1 = JSON.parse(saved).decks.spell.level;
  const seen1 = Object.keys(JSON.parse(saved).items).length;
  console.log('session 1 -> level', level1, '| items touched', seen1);

  // session 2: brand new page, same storage
  const d2 = await JSDOM.fromURL(BASE + '/games/speak-build/index.html', {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) { w.__seed = saved; stub.beforeParse(w); }
  });
  const w2 = d2.window, doc2 = w2.document;
  await new Promise(r => w2.addEventListener('load', r));
  await sleep(400);
  const badge = doc2.querySelector('#levelBadge').textContent;
  const seeded = JSON.parse(w2.localStorage.getItem('kg.progress.v1')).decks.spell.level;
  console.log('session 2 badge:', badge, '| restored level:', seeded, '| match:', seeded === level1);

  doc2.querySelector('#startBtn').click();
  await sleep(300);
  const firstWord = wordNow(w2);
  const before = JSON.parse(w2.localStorage.getItem('kg.progress.v1')).items['spell::' + firstWord];
  console.log('session 2 first word:', firstWord, '| seen before:', before ? before.seen : 0);
  click(doc2, firstWord);
  await sleep(1400);
  const after = JSON.parse(w2.localStorage.getItem('kg.progress.v1')).items['spell::' + firstWord];
  console.log('after one answer -> seen:', after.seen, 'box:', after.box, 'right:', after.right);

  // reviewed words should be served before brand-new ones
  const store = JSON.parse(w2.localStorage.getItem('kg.progress.v1'));
  const due = Object.values(store.items).filter(e => e.d === 'spell' && e.seen > 0 && e.due <= Date.now()).map(e => e.i);
  console.log('due reviews available:', due.length);
  console.log('errors:', errors.length ? errors : 'none');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message, errors); process.exit(1); });
