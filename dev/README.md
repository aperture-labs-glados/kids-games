# dev

Headless playthroughs, not part of the site. They drive the real page with
jsdom and a stubbed `speechSynthesis`, so a change to `shared/learn.js` cannot
quietly break a game.

```bash
# 1. serve the site locally
python3 -m http.server 8099

# 2. in another shell, install jsdom once
npm install jsdom

# 3. run
node dev/play.js      # full session: hint, correct answer, wrong answer, summary, grown-up page
node dev/persist.js   # level and item state survive a reload
```

Both expect the server on `http://127.0.0.1:8099`. `play.js` reads the spoken
word out of the stubbed synth, types it into the tiles, and asserts on the
feedback text and the stored progress.

## When you change a shared file

GitHub Pages caches assets for 10 minutes, so a parent's browser will happily
run yesterday's `learn.js`. Bump the `?v=` on every `shared/` link (hub,
game, grown-up page) when shipping a change to `shared/`, then reload twice.
