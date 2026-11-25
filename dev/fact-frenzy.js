// Headless playthrough of games/fact-frenzy: right, wrong, hint, summary.
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = 'http://127.0.0.1:8099';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const stubs = {
  beforeParse(window) {
    window.__spoken = [];
    window.localStorage.setItem('kg.players', JSON.stringify([{ id: 'p1', name: 'Test', emoji: '🐣' }]));
    window.localStorage.setItem('kg.active', 'p1');
    const voices = [{ name: 'Test Voice', lang: 'en-US', localService: true }];
    window.speechSynthesis = {
      getVoices: () => voices,
      speak: u => { if (u && u.text) window.__spoken.push(String(u.text).trim()); },
      cancel: () => {}, addEventListener: () => {}
    };
    window.HTMLCanvasElement.prototype.getContext = function () { return null; };
    window.Audio = function () {
      return {
        _src: '', preload: 'auto',
        get src() { return this._src; }, set src(v) { this._src = v; },
        play: function () { return Promise.reject(new Error('no media in jsdom')); },
        pause: function () {}, load: function () {}, currentTime: 0, onerror: null
      };
    };
    // count fanfare notes instead of making sound
    window.__osc = 0;
    window.AudioContext = function () {
    return {
      currentTime: 0, state: 'running', destination: {},
      createOscillator: function () {
        return { type: '', frequency: { setValueAtTime: function () {} },
          connect: function () {}, start: function () { window.__osc += 1; },
          stop: function () {} };
      },
      createGain: function () {
        return { gain: { setValueAtTime: function () {},
          exponentialRampToValueAtTime: function () {} }, connect: function () {} };
      },
      resume: function () {}
    };
    };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  }
};

// "6 + 9 = ?" / "9 − 4 = ?" / "6 + ? = 10"
function solve(text) {
  let m = /^(\d+) \+ \? = (\d+)$/.exec(text);
  if (m) return +m[2] - +m[1];
  m = /^(\d+) \+ (\d+) = \?$/.exec(text);
  if (m) return +m[1] + +m[2];
  m = /^(\d+) − (\d+) = \?$/.exec(text);
  if (m) return +m[1] - +m[2];
  return null;
}

(async () => {
  const dom = await JSDOM.fromURL(BASE + '/games/fact-frenzy/index.html', {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
    pretendToBeVisual: true, beforeParse: stubs.beforeParse
  });
  const { window } = dom, doc = window.document;
  const $ = s => doc.querySelector(s);
  await new Promise(r => window.addEventListener('load', r));
  await sleep(400);

  console.log('badge on load:', $('#levelBadge').textContent);
  $('#startBtn').click();
  await sleep(300);

  const choices = () => Array.from(doc.querySelectorAll('#choices .choice'));
  const clickNumber = n => {
    const c = choices().find(b => +b.textContent === n);
    if (!c) throw new Error('no choice ' + n + ' in ' + choices().map(b => b.textContent).join(','));
    c.click();
  };

  // ---- turn 1: right ----
  let text = $('#equation').textContent;
  let answer = solve(text);
  console.log('\nturn 1:', text, '| answer', answer, '| choices', choices().map(b => b.textContent).join(','));
  if (choices().length !== 4) throw new Error('expected 4 choices, got ' + choices().length);
  if (new Set(choices().map(b => b.textContent)).size !== 4) throw new Error('duplicate choices');
  clickNumber(answer);
  await sleep(150);
  console.log('equation now:', $('#equation').textContent, '| feedback:', $('#feedback').textContent);
  console.log('correct choice marked:', doc.querySelectorAll('#choices .choice.good').length);
  console.log('fanfare notes played:', window.__osc, '(expect 5)');
  await sleep(1400);

  // ---- turn 2: hint + wrong answer ----
  text = $('#equation').textContent;
  answer = solve(text);
  const hintHidden = $('#hintBtn').classList.contains('hidden');
  console.log('\nturn 2:', text, '| answer', answer, '| hint hidden:', hintHidden);
  if (!hintHidden) {
    $('#hintBtn').click();
    await sleep(100);
    console.log('counters shown:', !$('#counters').classList.contains('hidden'),
      '| pips:', doc.querySelectorAll('#counters .pip').length);
  }
  const wrong = choices().map(b => +b.textContent).find(n => n !== answer);
  clickNumber(wrong);
  await sleep(150);
  console.log('feedback:', $('#feedback').textContent, '|', $('#feedback').className);
  console.log('equation reveals:', $('#equation').textContent);
  console.log('good choice highlighted:', Array.from(doc.querySelectorAll('#choices .choice.good')).map(b => b.textContent).join(','));
  await sleep(2600);

  // ---- play out ----
  let turns = 2;
  while (turns < 16) {
    if (!$('#summary').classList.contains('hidden')) break;
    const t = $('#equation').textContent;
    const a = solve(t);
    if (a === null || $('#game').classList.contains('hidden')) { await sleep(200); continue; }
    clickNumber(a);
    turns++;
    await sleep(1400);
  }

  console.log('\n--- summary ---');
  console.log('shown:', !$('#summary').classList.contains('hidden'));
  console.log('title:', $('#sumTitle').textContent, '| sub:', $('#sumSub').textContent);
  console.log('right:', $('#sumRight').textContent, 'new:', $('#sumNew').textContent, 'miss:', $('#sumMiss').textContent);
  console.log('badge:', $('#levelBadge').textContent);
  const store = JSON.parse(window.localStorage.getItem('kg.v2.p1'));
  console.log('facts items recorded:', Object.keys(store.items).filter(k => k.startsWith('facts::')).length);
  console.log('errors:', errors.length ? errors : 'none');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message, errors); process.exit(1); });
