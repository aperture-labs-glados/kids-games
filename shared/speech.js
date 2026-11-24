/* speech.js — spoken prompts with no audio files.
 * Uses the browser's built-in voices. Two things break in practice:
 *  - iOS Safari ignores speak() unless the first call happens inside a tap,
 *    so games must call Speak.unlock() from their first click handler.
 *  - getVoices() is empty until the voiceschanged event fires.
 * If no voices exist at all, hasVoice() stays false and games fall back to
 * showing the word instead of hiding it behind audio.
 */
(function (global) {
  'use strict';

  var synth = global.speechSynthesis;
  var voices = [];
  var unlocked = false;
  var chosen = null;
  var supported = !!synth && typeof global.SpeechSynthesisUtterance === 'function';

  var PREFERRED = [
    'samantha', 'karen', 'moira', 'tessa', 'google us english',
    'microsoft aria', 'microsoft zira', 'microsoft jenny', 'english'
  ];

  function pickVoice() {
    if (!voices.length) return;
    var en = voices.filter(function (v) { return /^en/i.test(v.lang); });
    var pool = en.length ? en : voices;
    for (var i = 0; i < PREFERRED.length; i++) {
      var hit = pool.filter(function (v) {
        return v.name.toLowerCase().indexOf(PREFERRED[i]) !== -1;
      })[0];
      if (hit) { chosen = hit; return; }
    }
    var local = pool.filter(function (v) { return v.localService; })[0];
    chosen = local || pool[0];
  }

  function refresh() {
    if (!supported) return;
    try {
      voices = synth.getVoices() || [];
    } catch (e) {
      voices = [];
    }
    pickVoice();
  }

  if (supported) {
    refresh();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refresh);
    } else {
      synth.onvoiceschanged = refresh;
    }
  }

  // Call once, synchronously, from the first user tap. On iOS this is the
  // difference between speech working and silently doing nothing.
  function unlock() {
    if (!supported || unlocked) return supported;
    try {
      var u = new global.SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.rate = 1;
      synth.speak(u);
      unlocked = true;
    } catch (e) { /* fall through, hasVoice() guards the game */ }
    refresh();
    return supported;
  }

  function cancel() {
    if (supported) { try { synth.cancel(); } catch (e) {} }
  }

  // say(text, {rate, pitch}) -> true if it was handed to the browser.
  function say(text, opts) {
    if (!supported || !text) return false;
    opts = opts || {};
    try {
      synth.cancel();
      var u = new global.SpeechSynthesisUtterance(String(text));
      if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
      u.rate = opts.rate || 0.85;
      u.pitch = opts.pitch || 1;
      u.volume = 1;
      synth.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  function spell(word, opts) {
    if (!supported || !word) return false;
    return say(String(word).split('').join(', '), opts || { rate: 0.8 });
  }

  global.Speak = {
    unlock: unlock,
    say: say,
    spell: spell,
    cancel: cancel,
    refresh: refresh,
    hasVoice: function () { return supported && voices.length > 0; },
    isSupported: function () { return supported; },
    voiceName: function () { return chosen ? chosen.name : ''; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
