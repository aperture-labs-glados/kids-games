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

  global.Words = {
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
