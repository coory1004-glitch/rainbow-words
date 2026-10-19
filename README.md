# Rainbow Words

A very easy English word game for a 5-year-old: play the worm, jump or balloon game, collect stars, and spend them dressing up a princess.

Open `index.html` through any web server. English lines are pre-recorded MP3 sprites in `audio/` (Kokoro-82M voice `af_heart`, Apache-2.0). Pictures in `img/` are Microsoft Fluent Emoji 3D (MIT).

## Code layout

Plain ES modules, no build step (see `docs/SPEC.md` for module contracts and file ownership):
`index.html` (shell) · `css/` (base, screens, play, closet) · `js/main.js` boots, `js/router.js` renders screens from `js/screens/`, canvas games live in `js/games/` on top of `js/engine.js`, progress is saved by `js/storage.js` (localStorage `rainbow-words-v1` + IndexedDB mirror) so stars, stickers and outfits survive reloads.

## Smoke test

```
python3 -m http.server 8810 --bind 127.0.0.1 &
node tests/smoke.mjs 8810
```
It plays every game to the end in headless Chromium (Playwright), buys a closet item, reloads, and checks that nothing was lost.
