// Headless playthrough of games/speak-build against the local server.
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = 'http://127.0.0.1:8099';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

(async () => {
  const dom = await JSDOM.fromURL(BASE + '/games/speak-build/index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse(window) {
      window.__spoken = [];
      const voices = [{ name: 'Test Voice', lang: 'en-US', localService: true }];
      window.speechSynthesis = {
        getVoices: () => voices,
        speak: u => { if (u && u.text) window.__spoken.push(String(u.text).trim()); },
        cancel: () => {},
        addEventListener: () => {}
      };
      window.SpeechSynthesisUtterance = function (t) {
        this.text = t; this.volume = 1; this.rate = 1; this.pitch = 1;
      };
    }
  });

  const { window } = dom;
  const doc = window.document;
  const $ = s => doc.querySelector(s);
  const waitFor = async (fn, label, ms = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return true;
      await sleep(60);
    }
    throw new Error('timeout waiting for ' + label);
  };

  await new Promise(r => window.addEventListener('load', r));
  await sleep(400);

  const gateVisible = !$('#gate').classList.contains('hidden');
  console.log('gate visible on load:', gateVisible);
  console.log('badge:', $('#levelBadge').textContent);

  $('#startBtn').click();
  await waitFor(() => !$('#game').classList.contains('hidden'), 'game shown');
  await sleep(200);

  const currentWord = () => {
    const s = window.__spoken.filter(Boolean);
    return s[s.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  };

  const tiles = () => Array.from(doc.querySelectorAll('#tiles .tile'));
  const clickLetter = ch => {
    const t = tiles().find(b => !b.classList.contains('used') && b.textContent === ch);
    if (!t) throw new Error('no tile for ' + ch + ' in ' + tiles().map(b => b.textContent).join(''));
    t.click();
  };

  // ---- turn 1: spell it correctly, using the hint for the first letter ----
  let word = currentWord();
  console.log('\nturn 1 word:', word, '| slots:', doc.querySelectorAll('#slots .slot').length);
  if (!word || word.length !== doc.querySelectorAll('#slots .slot').length) {
    throw new Error('slot count does not match spoken word');
  }
  $('#hintBtn').click();
  await sleep(100);
  const afterHint = Array.from(doc.querySelectorAll('#slots .slot')).map(s => s.textContent).join('');
  console.log('hint filled first letter:', JSON.stringify(afterHint), '| hint disabled:', $('#hintBtn').disabled);
  word.slice(1).split('').forEach(clickLetter);
  await waitFor(() => /Yes!/.test($('#feedback').textContent), 'correct feedback');
  console.log('feedback:', $('#feedback').textContent, '| class:', $('#feedback').className);
  const st1 = window.Learn.get('spell', word);
  console.log('recorded right:', st1.right, 'box:', st1.box);
  await sleep(1400);

  // ---- turn 2: get it wrong on purpose ----
  word = currentWord();
  console.log('\nturn 2 word:', word);
  const wrong = word.length > 1 && word[0] !== word[1] ? word[1] + word[0] + word.slice(2) : 'zzz';
  try {
    wrong.split('').forEach(clickLetter);
  } catch (e) {
    const seq = tiles().map(b => b.textContent).slice(0, word.length).join('');
    seq.split('').forEach(clickLetter);
  }
  await waitFor(() => /spelled/.test($('#feedback').textContent) || /Yes!/.test($('#feedback').textContent), 'wrong feedback');
  console.log('feedback:', $('#feedback').textContent, '| class:', $('#feedback').className);
  console.log('slots now show:', Array.from(doc.querySelectorAll('#slots .slot')).map(s => s.textContent).join(''));
  const st2 = window.Learn.get('spell', word);
  console.log('recorded wrong:', st2.wrong, 'box:', st2.box);
  await sleep(2400);

  // ---- play out the rest of the session ----
  let turns = 2;
  while (turns < 15) {
    if (!$('#summary').classList.contains('hidden')) break;
    const w = currentWord();
    const slotCount = doc.querySelectorAll('#slots .slot').length;
    if (!w || w.length !== slotCount) { await sleep(200); continue; }
    try {
      w.split('').forEach(clickLetter);
    } catch (e) {
      await sleep(300);
      continue;
    }
    turns++;
    await waitFor(() => /Yes!|spelled/.test($('#feedback').textContent), 'turn ' + turns, 5000);
    await sleep(1350);
  }

  await waitFor(() => !$('#summary').classList.contains('hidden'), 'summary', 9000);
  console.log('\n--- summary ---');
  console.log('title:', $('#sumTitle').textContent);
  console.log('sub:', $('#sumSub').textContent);
  console.log('right:', $('#sumRight').textContent, 'new:', $('#sumNew').textContent, 'miss:', $('#sumMiss').textContent);
  console.log('level badge now:', $('#levelBadge').textContent);
  console.log('dots:', Array.from(doc.querySelectorAll('#dots i')).map(d => d.className || 'fresh').join(','));

  // ---- grown-up page reads the same store ----
  const saved = window.localStorage.getItem('kg.progress.v1');
  const dom2 = await JSDOM.fromURL(BASE + '/grown-up.html', {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
    beforeParse(w) { w.localStorage.setItem('kg.progress.v1', saved); }
  });
  await new Promise(r => dom2.window.addEventListener('load', r));
  await sleep(300);
  const cards = dom2.window.document.querySelectorAll('#decks .card');
  console.log('\ngrown-up cards:', cards.length);
  if (cards.length) console.log('card text:', cards[0].textContent.replace(/\s+/g, ' ').slice(0, 320));
  console.log('errors:', errors.length ? errors : 'none');
  process.exit(0);
})().catch(e => {
  console.error('TEST FAILED:', e.message);
  console.error('errors:', errors);
  process.exit(1);
});
