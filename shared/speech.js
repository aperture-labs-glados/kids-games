/* speech.js — spoken prompts.
 *
 * Two sources, in order:
 *  1. A pre-recorded mp3 under shared/audio/words/<word>.mp3. Neural voices,
 *     recorded once at build time, identical on every device, and short words
 *     are actually intelligible. This is the good path.
 *  2. The browser's built-in voices, for anything without a file (sentences,
 *     new word lists, a missing clip).
 *
 * Two browser quirks are handled here because they break games silently:
 *  - iOS Safari ignores speak() and blocks play() unless the first call
 *    happens inside a tap, so games call Speak.unlock() from their first click.
 *  - getVoices() is empty until the voiceschanged event fires.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var synth = global.speechSynthesis;
  var voices = [];
  var unlocked = false;
  var chosen = null;
  var supported = !!synth && typeof global.SpeechSynthesisUtterance === 'function';
  var audio = {};   // url -> HTMLAudioElement

  // shared/ is wherever this script lives, so games can sit at any depth.
  var base = '';
  try {
    var self = doc && (doc.currentScript || doc.querySelector('script[src*="speech.js"]'));
    if (self && self.src) base = self.src.replace(/speech\.js(\?[^/]*)?$/, '');
  } catch (e) { base = ''; }

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
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
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

  // ---- recorded words -----------------------------------------------------
  // Bump AUDIO_VERSION whenever the clips are re-recorded: Pages caches assets
  // for ten minutes, and a voice swap at the same URL would otherwise sit
  // behind the old files.
  var AUDIO_VERSION = 2;

  function urlFor(w) {
    return base + 'audio/words/' + encodeURIComponent(String(w).toLowerCase()) +
      '.mp3?v=' + AUDIO_VERSION;
  }

  function element(url) {
    if (audio[url]) return audio[url];
    var a = new global.Audio();
    a.preload = 'auto';
    a.src = url;
    audio[url] = a;
    return a;
  }

  // Download the clips a session will need, so the first word is not silent
  // while a 4 KB file is in flight.
  function preload(words) {
    (words || []).forEach(function (w) {
      try { element(urlFor(w)).load(); } catch (e) {}
    });
  }

  // Play the recording. Returns true if it started; calls onFail otherwise
  // (missing file, decode error, autoplay block).
  //
  // A stale play() promise rejects with AbortError whenever the clip that
  // started it gets paused by the next request. That is not a broken file, so
  // it must not trigger the device voice - which is exactly the voice we are
  // trying to avoid. A generation counter drops any superseded attempt.
  var generation = 0;

  function playUrl(url, onFail) {
    if (!global.Audio) return false;
    var a;
    try { a = element(url); } catch (e) { return false; }

    var mine = ++generation;
    var settled = false;

    function fail(reason) {
      if (settled) return;
      settled = true;
      if (mine !== generation) return;      // a newer request owns the audio
      if (reason && reason.name === 'AbortError') return;
      if (onFail) onFail(reason);
    }

    a.onerror = function () { fail({ name: 'MediaError' }); };

    try { a.pause(); } catch (e) {}
    try { a.currentTime = 0; } catch (e) {}
    var p;
    try {
      p = a.play();
    } catch (e) {
      fail(e);
      return false;
    }
    if (p && p.catch) p.catch(fail);
    return true;
  }

  function playFile(w, onFail) { return playUrl(urlFor(w), onFail); }

  // A fixed spoken line, e.g. "how many more to make ten".
  function phrase(name, onFail) {
    return playUrl(base + 'audio/phrases/' + encodeURIComponent(name) + '.mp3?v=' + AUDIO_VERSION, onFail);
  }

  function hasRecording(w) { return !!audio[urlFor(w)]; }

  // ---- browser voices -----------------------------------------------------
  function cancel() {
    generation += 1;
    if (supported) { try { synth.cancel(); } catch (e) {} }
    var keys = Object.keys(audio);
    for (var i = 0; i < keys.length; i++) {
      try { audio[keys[i]].pause(); } catch (e) {}
    }
  }

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

  // The word to spell: recording first, voice second.
  function word(w, opts) {
    if (!w) return false;
    opts = opts || {};
    cancel();
    playFile(w, function () { say(w, { rate: opts.rate || 0.8 }); });
    return true;
  }

  function spell(w, opts) {
    return say(String(w || '').split('').join(', '), opts || { rate: 0.8 });
  }

  // Call once, synchronously, from the first user tap. iOS will not speak or
  // play audio until a gesture has unlocked it.
  function unlock() {
    if (unlocked) return supported;
    unlocked = true;
    if (supported) {
      try {
        var u = new global.SpeechSynthesisUtterance(' ');
        u.volume = 0;
        synth.speak(u);
      } catch (e) {}
      refresh();
    }
    // A silent play() inside the gesture also unlocks HTMLAudio on iOS.
    try {
      var probe = new global.Audio();
      probe.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiTi5DugBQAhQAAABAAEAAAA';
      var p = probe.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
    return supported;
  }

  global.Speak = {
    unlock: unlock,
    say: say,
    word: word,
    phrase: phrase,
    spell: spell,
    cancel: cancel,
    preload: preload,
    refresh: refresh,
    hasRecording: hasRecording,
    base: function () { return base; },
    hasVoice: function () { return supported && voices.length > 0; },
    isSupported: function () { return supported; },
    voiceName: function () { return chosen ? chosen.name : ''; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
