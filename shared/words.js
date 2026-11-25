/* words.js — word lists, easiest first.
 * Dolch and Fry sight-word lists are public domain (word lists are
 * uncopyrightable facts). Phonics levels follow the usual school order:
 * short vowels -> blends -> digraphs -> sight words -> silent-e.
 */
(function (global) {
  'use strict';

  var LEVELS = [
    {
      name: 'Short a',
      hint: 'cat, hat, map',
      words: ['cat', 'hat', 'bat', 'map', 'pan', 'sad', 'fan', 'bag', 'jam', 'tag']
    },
    {
      name: 'Short i and o',
      hint: 'pig, dog, sit',
      words: ['pig', 'sit', 'dog', 'log', 'pot', 'six', 'zip', 'hop', 'mop', 'kid']
    },
    {
      name: 'Short e and u',
      hint: 'bed, cup, sun',
      words: ['bed', 'ten', 'pen', 'cup', 'bug', 'sun', 'red', 'net', 'mud', 'rug']
    },
    {
      name: 'Blends',
      hint: 'frog, stop, flag',
      words: ['stop', 'frog', 'drum', 'flag', 'plum', 'crab', 'grin', 'snap', 'swim', 'twin']
    },
    {
      name: 'Digraphs',
      hint: 'ship, fish, when',
      words: ['ship', 'chip', 'fish', 'this', 'that', 'when', 'sock', 'ring', 'chat', 'thin']
    },
    {
      name: 'Tricky pairs',
      hint: 'sight words that break the rules',
      words: ['said', 'come', 'they', 'was', 'what', 'with', 'here', 'like', 'some', 'have']
    },
    {
      name: 'Silent e',
      hint: 'cake, bike, home',
      words: ['cake', 'bike', 'home', 'time', 'rope', 'five', 'note', 'game', 'line', 'cube']
    }
  ];

  // Dolch primer + first grade, for the sight-word games.
  var SIGHT = {
    primer: ['all', 'am', 'are', 'at', 'ate', 'be', 'black', 'brown', 'but', 'came',
      'did', 'do', 'eat', 'four', 'get', 'good', 'have', 'he', 'into', 'like',
      'must', 'new', 'no', 'now', 'on', 'our', 'out', 'please', 'pretty', 'ran',
      'ride', 'saw', 'say', 'she', 'so', 'soon', 'that', 'there', 'they', 'this',
      'too', 'under', 'want', 'was', 'well', 'went', 'what', 'white', 'who', 'will'],
    first: ['after', 'again', 'an', 'any', 'ask', 'as', 'by', 'could', 'every', 'fly',
      'from', 'give', 'going', 'had', 'has', 'her', 'him', 'his', 'how', 'just',
      'know', 'let', 'live', 'may', 'of', 'old', 'once', 'open', 'over', 'put',
      'round', 'some', 'stop', 'take', 'thank', 'them', 'then', 'think', 'walk', 'were']
  };

  // Rhyming families: every word is three letters, so swapping the first
  // letter is a real change and the rime stays readable.
  var FAMILIES = {
    at: ['cat', 'hat', 'bat', 'mat', 'sat', 'rat', 'pat'],
    an: ['can', 'man', 'pan', 'fan', 'ran', 'van'],
    ap: ['cap', 'map', 'nap', 'tap', 'gap', 'lap'],
    ig: ['big', 'dig', 'fig', 'pig', 'wig'],
    in: ['bin', 'fin', 'pin', 'tin', 'win'],
    it: ['bit', 'fit', 'hit', 'pit', 'sit'],
    og: ['dog', 'log', 'fog', 'hog', 'jog'],
    op: ['hop', 'mop', 'top', 'pop', 'cop'],
    ot: ['cot', 'dot', 'hot', 'lot', 'pot', 'rot'],
    ug: ['bug', 'dug', 'hug', 'jug', 'mug', 'rug', 'tug'],
    un: ['bun', 'fun', 'run', 'sun', 'gun'],
    ut: ['but', 'cut', 'hut', 'nut', 'put', 'rut']
  };

  // Finish-the-sentence: the blank is always a word we have a recording for,
  // and the wrong options come from the same vocabulary so every choice is
  // readable. Each full sentence is recorded too, so the prompt is spoken.
  var SENTENCES = [
    { text: 'The cat sat on the ___.', answer: 'mat', wrong: ['sun', 'cup', 'log'] },
    { text: 'The dog can ___.', answer: 'run', wrong: ['red', 'ten', 'top'] },
    { text: 'I can see a big ___.', answer: 'bug', wrong: ['net', 'pen', 'jam'] },
    { text: 'The sun is ___.', answer: 'hot', wrong: ['wet', 'big', 'red'] },
    { text: 'A hen is in the ___.', answer: 'pen', wrong: ['bike', 'cake', 'rope'] },
    { text: 'We can run and ___.', answer: 'hop', wrong: ['note', 'five', 'time'] },
    { text: 'The pig is in the ___.', answer: 'mud', wrong: ['cake', 'sock', 'game'] },
    { text: 'My hat is ___.', answer: 'red', wrong: ['thin', 'five', 'some'] },
    { text: 'The fox is in the ___.', answer: 'box', wrong: ['bike', 'rope', 'line'] },
    { text: 'I have a red ___.', answer: 'cap', wrong: ['note', 'time', 'cube'] },
    { text: 'The bug is on the ___.', answer: 'rug', wrong: ['cake', 'five', 'line'] },
    { text: 'We can see the ___.', answer: 'ship', wrong: ['jam', 'ten', 'pen'] },
    { text: 'The fish is in the ___.', answer: 'net', wrong: ['cake', 'home', 'time'] },
    { text: 'This is my ___.', answer: 'bike', wrong: ['jam', 'sun', 'bug'] },
    { text: 'The ring is in the ___.', answer: 'box', wrong: ['sun', 'net', 'jam'] },
    { text: 'I can chat with ___.', answer: 'them', wrong: ['cake', 'five', 'rope'] },
    { text: 'The sock is on the ___.', answer: 'bed', wrong: ['net', 'jam', 'sun'] },
    { text: 'We can play a ___.', answer: 'game', wrong: ['ten', 'bug', 'net'] },
    { text: 'I like to ___.', answer: 'hop', wrong: ['cake', 'five', 'sock'] },
    { text: 'Here is the ___.', answer: 'rope', wrong: ['bug', 'red', 'ten'] }
  ];

  // Words no game pool contains but the sentences use, so the recorder picks
  // them up and a stuck reader can still tap them.
  var EXTRAS = ['wet', 'box', 'hot', 'top', 'cap', 'mud', 'bed', 'them', 'cube',
    'plate', 'ring', 'hen', 'fin', 'log', 'chip'];

  global.Words = {
    extras: EXTRAS,
    sentences: SENTENCES,
    families: FAMILIES,
    familyNames: Object.keys(FAMILIES),
    levels: LEVELS,
    levelCount: LEVELS.length,
    level: function (n) {
      var lv = LEVELS[Math.min(Math.max(n, 1), LEVELS.length) - 1];
      return lv || LEVELS[0];
    },
    pool: function (n) { return this.level(n).words.slice(); },
    allWords: function () {
      var out = [];
      LEVELS.forEach(function (l) { out = out.concat(l.words); });
      return out;
    },
    sight: SIGHT,
    sightPool: function (band) { return (SIGHT[band] || SIGHT.primer).slice(); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
