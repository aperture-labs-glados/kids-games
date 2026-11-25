/* sound.js — short synthesised cues, so there is no file to download.
 *
 * A fanfare that plays the instant an answer is right: a soft rising arpeggio,
 * half a second, peak gain well under speech. Generated with Web Audio, which
 * means no fetch, no decode and nothing to stall the confetti.
 *
 * iOS blocks audio until a gesture, so games call Sound.unlock() from their
 * first button, the same place they call Speak.unlock().
 */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function context() {
    if (ctx) return ctx;
    var K = global.AudioContext || global.webkitAudioContext;
    if (!K) return null;
    try {
      ctx = new K();
    } catch (e) {
      return null;
    }
    return ctx;
  }

  function unlock() {
    var c = context();
    if (!c) return false;
    if (c.state === 'suspended') {
      try { c.resume(); } catch (e) { /* stays suspended; fanfare no-ops */ }
    }
    return c.state === 'running';
  }

  function note(c, freq, at, dur, peak, type) {
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // C5 E5 G5, then a soft C6 over G5. Total 0.6s, quiet enough to talk over.
  function fanfare() {
    if (!enabled) return false;
    var c = context();
    if (!c) return false;
    if (c.state === 'suspended') {
      try { c.resume(); } catch (e) {}
    }
    var t = c.currentTime + 0.02;
    note(c, 523.25, t,         0.18, 0.075);
    note(c, 659.25, t + 0.085, 0.18, 0.075);
    note(c, 783.99, t + 0.170, 0.26, 0.085);
    note(c, 1046.50, t + 0.270, 0.30, 0.050, 'sine');
    note(c, 783.99, t + 0.270, 0.30, 0.045);
    return true;
  }

  // A single low blip, for a near miss. Unused so far, kept for the next game.
  function nudge() {
    if (!enabled) return false;
    var c = context();
    if (!c) return false;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    var t = c.currentTime + 0.01;
    note(c, 220, t, 0.18, 0.06, 'sine');
    return true;
  }

  global.Sound = {
    unlock: unlock,
    fanfare: fanfare,
    nudge: nudge,
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    available: function () { return !!context(); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
