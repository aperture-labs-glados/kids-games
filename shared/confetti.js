/* confetti.js — paper falling from the top of the screen.
 *
 * Confetti.rain(90) drops a curtain from above the top edge; Confetti.burst()
 * fires from a point if a game ever wants that instead. Coordinates are
 * viewport pixels. Silent no-op under prefers-reduced-motion, and the canvas
 * removes itself once the last piece has landed.
 *
 * The physics are time-based, not per-frame: a stalled frame (loading the next
 * audio clip, say) moves the pieces by the elapsed time instead of freezing
 * them in mid-air. The step is clamped so a long tab-switch does not teleport
 * them off screen.
 */
(function (global) {
  'use strict';

  var COLORS = ['#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#ec4899',
    '#a855f7', '#ef4444', '#14b8a6'];
  var GRAVITY = 0.30;      // per 60fps frame
  var MAX_STEP = 8;        // frames of catch-up allowed after a stall

  var canvas = null;
  var ctx = null;
  var parts = [];
  var raf = null;
  var dpr = 1;
  var lastTs = 0;

  function doc() { return global.document; }

  function reduced() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function viewport() {
    return { w: global.innerWidth || 800, h: global.innerHeight || 600 };
  }

  function resize() {
    if (!canvas) return;
    var v = viewport();
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(v.w * dpr);
    canvas.height = Math.floor(v.h * dpr);
    canvas.style.width = v.w + 'px';
    canvas.style.height = v.h + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ensure() {
    if (canvas) return true;
    if (!doc() || !doc().body) return false;
    canvas = doc().createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    doc().body.appendChild(canvas);
    ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      return false;
    }
    resize();
    global.addEventListener('resize', resize);
    return true;
  }

  function piece(x, y, vx, vy) {
    return {
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      w: 7 + Math.random() * 8,
      h: 11 + Math.random() * 10,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.34,
      sway: Math.random() * Math.PI * 2,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      round: Math.random() < 0.22
    };
  }

  // A curtain from above the top edge, spread across the full width.
  function rain(count) {
    var v = viewport();
    for (var i = 0; i < count; i++) {
      parts.push(piece(
        Math.random() * v.w,
        -30 - Math.random() * 120,
        (Math.random() - 0.5) * 2.4,
        1.2 + Math.random() * 2.6
      ));
    }
  }

  // A cannon from one point, for an element-anchored hit.
  function cannon(x, y, count) {
    for (var i = 0; i < count; i++) {
      var angle = (-Math.PI / 2) + (Math.random() - 0.5) * 2.1;
      var speed = 5 + Math.random() * 8;
      parts.push(piece(
        x + (Math.random() - 0.5) * 60,
        y + (Math.random() - 0.5) * 26,
        Math.cos(angle) * speed * (0.55 + Math.random() * 0.7),
        Math.sin(angle) * speed
      ));
    }
  }

  function draw(ts) {
    var v = viewport();
    var now = typeof ts === 'number' ? ts
      : (global.performance ? global.performance.now() : Date.now());
    var step = lastTs ? (now - lastTs) / 16.667 : 1;
    if (step > MAX_STEP) step = MAX_STEP;
    if (step <= 0) step = 1;
    lastTs = now;

    ctx.clearRect(0, 0, v.w, v.h);

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vy += GRAVITY * step;
      p.sway += 0.08 * step;
      p.x += (p.vx + Math.sin(p.sway) * 0.7) * step;
      p.y += p.vy * step;
      p.rot += p.vr * step;

      if (p.y > v.h + 60 || p.x < -100 || p.x > v.w + 100) {
        parts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // squash on one axis so it reads as paper tumbling
        ctx.scale(1, 0.55 + Math.abs(Math.cos(p.rot)) * 0.55);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (parts.length) {
      raf = global.requestAnimationFrame(draw);
    } else {
      raf = null;
      lastTs = 0;
      ctx.clearRect(0, 0, v.w, v.h);
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
      global.removeEventListener('resize', resize);
    }
  }

  function start() {
    if (!raf) raf = global.requestAnimationFrame(draw);
  }

  // Confetti.rain() — the default celebration: from the top, falling down.
  function down(count) {
    if (reduced()) return false;
    if (!ensure()) return false;
    rain(typeof count === 'number' ? count : 90);
    start();
    return true;
  }

  // burst({x, y, count}) — a cannon from a point, or the middle of the screen.
  function burst(opts) {
    if (reduced()) return false;
    var o = opts || {};
    if (!ensure()) return false;
    var v = viewport();
    var x = typeof o.x === 'number' ? o.x : v.w / 2;
    var y = typeof o.y === 'number' ? o.y : v.h * 0.42;
    cannon(x, y, o.count || 85);
    start();
    return true;
  }

  function burstFrom(node, count) {
    if (!node || !node.getBoundingClientRect) return burst({ count: count });
    var r = node.getBoundingClientRect();
    return burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: count });
  }

  global.Confetti = {
    rain: down,
    burst: burst,
    burstFrom: burstFrom,
    running: function () { return !!raf; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
