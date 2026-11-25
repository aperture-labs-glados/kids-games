/* confetti.js — a burst of paper on the canvas, nothing else.
 * Confetti.burst() takes an optional {x, y, count}. Coordinates are viewport
 * pixels; the default is the middle of the screen. Silent no-op under
 * prefers-reduced-motion, and it never leaves a canvas lying around.
 */
(function (global) {
  'use strict';

  var COLORS = ['#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#ec4899', '#a855f7'];
  var canvas = null;
  var ctx = null;
  var parts = [];
  var raf = null;
  var dpr = 1;

  function doc() { return global.document; }

  function reduced() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.floor((global.innerWidth || 800) * dpr);
    canvas.height = Math.floor((global.innerHeight || 600) * dpr);
    canvas.style.width = (global.innerWidth || 800) + 'px';
    canvas.style.height = (global.innerHeight || 600) + 'px';
    if (ctx) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  }

  function ensure() {
    if (canvas) return true;
    if (!doc() || !doc().body) return false;
    canvas = doc().createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    doc().body.appendChild(canvas);
    ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) { canvas.remove(); canvas = null; return false; }
    resize();
    global.addEventListener('resize', resize);
    return true;
  }

  function spawn(x, y, count) {
    // wider fan so the burst reads as a burst on a narrow phone screen
    for (var i = 0; i < count; i++) {
      var angle = (-Math.PI / 2) + (Math.random() - 0.5) * 2.1;
      var speed = 5 + Math.random() * 8;
      parts.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 26,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.7),
        vy: Math.sin(angle) * speed,
        w: 7 + Math.random() * 8,
        h: 11 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        round: Math.random() < 0.25
      });
    }
  }

  function draw() {
    var w = global.innerWidth || 800;
    var h = global.innerHeight || 600;
    ctx.clearRect(0, 0, w, h);

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vy += 0.28;          // gravity
      p.vx *= 0.995;         // drag
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      if (p.y > h + 60 || p.x < -80 || p.x > w + 80) {
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
        // squash on the vertical axis so it reads as paper tumbling
        ctx.scale(1, 0.55 + Math.abs(Math.cos(p.rot)) * 0.55);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (parts.length) {
      raf = global.requestAnimationFrame(draw);
    } else {
      raf = null;
      ctx.clearRect(0, 0, w, h);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
      global.removeEventListener('resize', resize);
    }
  }

  // burst({x, y, count}) — a wrong type or a missing canvas just does nothing.
  function burst(opts) {
    if (reduced()) return false;
    var o = opts || {};
    if (!ensure()) return false;
    var x = typeof o.x === 'number' ? o.x : (global.innerWidth || 800) / 2;
    var y = typeof o.y === 'number' ? o.y : (global.innerHeight || 600) * 0.42;
    spawn(x, y, o.count || 85);
    if (!raf) raf = global.requestAnimationFrame(draw);
    return true;
  }

  // burstFrom(node) — fire from the middle of an element, for a landing hit.
  function burstFrom(node, count) {
    if (!node || !node.getBoundingClientRect) return burst({ count: count });
    var r = node.getBoundingClientRect();
    return burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: count });
  }

  global.Confetti = { burst: burst, burstFrom: burstFrom };
})(typeof globalThis !== 'undefined' ? globalThis : this);
