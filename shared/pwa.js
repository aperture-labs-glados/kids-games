/* pwa.js — install the service worker and warm the cache.
 *
 * Included by every page. It resolves the site root from its own script URL, so
 * nothing here contains the repository name and nothing breaks if the site is
 * ever served from somewhere else.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var me = doc && doc.currentScript;
  if (!me || !me.src) return;

  var root = me.src.replace(/shared\/pwa\.js.*$/, '');
  if (!root) return;

  var WARM_KEY = 'kg.warmed';

  function register() {
    if (!('serviceWorker' in global.navigator)) return;
    try {
      global.navigator.serviceWorker.register(root + 'sw.js', { scope: root })
        .then(function (reg) {
          if (reg && reg.update) reg.update();
        })
        .catch(function () { /* file:// or a browser with SW blocked */ });
    } catch (e) { /* ignore */ }
  }

  // Pull every audio clip into the cache once, when the connection allows it.
  // That is what makes the site usable on a plane rather than merely installed.
  function warm() {
    if (!('caches' in global)) return;
    if (global.localStorage.getItem(WARM_KEY) === '1') return;
    if (!global.navigator.onLine) return;
    var c = global.navigator.connection;
    if (c && c.saveData) return;

    global.fetch(root + 'shared/audio/manifest.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (list) {
        if (!list || !list.files || !list.files.length) return;
        var queue = list.files.slice();
        var active = 0;
        var done = function () {
          active -= 1;
          if (!queue.length && active === 0) {
            try { global.localStorage.setItem(WARM_KEY, '1'); } catch (e) {}
            return;
          }
          next();
        };
        var next = function () {
          while (active < 4 && queue.length) {
            var path = queue.shift();
            active += 1;
            global.fetch(root + path, { cache: 'force-cache' })
              .then(function (r) { return r.ok ? r.blob() : null; })
              .then(done, done);
          }
        };
        next();
      })
      .catch(function () { /* offline or missing manifest: try again next visit */ });
  }

  if (doc.readyState === 'complete') {
    register();
    setTimeout(warm, 1200);
  } else {
    global.addEventListener('load', function () {
      register();
      setTimeout(warm, 1200);
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
