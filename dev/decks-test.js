// Unit checks on the deck data: every pool parses, every answer is reachable,
// nothing repeats. No DOM needed.
require('/opt/data/kids-games/shared/words.js');
require('/opt/data/kids-games/shared/decks.js');
const D = globalThis.Decks;
const W = globalThis.Words;
const fs = require('fs');
const CLIPS = new Set(
  fs.readdirSync('/opt/data/kids-games/shared/audio/words')
    .filter(f => f.endsWith('.mp3'))
    .map(f => f.replace('.mp3', ''))
);

let fails = 0;
const bad = (msg) => { fails++; console.log('  FAIL', msg); };

console.log('tenframe');
[[1, 10], [2, 20]].forEach(([level, target]) => {
  const pool = D.tenframe.pool(level);
  console.log(`  level ${level}: ${pool.length} items, target ${D.tenframe.targetFor(level)}`);
  if (D.tenframe.targetFor(level) !== target) bad('target mismatch at level ' + level);
  if (pool.length !== 9) bad(`level ${level} should hold 9 items, has ${pool.length}`);
  pool.forEach(id => {
    const q = D.tenframe.parse(id);
    if (q.target !== target) bad(`${id} target ${q.target}`);
    if (q.shown + q.answer !== q.target) bad(`${id} does not add up`);
    if (q.answer < 1 || q.answer > 10) bad(`${id} answer ${q.answer} unreachable from the 0-10 buttons`);
    if (q.shown < 1) bad(`${id} shows an empty frame`);
  });
});

console.log('facts');
for (let level = 1; level <= D.facts.maxLevel; level++) {
  const pool = D.facts.pool(level);
  const seen = new Set();
  pool.forEach(id => {
    if (seen.has(id)) bad(`level ${level} duplicate ${id}`);
    seen.add(id);
    const q = D.facts.parse(id);
    if (!q) return bad(`level ${level} unparseable ${id}`);
    if (!q.text.includes('?')) bad(`${id} has no blank`);
    if (!Number.isFinite(q.answer) || q.answer < 0 || q.answer > 20) bad(`${id} answer ${q.answer}`);
    if (q.kind === 'add' && q.a + q.b !== q.answer) bad(`${id} wrong sum`);
    if (q.kind === 'sub' && q.a - q.b !== q.answer) bad(`${id} wrong difference`);
    if (q.kind === 'missing' && q.a + q.answer !== q.c) bad(`${id} wrong missing addend`);
  });
  const kinds = new Set(pool.map(id => D.facts.parse(id).kind));
  console.log(`  level ${level}: ${pool.length} items, kinds ${[...kinds].join('+')}`);
  if (!pool.length) bad('level ' + level + ' is empty');
}

// the four-choice generator has to be able to fill itself at every level
console.log('choices');
function choiceCount(answer, level) {
  const max = level >= 4 ? 20 : 12;
  const pool = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3, answer + 10, answer - 10];
  const out = [answer];
  pool.forEach(n => {
    if (out.length < 4 && n >= 0 && n <= max && out.indexOf(n) === -1) out.push(n);
  });
  return out.length;
}
let thin = 0;
for (let level = 1; level <= 5; level++) {
  D.facts.pool(level).forEach(id => {
    const q = D.facts.parse(id);
    if (choiceCount(q.answer, level) < 4) thin++;
  });
}
console.log('  questions that cannot make four choices:', thin);
if (thin) bad(thin + ' questions cannot fill the answer grid');

console.log('sight words');
[[1, 50], [2, 40]].forEach(([level, count]) => {
  const pool = D.sight.pool(level);
  console.log(`  level ${level}: ${pool.length} words`);
  if (pool.length !== count) bad(`level ${level} should hold ${count} words, has ${pool.length}`);
  const missing = pool.filter(w => !CLIPS.has(w));
  if (missing.length) bad(`level ${level} has words with no recording: ${missing.join(',')}`);
});

console.log('rhyme & swap');
for (let level = 1; level <= D.rhyme.maxLevel; level++) {
  const pool = D.rhyme.pool(level);
  const seen = new Set();
  pool.forEach(id => {
    if (seen.has(id)) bad(`rhyme level ${level} duplicate ${id}`);
    seen.add(id);
    const q = D.rhyme.parse(id);
    if (!q.word || q.word.length !== 3) bad(`${id} is not a three-letter word`);
    if (!q.word.endsWith(q.rime)) bad(`${id} does not end with its rime`);
    if (q.answer !== q.word.charAt(0)) bad(`${id} answer is not the first letter`);
    const family = (W.families[q.rime] || []);
    if (family.indexOf(q.word) === -1) bad(`${id} is not in the ${q.rime} family`);
    if (!CLIPS.has(q.word)) bad(`${id} has no recording for "${q.word}"`);
  });
  console.log(`  set ${level}: ${pool.length} swaps across ${new Set(pool.map(i => D.rhyme.parse(i).rime)).size} families`);
  if (!pool.length) bad('rhyme set ' + level + ' is empty');
}

console.log('array builder');
for (let level = 1; level <= D.arrays.maxLevel; level++) {
  const pool = D.arrays.pool(level);
  pool.forEach(id => {
    const q = D.arrays.parse(id);
    if (!q) return bad(`unparseable ${id}`);
    if (q.rows * q.cols !== q.answer) bad(`${id} wrong product`);
    if (!q.text.includes('?')) bad(`${id} has no blank`);
    if (q.rows < 2 || q.rows > 10 || q.cols < 1 || q.cols > 10) bad(`${id} out of range`);
  });
  console.log(`  level ${level}: ${pool.length} arrays, largest answer ` +
    Math.max(...pool.map(i => D.arrays.parse(i).answer)));
  if (!pool.length) bad('array level ' + level + ' is empty');
}

console.log('decks.all()');
console.log('  tenframe:', D.tenframe.all().length, 'facts:', D.facts.all().length);
if (new Set(D.tenframe.all()).size !== D.tenframe.all().length) bad('tenframe.all has duplicates');

console.log(fails ? `\n${fails} FAILURES` : '\nall deck checks passed');
process.exit(fails ? 1 : 0);
