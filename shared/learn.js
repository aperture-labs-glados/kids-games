/* learn.js — shared mastery engine.
 * Every game calls this so a word practiced in one game counts in another.
 * Model: Leitner boxes per item. Correct -> box up, wrong -> back to box 1.
 *
 * Progress is stored per player. Two children on one iPad must not inherit each
 * other's level, so every profile gets its own bucket and the active profile id
 * lives in its own key.
 *
 * Nothing here talks to a network: progress is localStorage only.
 */
(function (global) {
  'use strict';

  var OLD_KEY = 'kg.progress.v1';   // single-user layout, migrated on first run
  var PLAYERS_KEY = 'kg.players';
  var ACTIVE_KEY = 'kg.active';
  var MASTER_BOX = 4;
  // Rest period per box, in ms. Box 1 is short so a missed item returns
  // inside the same session; box 4 is "mastered", a few days off.
  var INTERVALS = { 1: 45 * 1000, 2: 10 * 60 * 1000, 3: 24 * 3600 * 1000, 4: 3 * 24 * 3600 * 1000 };

  var store = null;

  function now() { return Date.now(); }

  // ---- players ------------------------------------------------------------
  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(global.localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function players() {
    var list = readJSON(PLAYERS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function savePlayers(list) {
    try { global.localStorage.setItem(PLAYERS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function player(id) {
    var list = players();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function activeId() {
    try { return global.localStorage.getItem(ACTIVE_KEY) || ''; } catch (e) { return ''; }
  }

  function activePlayer() {
    var id = activeId();
    return id ? player(id) : null;
  }

  function setActive(id) {
    try {
      if (id) global.localStorage.setItem(ACTIVE_KEY, id);
      else global.localStorage.removeItem(ACTIVE_KEY);
    } catch (e) {}
    store = null;   // force a reload from the new bucket
    return activePlayer();
  }

  function bucketKey(id) { return 'kg.v2.' + id; }

  // The old single-store progress becomes the first player's, once.
  function migrateTo(id) {
    var old;
    try { old = global.localStorage.getItem(OLD_KEY); } catch (e) { return; }
    if (!old) return;
    try {
      if (!global.localStorage.getItem(bucketKey(id))) {
        global.localStorage.setItem(bucketKey(id), old);
      }
      global.localStorage.removeItem(OLD_KEY);
    } catch (e) {}
  }

  function addPlayer(name, emoji) {
    var list = players();
    var clean = String(name || '').trim().slice(0, 14) || 'Player ' + (list.length + 1);
    var id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 900 + 100);
    list.push({ id: id, name: clean, emoji: emoji || '🐣' });
    savePlayers(list);
    migrateTo(id);
    return id;
  }

  function updatePlayer(id, fields) {
    var list = players();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        if (fields.name !== undefined) list[i].name = String(fields.name).trim().slice(0, 14) || list[i].name;
        if (fields.emoji !== undefined) list[i].emoji = fields.emoji;
      }
    }
    savePlayers(list);
  }

  function removePlayer(id) {
    var list = players().filter(function (p) { return p.id !== id; });
    savePlayers(list);
    try { global.localStorage.removeItem(bucketKey(id)); } catch (e) {}
    if (activeId() === id) setActive(list.length ? list[0].id : '');
    return list;
  }

  // ---- storage ------------------------------------------------------------
  function load() {
    if (store) return store;
    var id = activeId();
    var parsed = id ? readJSON(bucketKey(id), null) : null;
    store = (parsed && typeof parsed === 'object') ? parsed : { items: {}, decks: {} };
    if (!store.items) store.items = {};
    if (!store.decks) store.decks = {};
    return store;
  }

  function save() {
    var id = activeId();
    if (!id) return;   // nobody playing: nothing to write, and nothing to leak between kids
    try {
      global.localStorage.setItem(bucketKey(id), JSON.stringify(load()));
    } catch (e) {
      /* private mode / quota: games still work, progress just won't persist */
    }
  }

  function keyOf(deck, item) { return deck + '::' + item; }

  function entry(deck, item) {
    var s = load();
    var k = keyOf(deck, item);
    if (!s.items[k]) {
      s.items[k] = { d: deck, i: item, box: 0, right: 0, wrong: 0, seen: 0, due: 0, last: 0 };
    }
    return s.items[k];
  }

  // Read-only lookup: never creates an entry, for code that just inspects.
  var EMPTY = { d: '', i: '', box: 0, right: 0, wrong: 0, seen: 0, due: 0, last: 0 };
  function peek(deck, item) {
    return load().items[keyOf(deck, item)] || EMPTY;
  }

  function get(deck, item) { return entry(deck, item); }

  // Record one attempt. Returns the updated entry.
  function record(deck, item, correct) {
    var e = entry(deck, item);
    var t = now();
    e.seen += 1;
    e.last = t;
    if (correct) {
      e.right += 1;
      e.box = Math.min(MASTER_BOX, e.box + 1);
    } else {
      e.wrong += 1;
      e.box = 1;
    }
    e.due = t + (INTERVALS[e.box] || INTERVALS[1]);
    save();
    return e;
  }

  // Pick the next item from a pool: due review first, then something new,
  // then whatever comes due soonest. `exclude` skips items just shown.
  function pick(deck, pool, exclude) {
    if (!pool || !pool.length) return null;
    var skip = {};
    (exclude || []).forEach(function (i) { skip[i] = true; });
    var remaining = pool.filter(function (i) { return !skip[i]; });
    if (!remaining.length) remaining = pool.slice();

    var t = now();
    var list = remaining.map(function (i) {
      var e = peek(deck, i);
      return { i: i, seen: e.seen, due: e.due };
    });

    var due = list.filter(function (e) { return e.seen > 0 && e.due <= t; })
      .sort(function (a, b) { return a.due - b.due; });
    if (due.length) return due[0].i;

    var fresh = list.filter(function (e) { return e.seen === 0; });
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)].i;

    var upcoming = list.slice().sort(function (a, b) { return a.due - b.due; });
    return upcoming[0].i;
  }

  // ---- adaptive difficulty ----------------------------------------------
  // Four right in a row moves the level up, two misses in a row moves it
  // down. No settings screen; the kid never has to choose.
  function deckState(deck) {
    var s = load();
    if (!s.decks[deck]) s.decks[deck] = { level: 1, run: 0, miss: 0, answered: 0, correct: 0 };
    return s.decks[deck];
  }

  function level(deck) { return deckState(deck).level; }

  function setLevel(deck, n) {
    var d = deckState(deck);
    d.level = Math.max(1, n);
    d.run = 0;
    d.miss = 0;
    save();
    return d.level;
  }

  // Returns { level, changed, direction }. Games pass {allowUp:false} once the
  // kid has already moved a level this session, so one good run cannot vault
  // them from CVC words to blends.
  function adapt(deck, correct, maxLevel, opts) {
    var o = opts || {};
    var allowUp = o.allowUp !== false;
    var allowDown = o.allowDown !== false;
    var d = deckState(deck);
    var max = maxLevel || 99;
    d.answered += 1;
    if (correct) d.correct += 1;
    var changed = 0;

    if (correct) {
      d.run += 1;
      d.miss = 0;
      if (d.run >= 4 && d.level < max && allowUp) {
        d.level += 1;
        d.run = 0;
        changed = 1;
      }
    } else {
      d.miss += 1;
      d.run = 0;
      if (d.miss >= 2 && d.level > 1 && allowDown) {
        d.level -= 1;
        d.miss = 0;
        changed = -1;
      }
    }
    save();
    return { level: d.level, changed: changed, direction: changed };
  }

  // ---- reporting ---------------------------------------------------------
  function stats(deck, pool) {
    var items = pool || Object.keys(load().items).filter(function (k) {
      return load().items[k].d === deck;
    }).map(function (k) { return load().items[k].i; });

    var out = { mastered: 0, learning: 0, fresh: 0, total: items.length, tricky: [] };
    items.forEach(function (i) {
      var e = peek(deck, i);
      if (e.seen === 0) out.fresh += 1;
      else if (e.box >= MASTER_BOX) out.mastered += 1;
      else out.learning += 1;
      if (e.seen > 0 && e.box < MASTER_BOX && e.wrong > 0) {
        out.tricky.push({ item: i, wrong: e.wrong, right: e.right });
      }
    });
    out.tricky.sort(function (a, b) { return b.wrong - a.wrong; });
    return out;
  }

  function decks() {
    var s = load();
    var seen = {};
    Object.keys(s.items).forEach(function (k) { seen[s.items[k].d] = true; });
    Object.keys(s.decks).forEach(function (d) { seen[d] = true; });
    return Object.keys(seen);
  }

  function reset() {
    store = { items: {}, decks: {} };
    save();
  }

  // ---- session helper ----------------------------------------------------
  // Ends a session at a natural boundary instead of whenever the kid quits.
  function Session(opts) {
    this.limit = (opts && opts.limit) || 12;
    this.answered = 0;
    this.correct = 0;
    this.newItems = [];
    this.missed = [];
  }
  Session.prototype.track = function (item, correct, wasNew) {
    this.answered += 1;
    if (correct) this.correct += 1;
    else if (this.missed.indexOf(item) === -1) this.missed.push(item);
    if (wasNew && this.newItems.indexOf(item) === -1) this.newItems.push(item);
  };
  Session.prototype.done = function () { return this.answered >= this.limit; };

  global.Learn = {
    MASTER_BOX: MASTER_BOX,
    // players
    players: players,
    player: player,
    activeId: activeId,
    activePlayer: activePlayer,
    setActive: setActive,
    addPlayer: addPlayer,
    updatePlayer: updatePlayer,
    removePlayer: removePlayer,
    load: load,
    save: save,
    get: get,
    peek: peek,
    record: record,
    pick: pick,
    level: level,
    setLevel: setLevel,
    adapt: adapt,
    stats: stats,
    decks: decks,
    deckState: deckState,
    reset: reset,
    Session: Session
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
