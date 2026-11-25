/* stickers.js — the reward shelf.
 *
 * Not a game: a set of milestones read straight off the mastery store, so the
 * stickers cannot drift from what the child actually did. Each player has their
 * own shelf, and a sticker they have not looked at yet counts as "new".
 */
(function (global) {
  'use strict';

  var DECKS = ['spell', 'sight', 'rhyme', 'tenframe', 'facts', 'arrays', 'numberline', 'read'];

  var RULES = [
    { id: 'first', emoji: '🐣', label: 'First Steps', hint: 'Answer one question',
      test: function (c) { return c.seen >= 1; } },
    { id: 'ten-words', emoji: '📚', label: 'Ten Words', hint: 'Master ten words',
      test: function (c) { return mastered(c, 'spell') + mastered(c, 'sight') >= 10; } },
    { id: 'rhyme-time', emoji: '🎵', label: 'Rhyme Time', hint: 'Master ten letter swaps',
      test: function (c) { return mastered(c, 'rhyme') >= 10; } },
    { id: 'make-ten', emoji: '🔟', label: 'Make Ten', hint: 'Master six frames',
      test: function (c) { return mastered(c, 'tenframe') >= 6; } },
    { id: 'fact-master', emoji: '➕', label: 'Fact Master', hint: 'Master 25 sums',
      test: function (c) { return mastered(c, 'facts') >= 25; } },
    { id: 'array-ace', emoji: '▦', label: 'Array Ace', hint: 'Master ten arrays',
      test: function (c) { return mastered(c, 'arrays') >= 10; } },
    { id: 'line-walker', emoji: '📏', label: 'Line Walker', hint: 'Master ten hops on the number line',
      test: function (c) { return mastered(c, 'numberline') >= 10; } },
    { id: 'big-reader', emoji: '📖', label: 'Big Reader', hint: 'Finish ten sentences',
      test: function (c) { return mastered(c, 'read') >= 10; } },
    { id: 'climber', emoji: '🚀', label: 'Climber', hint: 'Reach level 3 in any game',
      test: function (c) { return c.topLevel >= 3; } },
    { id: 'all-star', emoji: '⭐', label: 'Every Game', hint: 'Try all eight games',
      test: function (c) {
        return DECKS.every(function (d) {
          var s = c.per[d];
          return !!s && (s.mastered + s.learning) > 0;
        });
      } },
    { id: 'hundred', emoji: '💯', label: 'One Hundred', hint: 'Master a hundred things',
      test: function (c) { return c.masteredTotal >= 100; } }
  ];

  function mastered(ctx, deck) {
    var d = ctx.per[deck];
    return d ? d.mastered : 0;
  }

  function collect() {
    var ctx = { per: {}, seen: 0, masteredTotal: 0, topLevel: 0 };

    DECKS.forEach(function (deck) {
      var s = Learn.stats(deck, null);
      ctx.per[deck] = s;
      ctx.seen += s.mastered + s.learning;
      ctx.masteredTotal += s.mastered;
      var lv = Learn.level(deck);
      if (lv > ctx.topLevel) ctx.topLevel = lv;
    });
    return ctx;
  }

  function seenKey() {
    var id = Learn.activeId();
    return id ? 'kg.stickers.seen.' + id : '';
  }

  function seenList() {
    var key = seenKey();
    if (!key) return [];
    try {
      var v = JSON.parse(global.localStorage.getItem(key));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function saveSeen(list) {
    var key = seenKey();
    if (!key) return;
    try { global.localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
  }

  // Every sticker with whether it is earned, and whether it is new to this child.
  function list() {
    var ctx = collect();
    var seen = seenList();
    return RULES.map(function (r) {
      var earned = false;
      try { earned = !!r.test(ctx); } catch (e) { earned = false; }
      return {
        id: r.id,
        emoji: r.emoji,
        label: r.label,
        hint: r.hint,
        earned: earned,
        fresh: earned && seen.indexOf(r.id) === -1
      };
    });
  }

  function count() {
    var all = list();
    return {
      earned: all.filter(function (s) { return s.earned; }).length,
      total: all.length,
      fresh: all.filter(function (s) { return s.fresh; }).length
    };
  }

  // Called when the child has actually looked at the shelf.
  function markSeen() {
    var earned = list().filter(function (s) { return s.earned; }).map(function (s) { return s.id; });
    saveSeen(earned);
    return earned.length;
  }

  global.Stickers = {
    list: list,
    count: count,
    markSeen: markSeen,
    decks: DECKS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
