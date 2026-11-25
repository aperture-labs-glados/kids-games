// Profiles: first-run setup, switching, isolation between children, migration
// of the old single-store layout, and the guard that keeps a game from writing
// into the wrong child's progress.
const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = 'http://127.0.0.1:8099';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  // jsdom cannot navigate (the guard's location.replace) and has no media
  // stack; neither is a page error
  if (/navigation|Not implemented: HTMLMediaElement/i.test(e.message)) return;
  errors.push('jsdomError: ' + e.message);
});

let fails = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

async function open(path, seed) {
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse(w) {
      if (seed) seed(w.localStorage);
    }
  });
  await new Promise(r => dom.window.addEventListener('load', r));
  await sleep(350);
  return dom.window;
}

(async () => {
  // ---- first run ---------------------------------------------------------
  console.log('first run');
  const hub = await open('/index.html');
  const doc = hub.document;
  const $ = s => doc.querySelector(s);

  check('setup card is shown', !$('#setup').classList.contains('hidden'));
  check('the games are hidden until a player exists', $('#grid').classList.contains('hidden'));
  check('no players stored', hub.Learn.players().length === 0);

  $('#nameInput').value = 'Ada';
  $('#addBtn').click();
  await sleep(150);

  check('a player was created', hub.Learn.players().length === 1, hub.Learn.players()[0] && hub.Learn.players()[0].name);
  check('that player is active', hub.Learn.activePlayer() && hub.Learn.activePlayer().name === 'Ada');
  check('setup card closed', $('#setup').classList.contains('hidden'));
  check('games revealed', !$('#grid').classList.contains('hidden'));
  check('badge names the child', $('#progressBadge').textContent.indexOf('Ada') === 0, $('#progressBadge').textContent);

  // ---- a second child ----------------------------------------------------
  console.log('second child');
  Array.from(doc.querySelectorAll('.player-chip')).find(b => /Add/.test(b.textContent)).click();
  await sleep(100);
  check('add form reopens', !$('#setup').classList.contains('hidden'));
  check('games hidden while adding', $('#grid').classList.contains('hidden'));

  $('#nameInput').value = 'Ben';
  $('#addBtn').click();
  await sleep(150);
  check('two players', hub.Learn.players().length === 2);
  check('Ben is active', hub.Learn.activePlayer().name === 'Ben');

  // ---- progress does not leak between them --------------------------------
  console.log('isolation');
  hub.Learn.record('spell', 'cat', true);
  hub.Learn.record('spell', 'cat', true);
  const benMastery = hub.Learn.get('spell', 'cat').right;
  check('Ben recorded his answers', benMastery === 2);

  const ada = hub.Learn.players().find(p => p.name === 'Ada');
  hub.Learn.setActive(ada.id);
  check('Ada starts clean', hub.Learn.get('spell', 'cat').seen === 0,
    'seen=' + hub.Learn.get('spell', 'cat').seen);

  hub.Learn.setActive(hub.Learn.players().find(p => p.name === 'Ben').id);
  check('Ben still has his', hub.Learn.get('spell', 'cat').right === 2);

  // ---- switching by tapping the chip -------------------------------------
  console.log('chip switching');
  Array.from(doc.querySelectorAll('.player-chip')).find(b => /Ada/.test(b.textContent)).click();
  await sleep(100);
  check('Ada is active after the tap', hub.Learn.activePlayer().name === 'Ada');
  check('badge follows the switch', $('#progressBadge').textContent.indexOf('Ada') === 0);

  // ---- the game guard ----------------------------------------------------
  console.log('game guard');
  const stray = await open('/games/speak-build/index.html', ls => {
    // a player exists, but nobody is selected
    ls.setItem('kg.players', JSON.stringify([{ id: 'p1', name: 'Ada', emoji: '🐣' }]));
  });
  stray.document.getElementById('startBtn').click();
  await sleep(250);
  check('game does not start without a selected player',
    stray.document.getElementById('game').classList.contains('hidden'));

  const ok = await open('/games/speak-build/index.html', ls => {
    ls.setItem('kg.players', JSON.stringify([{ id: 'p1', name: 'Ada', emoji: '🐣' }]));
    ls.setItem('kg.active', 'p1');
  });
  ok.document.getElementById('startBtn').click();
  await sleep(400);
  check('game starts with a player selected',
    !ok.document.getElementById('game').classList.contains('hidden'));

  // ---- migration of the old single-store layout ---------------------------
  console.log('migration');
  const oldStore = JSON.stringify({
    items: { 'spell::hat': { d: 'spell', i: 'hat', box: 3, right: 5, wrong: 1, seen: 6, due: 0, last: 1 } },
    decks: { spell: { level: 4, run: 1, miss: 0, answered: 6, correct: 5 } }
  });
  const mig = await open('/index.html', ls => { ls.setItem('kg.progress.v1', oldStore); });
  const migDoc = mig.document;
  migDoc.querySelector('#nameInput').value = 'Ada';
  migDoc.querySelector('#addBtn').click();
  await sleep(150);
  const id = mig.Learn.activePlayer().id;
  const bucket = mig.localStorage.getItem('kg.v2.' + id);
  check('old progress moved into the first player', !!bucket && bucket.indexOf('spell::hat') !== -1);
  check('old key removed', mig.localStorage.getItem('kg.progress.v1') === null);
  check('level survived', mig.Learn.level('spell') === 4, String(mig.Learn.level('spell')));

  console.log('page errors:', errors.length ? errors : 'none');
  if (errors.length) fails++;
  console.log(fails ? `\n${fails} FAILURES` : '\nprofiles behave');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message, errors); process.exit(1); });
