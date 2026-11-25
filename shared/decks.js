/* decks.js — the item pools for the maths games, in one place.
 * A game picks from these, the grown-up page counts against them, so the two
 * can never disagree about how many items a deck holds.
 */
(function (global) {
  'use strict';

  var TEN_LIMIT = 12;

  // ---- ten frames ---------------------------------------------------------
  // Item id "t10:7" = a frame of ten with 7 shown; the answer is 3.
  // Only frames with 1-9 empty cells are asked: that keeps every answer inside
  // the 0-10 buttons on screen, and skips the trivial "0 and 10" and "10 and 0"
  // cases that teach nothing.
  function tenPool(target) {
    var out = [];
    var from = target > 10 ? 11 : 1;
    for (var n = from; n < target; n++) out.push('t' + target + ':' + n);
    return out;
  }

  function parseTen(id) {
    var parts = String(id).split(':');
    var target = parseInt(parts[0].slice(1), 10);
    var shown = parseInt(parts[1], 10);
    return { target: target, shown: shown, answer: target - shown };
  }

  // ---- fact fluency -------------------------------------------------------
  // Level 1: sums to 5. 2: sums to 10. 3: subtraction within 10.
  // 4: mixed within 20. 5: missing addend.
  function factPool(level) {
    var out = [], a, b;

    if (level <= 1) {
      for (a = 1; a <= 5; a++) {
        for (b = 1; b + a <= 5; b++) out.push(a + '+' + b);
      }
    } else if (level === 2) {
      for (a = 1; a <= 10; a++) {
        for (b = 1; b + a <= 10; b++) if (a + b >= 6) out.push(a + '+' + b);
      }
    } else if (level === 3) {
      for (a = 2; a <= 10; a++) {
        for (b = 1; b < a; b++) out.push(a + '-' + b);
      }
    } else if (level === 4) {
      for (a = 6; a <= 18; a++) {
        for (b = 1; b <= a; b++) {
          if (a + b <= 20) out.push(a + '+' + b);
        }
      }
      for (a = 11; a <= 20; a++) {
        for (b = 1; b < a; b++) out.push(a + '-' + b);
      }
    } else {
      for (a = 0; a <= 10; a++) {
        for (b = 0; b <= 10; b++) {
          if (a + b >= 6 && a + b <= 20) out.push(a + '+_=' + (a + b));
        }
      }
    }
    return out;
  }

  // "6+9" -> {kind:'add'|'sub'|'missing', a, b, c, answer, text}
  function parseFact(id) {
    var m = /^(\d+)\+_=(\d+)$/.exec(id);
    if (m) {
      var a1 = +m[1], c1 = +m[2];
      return { kind: 'missing', a: a1, b: c1 - a1, c: c1, answer: c1 - a1,
        text: a1 + ' + ? = ' + c1 };
    }
    m = /^(\d+)([+-])(\d+)$/.exec(id);
    if (m) {
      var a2 = +m[1], b2 = +m[3];
      if (m[2] === '+') {
        return { kind: 'add', a: a2, b: b2, answer: a2 + b2, text: a2 + ' + ' + b2 + ' = ?' };
      }
      return { kind: 'sub', a: a2, b: b2, answer: a2 - b2, text: a2 + ' − ' + b2 + ' = ?' };
    }
    return null;
  }

  function union(fn) {
    var seen = {}, out = [];
    for (var lv = 1; lv <= 5; lv++) {
      fn(lv).forEach(function (i) {
        if (!seen[i]) { seen[i] = true; out.push(i); }
      });
    }
    return out;
  }

  function tenUnion() {
    return tenPool(10).concat(tenPool(20));
  }

  global.Decks = {
    tenframe: {
      label: 'Ten-Frame Fill',
      maxLevel: 2,
      targetFor: function (level) { return level >= 2 ? 20 : 10; },
      pool: function (level) { return tenPool(this.targetFor(level)); },
      all: function () { return tenUnion(); },
      parse: parseTen
    },
    facts: {
      label: 'Fact Frenzy',
      maxLevel: 5,
      pool: function (level) { return factPool(level); },
      all: function () { return union(factPool); },
      parse: parseFact
    },
    TEN_LIMIT: TEN_LIMIT
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
