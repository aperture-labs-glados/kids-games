# Kids Games

Small reading, spelling and maths games for one or two children, hosted free on
GitHub Pages. Vanilla HTML/CSS/JS, no build step, no accounts, no analytics, no
network calls. Progress lives in `localStorage` on the device.

## Games

| Game | Skill | Status |
|---|---|---|
| Speak & Build | Spelling from speech, phonics levels 1-7 | live |
| Ten-Frame Fill | Making 10 and 20 | live |
| Fact Frenzy | Addition/subtraction to 20 | live |
| Sight Word Splat | Dolch sight words | planned |
| Rhyme & Swap | Word families | planned |
| Array Builder | Multiplication as area | planned |

## How the learning works

`shared/learn.js` is the whole engine. Every game records each attempt against
one item (a word, a fact) in a Leitner box:

- correct -> box up, longer rest before it appears again
- wrong -> back to box 1, returns inside the same session
- box 4 = mastered, a few days off

`Learn.pick()` serves due reviews before new items, so time goes where the child
is actually weak. `Learn.adapt()` moves the difficulty: three right in a row
levels up, two wrong in a row levels down. No settings screen for a parent to
guess at.

Feedback never just buzzes. A wrong answer shows the correct spelling, reads it
aloud, and requeues the word. No timers, no lives, no game over.

## Adding a game

1. `games/<name>/index.html`
2. Include `../../shared/style.css`, `learn.js`, `speech.js`, and `words.js` if
   it needs word lists.
3. Call `Learn.pick(deck, pool, exclude)` for the next item,
   `Learn.record(deck, item, correct)` on every attempt, and
   `Learn.adapt(deck, correct, maxLevel)` after it.
4. Add a card to the hub in `index.html`.

## Speech

`shared/speech.js` wraps the built-in browser voices, so there are no audio
files to ship. iOS Safari only allows speech that starts inside a tap: the games
call `Speak.unlock()` from their first button, which is why there is a start
screen. If the browser has no voices, the game says so instead of presenting
dead buttons.

## Deploying

Pushed to the `main` branch, GitHub Pages serves the repo root. `.nojekyll` keeps
Jekyll from eating files that start with an underscore.

Pages caches assets for 10 minutes, so bump the `?v=` on the `shared/` links when
you change a shared file, or a browser will keep running the old engine.

## Testing

`dev/` holds jsdom playthroughs that drive the real game headlessly. See
`dev/README.md`.
