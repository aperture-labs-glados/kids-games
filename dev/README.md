# dev

Headless playthroughs, not part of the site. They drive the real page with
jsdom and a stubbed `speechSynthesis`, so a change to `shared/learn.js` cannot
quietly break a game.

```bash
# 1. serve the site locally
python3 -m http.server 8099

# 2. in another shell, install the two test deps once
npm install jsdom @napi-rs/canvas

# 3. run
node dev/decks-test.js     # every pool parses, every answer reachable, four choices always possible
node dev/play.js           # spelling: hint, right, wrong, summary, grown-up page
node dev/persist.js        # level and item state survive a reload
node dev/ten-frame.js      # maths: right, wrong reveal, fanfare notes, summary
node dev/fact-frenzy.js    # maths: right, wrong, counter hint, summary
node dev/later-games.js    # sight words, rhyme swap, array builder in one run
node dev/profiles.js       # first-run setup, switching, isolation, migration, the guard
node dev/final-games.js    # number line, finish the sentence, sticker shelf
node dev/confetti-test.js  # renders the canvas and measures where the paper is
```

`confetti-test.js` needs `@napi-rs/canvas` (node-canvas has no build for Node 26).
It drives `requestAnimationFrame` by hand and reads pixels: paper appears at the
top, falls, survives a 200ms stall, and the canvas removes itself.

Both expect the server on `http://127.0.0.1:8099`. `play.js` reads the spoken
word out of the stubbed synth, types it into the tiles, and asserts on the
feedback text and the stored progress.

## When you change a shared file

GitHub Pages caches assets for 10 minutes, so a parent's browser will happily
run yesterday's `learn.js`. Bump the `?v=` on every `shared/` link (hub,
game, grown-up page) when shipping a change to `shared/`, then reload twice.
