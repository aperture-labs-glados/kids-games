// Playthroughs for the three later games: sight words, rhyme swap, arrays.
// Same shape as the earlier tests: answer right, answer wrong, run to summary.
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = 'http://127.0.0.1:8099';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

function stubs(window) {
  window.__spoken = [];
  window.localStorage.setItem('kg.players', JSON.stringify([{ id: 'p1', name: 'Test', emoji: '🐣' }]));
  window.localStorage.setItem('kg.active', 'p1');
  window.__osc = 0;
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
      play() { return Promise.reject(new Error('no media in jsdom')); },
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

async function open(path) {
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
    pretendToBeVisual: true, beforeParse: stubs
  });
  await new Promise(r => dom.window.addEventListener('load', r));
  await sleep(350);
  return dom.window;
}

const said = w => {
  const s = w.__spoken.filter(Boolean);
  return s[s.length - 1] || '';
};

let fails = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

// ---------------------------------------------------------------- sight words
async function sightWords() {
  console.log('Sight Word Splat');
  const w = await open('/games/sight-word-splat/index.html');
  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const tiles = () => Array.from(doc.querySelectorAll('.word-tile'));

  $('[id=startBtn]').click();
  await sleep(300);

  const target = said(w);
  check('a word is spoken', !!target, target);
  check('six words on screen', tiles().length === 6, String(tiles().length));
  check('the spoken word is one of them', tiles().some(b => b.textContent === target));
  check('no duplicates', new Set(tiles().map(b => b.textContent)).size === 6);

  tiles().find(b => b.textContent === target).click();
  await sleep(150);
  check('correct tile marked', !!doc.querySelector('.word-tile.good'));
  check('fanfare played', w.__osc === 5, String(w.__osc));
  check('recorded', w.Learn.get('sight', target).right === 1);
  await sleep(1700);

  // wrong answer
  const word2 = said(w);
  const wrongTile = tiles().find(b => b.textContent !== word2);
  wrongTile.click();
  await sleep(150);
  check('wrong tile marked', !!doc.querySelector('.word-tile.bad'));
  check('the right word is shown', !!doc.querySelector('.word-tile.good'));
  check('recorded as wrong', w.Learn.get('sight', word2).wrong === 1);
  await sleep(2600);

  // play out
  let turns = 2;
  while (turns < 16 && $('#summary').classList.contains('hidden')) {
    const t = said(w);
    const tile = tiles().find(b => b.textContent === t);
    if (!tile) { await sleep(250); continue; }
    tile.click();
    turns++;
    await sleep(1700);
  }
  await sleep(300);
  check('summary shown', !$('#summary').classList.contains('hidden'));
  console.log('  summary:', $('#sumTitle').textContent, '|', $('#sumSub').textContent.slice(0, 60));
  check('no page errors', errors.length === 0, errors.join('; '));
  w.close();
}

// ---------------------------------------------------------------- rhyme & swap
async function rhymeSwap() {
  console.log('Rhyme & Swap');
  const w = await open('/games/rhyme-swap/index.html');
  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const choices = () => Array.from(doc.querySelectorAll('.choice'));

  $('#startBtn').click();
  await sleep(300);

  const target = said(w);
  const answer = target.charAt(0);
  check('a word is spoken', !!target, target);
  check('slots match the word length', doc.querySelectorAll('.slots .slot').length === target.length,
    String(doc.querySelectorAll('.slots .slot').length));
  check('first slot is blank', doc.querySelectorAll('.slots .slot')[0].textContent === '');
  check('the rime is given', doc.querySelectorAll('.slots .slot')[1].textContent === target.charAt(1));
  check('four letters offered', choices().length === 4, String(choices().length));
  check('the answer letter is offered', choices().some(b => b.textContent === answer));
  check('prompt names the base word', /^Change [a-z]{3} into…$/.test($('#prompt').textContent),
    $('#prompt').textContent);

  choices().find(b => b.textContent === answer).click();
  await sleep(150);
  check('slot filled on success', doc.querySelectorAll('.slots .slot')[0].textContent === answer);
  check('fanfare played', w.__osc === 5, String(w.__osc));
  const store = JSON.parse(w.localStorage.getItem('kg.v2.p1') || '{"items":{}}');
  check('the swap was recorded', Object.keys(store.items).some(k => k.indexOf('rhyme::') === 0));
  await sleep(1800);

  // wrong answer
  const t2 = said(w);
  const wrong = choices().find(b => b.textContent !== t2.charAt(0));
  wrong.click();
  await sleep(150);
  check('a wrong letter is marked', !!doc.querySelector('.choice.bad'));
  check('the right letter is shown', !!doc.querySelector('.choice.good'));
  await sleep(2700);

  let turns = 2;
  while (turns < 16 && $('#summary').classList.contains('hidden')) {
    const t = said(w);
    const b = choices().find(x => x.textContent === t.charAt(0));
    if (!b || b.disabled) { await sleep(250); continue; }
    b.click();
    turns++;
    await sleep(1800);
  }
  await sleep(300);
  check('summary shown', !$('#summary').classList.contains('hidden'));
  console.log('  summary:', $('#sumTitle').textContent, '|', $('#sumSub').textContent.slice(0, 60));
  check('no page errors', errors.length === 0, errors.join('; '));
  w.close();
}

