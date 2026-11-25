// Headless playthrough of games/ten-frame: correct answer, wrong answer, summary.
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
        play: function () { window.__clips = (window.__clips || []).concat(this._src); return Promise.reject(new Error('no media in jsdom')); },
        pause: function () {}, load: function () {}, currentTime: 0, onerror: null
      };
    };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  }
};

(async () => {
  const dom = await JSDOM.fromURL(BASE + '/games/ten-frame/index.html', {
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

  const read = () => {
    const prompt = $('#prompt').textContent;
    const target = +/make (\d+)/.exec(prompt)[1];
    const filled = doc.querySelectorAll('.cell.on:not(.added)').length;
    return { prompt, target, filled, answer: target - filled };
  };
  const choices = () => Array.from(doc.querySelectorAll('#choices .choice'));
  const clickNumber = n => {
    const c = choices().find(b => +b.textContent === n);
    if (!c) throw new Error('no choice ' + n + ' in ' + choices().map(b => b.textContent).join(','));
    c.click();
  };

  // ---- turn 1: right ----
  let q = read();
  console.log('\nturn 1:', q.prompt, '| filled', q.filled, '| answer', q.answer,
    '| choices', choices().map(b => b.textContent).join(','));
  console.log('clip requested:', (window.__clips || []).slice(-1)[0]);
  clickNumber(q.answer);
  await sleep(150);
  console.log('feedback:', $('#feedback').textContent, '|', $('#feedback').className);
  console.log('cells added after right:', doc.querySelectorAll('.cell.added').length);
  const st = window.Learn.get('tenframe', 't' + q.target + ':' + q.filled);
  console.log('recorded right:', st.right, 'box:', st.box);
  await sleep(1500);

  // ---- turn 2: wrong ----
  q = read();
  const wrong = q.answer === 0 ? 1 : q.answer - 1;
  console.log('\nturn 2:', q.prompt, '| filled', q.filled, '| answering', wrong, 'not', q.answer);
  clickNumber(wrong);
  await sleep(150);
  console.log('feedback:', $('#feedback').textContent, '|', $('#feedback').className);
  console.log('correct choice highlighted:', Array.from(doc.querySelectorAll('#choices .choice.good')).map(b => b.textContent).join(','));
  console.log('cells now shown:', doc.querySelectorAll('.cell.on').length);
  await sleep(2600);

  // ---- play out the rest ----
  let turns = 2;
  while (turns < 16) {
    if (!$('#summary').classList.contains('hidden')) break;
    const t = read();
    if (!t.prompt) { await sleep(200); continue; }
    clickNumber(t.answer);
    turns++;
    await sleep(1500);
  }

  await new Promise(r => setTimeout(r, 200));
  console.log('\n--- summary ---');
  console.log('shown:', !$('#summary').classList.contains('hidden'));
  console.log('title:', $('#sumTitle').textContent, '| sub:', $('#sumSub').textContent);
  console.log('right:', $('#sumRight').textContent, 'new:', $('#sumNew').textContent, 'miss:', $('#sumMiss').textContent);
  console.log('badge:', $('#levelBadge').textContent);
  console.log('stored decks:', Object.keys(JSON.parse(window.localStorage.getItem('kg.progress.v1')).decks).join(','));
  console.log('errors:', errors.length ? errors : 'none');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message, errors); process.exit(1); });
