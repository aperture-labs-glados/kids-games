// Probe: what does the deck state do over two answers?
const { JSDOM, VirtualConsole } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vc = new VirtualConsole();
vc.on('jsdomError', () => {});
(async () => {
  const dom = await JSDOM.fromURL('http://127.0.0.1:8099/games/ten-frame/index.html', {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      w.speechSynthesis = { getVoices: () => [{name:'x',lang:'en-US'}], speak(){}, cancel(){}, addEventListener(){} };
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.Audio = function () { return { play: () => Promise.reject(new Error('x')), pause(){}, load(){}, currentTime:0,
        get src(){return this._s}, set src(v){this._s=v} }; };
      w.SpeechSynthesisUtterance = function (t) { this.text = t; };
    }
  });
  const w = dom.window, doc = w.document;
  await new Promise(r => w.addEventListener('load', r));
  await sleep(300);
  doc.querySelector('#startBtn').click();
  await sleep(200);
  const state = () => JSON.stringify(w.Learn.deckState('tenframe'));
  const q = () => {
    const p = doc.querySelector('#prompt').textContent;
    const target = +/make (\d+)/.exec(p)[1];
    const filled = doc.querySelectorAll('.cell.on').length;
    return { target, filled, answer: target - filled, p };
  };
  console.log('before:', state());
  let a = q(); console.log('q1:', a.p, a.filled, '->', a.answer);
  Array.from(doc.querySelectorAll('#choices .choice')).find(b => +b.textContent === a.answer).click();
  await sleep(1600);
  console.log('after right:', state());
  a = q(); console.log('q2:', a.p, a.filled, '->', a.answer);
  const wrong = a.answer === 0 ? 1 : a.answer - 1;
  Array.from(doc.querySelectorAll('#choices .choice')).find(b => +b.textContent === wrong).click();
  await sleep(1600);
  console.log('after wrong:', state());
  a = q(); console.log('q3:', a.p, a.filled, '->', a.answer, '| choices:', Array.from(doc.querySelectorAll('#choices .choice')).map(b=>b.textContent).join(','));
  process.exit(0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