// ---------------------------------------------------------------- array builder
async function arrays() {
  console.log('Array Builder');
  const w = await open('/games/array-builder/index.html');
  const doc = w.document;
  const $ = s => doc.querySelector(s);
  const choices = () => Array.from(doc.querySelectorAll('.choice'));

  const solve = text => {
    const m = /^(\d+) × (\d+) = \?$/.exec(text);
    return m ? { rows: +m[1], cols: +m[2], answer: +m[1] * +m[2] } : null;
  };

  $('#startBtn').click();
  await sleep(300);

  let q = solve($('#equation').textContent);
  check('an equation is shown', !!q, $('#equation').textContent);
  check('four answers offered', choices().length === 4);
  check('the answer is offered', choices().some(b => +b.textContent === q.answer));
  check('grid hidden until asked', $('#array').classList.contains('hidden'));

  $('#hintBtn').click();
  await sleep(120);
  check('grid revealed on hint', !$('#array').classList.contains('hidden'));
  check('grid has the right dot count', doc.querySelectorAll('.arr-dot').length === q.answer,
    doc.querySelectorAll('.arr-dot').length + ' dots for ' + q.rows + 'x' + q.cols);
  check('grid has the right row count', doc.querySelectorAll('.arr-row').length === q.rows);

  choices().find(b => +b.textContent === q.answer).click();
  await sleep(150);
  check('equation completed', $('#equation').textContent.endsWith('= ' + q.answer),
    $('#equation').textContent);
  check('fanfare played', w.__osc === 5);
  await sleep(1900);

  q = solve($('#equation').textContent);
  const wrong = choices().find(b => +b.textContent !== q.answer);
  wrong.click();
  await sleep(150);
  check('wrong answer marked', !!doc.querySelector('.choice.bad'));
  check('right answer highlighted', Array.from(doc.querySelectorAll('.choice.good'))
    .some(b => +b.textContent === q.answer));
  check('grid shown after a miss', !$('#array').classList.contains('hidden'));
  await sleep(2800);

  let turns = 2;
  while (turns < 16 && $('#summary').classList.contains('hidden')) {
    const cur = solve($('#equation').textContent);
    if (!cur) { await sleep(250); continue; }
    const b = choices().find(x => +x.textContent === cur.answer && !x.disabled);
    if (!b) { await sleep(250); continue; }
    b.click();
    turns++;
    await sleep(1900);
  }
  await sleep(300);
  check('summary shown', !$('#summary').classList.contains('hidden'));
  console.log('  summary:', $('#sumTitle').textContent, '|', $('#sumSub').textContent.slice(0, 60));
  check('no page errors', errors.length === 0, errors.join('; '));
  w.close();
}

(async () => {
  await sightWords();
  await rhymeSwap();
  await arrays();
  console.log(fails ? `\n${fails} FAILURES` : '\nall three games behave');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message, errors); process.exit(1); });
