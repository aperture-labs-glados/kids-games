// Number Line, Finish the Sentence, and the sticker shelf.
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = 'http://127.0.0.1:8099';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  if (/navigation|Not implemented: HTMLMediaElement/i.test(e.message)) return;
  errors.push('jsdomError: ' + e.message);
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const PLAYER = { id: 'p1', name: 'Test', emoji: '🐣' };

function stubs(window, seed) {
  window.__spoken = [];
  window.__phrases = [];
  window.__osc = 0;
  window.localStorage.setItem('kg.players', JSON.stringify([PLAYER]));
  window.localStorage.setItem('kg.active', 'p1');
  if (seed) seed(window.localStorage);

  const voices = [{ name: 'Test Voice', lang: 'en-US', localService: true }];
  window.speechSynthesis = {
    getVoices: () => voices,
    speak: u => { if (u && u.text) window.__spoken.push(String(u.text).trim()); },
    cancel: () => {}, addEventListener: () => {}
  };
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.Audio = function () {
    return {
      _src: '', preload: 'auto',
      get src() { return this._src; }, set src(v) { this._src = v; },
      play() {
        window.__phrases.push(this._src.split('/').pop());
        return Promise.reject(new Error('no media in jsdom'));
      },
      pause() {}, load() {}, currentTime: 0, onerror: null
    };
  };
  window.AudioContext = function () {
    return {
      currentTime: 0, state: 'running', destination: {},
      createOscillator: () => ({ type: '', frequency: { setValueAtTime() {} },
        connect() {}, start() { window.__osc += 1; }, stop() {} }),
      createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {} }),
      resume() {}
    };
  };
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
}

async function open(path, seed) {
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse: w => stubs(w, seed)
  });
  await new Promise(r => dom.window.addEventListener('load', r));
  await sleep(350);
  return dom.window;
}

let fails = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

// ---------------------------------------------------------------- number line
async function numberLine() {
  console.log('Number Line');
  const w = await open('/games/number-line/index.html');
  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const choices = () => Array.from(doc.querySelectorAll('#choices .choice'));

  const solve = text => {
    let m = /^(\d+) − (\d+) = \?$/.exec(text);
    if (m) return { kind: 'sub', a: +m[1], b: +m[2], answer: +m[1] - +m[2] };
    m = /^(\d+) \+ (\d+) = \?$/.exec(text);
    if (m) return { kind: 'add', a: +m[1], b: +m[2], answer: +m[1] + +m[2] };
    return null;
  };

  $('#startBtn').click();
  await sleep(300);

  let q = solve($('#equation').textContent);
  check('an equation is shown', !!q, $('#equation').textContent);
  check('the line has 21 ticks', doc.querySelectorAll('.tick').length === 21,
    String(doc.querySelectorAll('.tick').length));
  check('the start is marked', doc.querySelectorAll('.tick.start').length === 1);
  check('nothing travelled before answering', doc.querySelectorAll('.tick.on').length === 0);
  check('four choices', choices().length === 4);

  choices().find(b => +b.textContent === q.answer).click();
  await sleep(150);
  const travelled = doc.querySelectorAll('.tick.on').length;
  check('the trip is highlighted', travelled === Math.abs(q.a - q.answer) + 1, travelled + ' ticks');
  check('the landing spot is marked', doc.querySelectorAll('.tick.end').length === 1);
  check('fanfare played', w.__osc === 5);
  await sleep(1900);

  q = solve($('#equation').textContent);
  choices().find(b => +b.textContent !== q.answer).click();
  await sleep(150);
  check('wrong answer marked', !!doc.querySelector('.choice.bad'));
  check('right answer shown', Array.from(doc.querySelectorAll('.choice.good'))
    .some(b => +b.textContent === q.answer));
  await sleep(2900);

  let turns = 2;
  while (turns < 16 && $('#summary').classList.contains('hidden')) {
    const cur = solve($('#equation').textContent);
    if (!cur) { await sleep(250); continue; }
    const b = choices().find(x => +x.textContent === cur.answer && !x.disabled);
    if (!b) { await sleep(250); continue; }
    b.click(); turns++;
    await sleep(1900);
  }
  await sleep(300);
  check('summary shown', !$('#summary').classList.contains('hidden'));
  check('no page errors', errors.length === 0, errors.join('; '));
  w.close();
}

