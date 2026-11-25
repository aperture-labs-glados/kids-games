/* sw.js — offline shell for the kids' games.
 *
 * Strategy, deliberately different per request type:
 *  - navigations: network first, so a deploy shows up on the next visit, with
 *    the cached page (and then the hub) as the offline fallback.
 *  - everything else: cache first, network fill. Versioned URLs (?v=N) are the
 *    cache key, so bumping a version is how a file gets replaced.
 *
 * Audio is not precached here; shared/pwa.js warms it once the page is idle, so
 * installing the app does not download 900 KB the parent did not ask for.
 */
'use strict';

var CACHE = 'kg-v1';

var SHELL = [
  './',
  './index.html',
  './grown-up.html',
  './404.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // add one at a time: a single 404 must not abort the whole install
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        return n === CACHE ? null : caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function sameOrigin(url) {
  try { return new URL(url, self.location.href).origin === self.location.origin; }
  catch (e) { return false; }
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (!sameOrigin(req.url)) return;

  // pages: try the network, fall back to whatever we have, then the hub
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // assets: cache first, fill on the way through
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