// ----------------------------------------------------------- finish the sentence
async function sentenceFill() {
  console.log('Finish the Sentence');
  const w = await open('/games/sentence-fill/index.html');
  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const choices = () => Array.from(doc.querySelectorAll('#choices .choice'));

  $('#startBtn').click();
  await sleep(400);

  const words = Array.from(doc.querySelectorAll('.word-btn')).map(b => b.textContent);
  check('the sentence is drawn as words', words.length >= 3, words.join(' '));
  check('there is one blank', doc.querySelectorAll('.blank-slot').length === 1);
  check('four word choices', choices().length === 4, choices().map(b => b.textContent).join(','));
  check('the sentence clip was requested', /sentence-\d\d\.mp3/.test((w.__phrases || []).join(' ')),
    (w.__phrases || []).join(','));

  // tapping a word should ask for that word's recording
  doc.querySelector('.word-btn').click();
  await sleep(120);
  const clip = (w.__phrases || []).slice(-1)[0];
  check('tapping a word requests its clip', /^[a-z]+\.mp3/.test(clip), clip);

  // work out the answer from the sentence on screen, then click it
  const norm = t => t.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  const sentence = (w.Words.sentences || [])
    .find(s => norm(s.text.replace('___', '')) === norm(words.join(' ')));
  const answer = sentence ? sentence.answer : null;
  check('the sentence matches the data', !!answer, answer);
  choices().find(b => b.textContent === answer).click();
  await sleep(200);
  check('it says yes', /Yes!/.test($('#feedback').textContent), $('#feedback').textContent);
  check('the blank is filled with the answer',
    doc.querySelector('.blank-slot').textContent === answer,
    doc.querySelector('.blank-slot').textContent);
  check('fanfare played', w.__osc === 5, String(w.__osc));
  check('no page errors', errors.length === 0, errors.join('; '));
  w.close();
}

// ---------------------------------------------------------------- sticker shelf
async function stickers() {
  console.log('Stickers');
  const seed = ls => {
    // twelve mastered spelling words and one sentence finished
    const items = {};
    ['cat','hat','bat','mat','pan','fan','sad','bag','jam','tag','map','rat'].forEach(w => {
      items['spell::' + w] = { d: 'spell', i: w, box: 4, right: 5, wrong: 0, seen: 5, due: 0, last: 1 };
    });
    items['read::s0'] = { d: 'read', i: 's0', box: 1, right: 1, wrong: 0, seen: 1, due: 0, last: 1 };
    ls.setItem('kg.v2.p1', JSON.stringify({
      items, decks: { spell: { level: 3, run: 0, miss: 0, answered: 5, correct: 5 } }
    }));
  };

  const w = await open('/stickers.html', seed);
  const doc = w.document;
  await sleep(800);   // the shelf marks itself seen after 600ms

  const all = doc.querySelectorAll('.sticker');
  const earned = Array.from(all).filter(s => s.classList.contains('earned'));
  const fresh = doc.querySelectorAll('.sticker .new');
  check('every sticker is shown', all.length === 11, String(all.length));
  check('earned ones are marked', earned.length >= 3, earned.length + ' earned');
  check('new ones are badged', fresh.length >= 3, fresh.length + ' new');
  check('locked ones show how to earn them',
    Array.from(doc.querySelectorAll('.sticker.locked .label')).every(l => l.textContent.length > 3));
  check('count badge is right', /of 11$/.test(doc.getElementById('count').textContent),
    doc.getElementById('count').textContent);
  const labels = earned.map(s => s.querySelector('.label').textContent);
  check('the word milestone is earned', labels.indexOf('Ten Words') !== -1, labels.join(', '));

  // reopening should not re-announce them. jsdom windows do not share
  // localStorage, so carry the "seen" key across by hand.
  const seenVal = w.localStorage.getItem('kg.stickers.seen.p1');
  check('the visit recorded what was seen', !!seenVal, seenVal && seenVal.slice(0, 40));

  const w2 = await open('/stickers.html', ls => {
    seed(ls);
    if (seenVal) ls.setItem('kg.stickers.seen.p1', seenVal);
  });
  const doc2 = w2.document;
  await sleep(300);
  check('seen stickers stop being new', doc2.querySelectorAll('.sticker .new').length === 0,
    doc2.querySelectorAll('.sticker .new').length + ' new');

  check('no page errors', errors.length === 0, errors.join('; '));
  w.close(); w2.close();
}

(async () => {
  await numberLine();
  await sentenceFill();
  await stickers();
  console.log(fails ? `\n${fails} FAILURES` : '\nnumber line, sentences and stickers behave');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message, errors); process.exit(1); });
