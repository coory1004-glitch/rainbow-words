# Rainbow Words — build spec (v2 quality pass)

A very easy English word game for a Korean 5-year-old girl who loves unicorns, cake, rainbow colours, pink princesses, Robocar Poli–style rescue cars and Halloween. She cannot read yet: everything important is **heard** (pre-recorded American English voice) and **seen** (pictures). Korean UI text is for the parent.

Live site: GitHub Pages, served as static files from the repo root (`index.html`). No build step. Plain **ES modules** (`<script type="module">`), relative paths only. Must run on iOS Safari 15+, iPadOS, Chrome Android, desktop Chrome/Safari.

## What this pass must deliver (the user's three asks)

1. **Quality "확" up.** The user called the current visuals cheap. Target: a premium kids' app (think Pinkfong / Khan Academy Kids / Toca Boca polish): consistent glossy 3D art, smooth animation, juicy feedback, clean typography, nothing that looks like a prototype.
2. **Words only.** When the game names a picture it says just the word ("swan"), never "It's …"/"That's …". Wrong tap → play the tapped word's clip, short pause, then the round prompt again. There are no "That's" clips any more.
3. **Rewards never reset.** Stars, stickers (collected words), owned outfits and what she wears must survive closing the tab, reloading, coming back days later. Only an explicit grown-up reset (behind a gate) may clear them.

## Art direction — "glossy candy storybook"

- All pictures are **Fluent 3D emoji** images (Microsoft, MIT) in `img/<name>.webp` (256×256, transparent). Never render a system emoji glyph anywhere in the UI or canvases (they differ per device and look cheap next to the 3D art). Available names: see `ls img/`. If you need one that is missing, report it; do not fall back to a text emoji.
- Colour words (brown, black, white, gray, gold, silver, sky blue, navy) are drawn as **glossy 3D hearts** (radial/linear gradient body, soft inner shade, white specular highlight, subtle darker outline) so they sit naturally next to the Fluent art. Gold/silver look metallic.
- Palette: pastel rainbow on light backgrounds; pink-lilac default (`#ffe0f1 → #e4dcff`); Halloween world is a deep purple night. Soft shadows, rounded chunky shapes, white highlights, gentle gradients. Toy-like "squishy" buttons (thick border + bottom shadow that presses down).
- Type: **Fredoka** (600/700) for English, **Jua** for Korean, loaded from Google Fonts with system fallbacks. English words shown big in rainbow letters (each letter a rainbow colour with a white outline).
- Motion: spring/back easing, small idle bobs, burst particles on success. Respect `prefers-reduced-motion`.
- Layout: phone portrait (390×844) first, also tablet (1024×768 and 768×1024) and desktop. 16px min side gutter with `env(safe-area-inset-*)`. No horizontal scroll. Touch targets ≥ 56px for the child.

## File layout and ownership

Each builder owns specific files and edits **only** those. If you need something from another module that its contract below does not give you, do not edit that file — write the request in your final report.

| Owner | Files |
|---|---|
| ui | `index.html`, `manifest.webmanifest`, `css/base.css`, `css/screens.css`, `js/main.js`, `js/router.js`, `js/data.js`, `js/session.js`, `js/screens/home.js`, `js/screens/pick.js`, `js/screens/intro.js`, `js/screens/result.js`, `js/screens/book.js`, `js/screens/parent.js` |
| engine | `js/engine.js`, `js/fx.js`, `js/images.js`, `js/screens/play.js`, `css/play.css` |
| art | `js/art.js`, `js/screens/closet.js`, `css/closet.css` |
| worm | `js/games/worm.js` |
| jump | `js/games/jump.js` |
| balloon | `js/games/balloon.js` |
| core | `js/state.js`, `js/storage.js`, `js/audio.js` |
| (generated, do not edit) | `js/voice-index.js`, `audio/*.mp3`, `img/*.webp` |

`index.html` links every css file: `css/base.css`, `css/screens.css`, `css/play.css`, `css/closet.css`.

## Module contracts (exported names and signatures are frozen; you may ADD exports)

### js/state.js
```js
export const ROUNDS = 8;                 // questions per game
export const store = {
  S: { screen:'home', game:'worm', ses:null, cat:'dress' },  // view/session state, not persisted
  P: null,                                                     // persistent progress, set by storage.load()
};
```
`store.S.ses` = `{ id, world, game, words:[{w:worldId, i:index}] (5), intro:0, stars:0, bonus:0, newStickers:[key] }`.

### js/data.js (read-only data)
- `RAINBOW` (7 letter colours), `PASTEL` (7 soft colours).
- `WORLDS`: `[{ id, ko, en, icon:'<img name>', tile:{face,edge,shade,ink?,prog?}, color?:true, words:[[en, pic, ko], …] }]`. `pic` is an image name (`'dragon'`) or, in the colour world, a hex or `'#hi,#lo'` metallic pair.
- `byId`, `TOTAL` (47).
- `wordOf(wid, i)` → `{ en, pic, ko, color:bool, key:'wid:en', img:'img/<pic>.webp' | null }`.
- `GAMES_META`: `[{ id:'worm'|'jump'|'balloon', ko, en, sub, icon:'<img name>', face, edge, shade }]`.
- `PROMPTS[game]` = `{ verb, say(w) }` → `'Go get the dragon!'`, `'Jump for the dragon!'`, `'Pop the dragon!'` (colour world: `'… the white one!'`).
- `PRAISE` = `['Great job!','Yay!','You did it!','Wonderful!','Super!','Hooray!']`.
- `SHOP`: `[{ id:cat, ko, icon:'<img name>', items:[[id, ko, en, price], …] }]` for cats `dress, hat, hair, wings, hand, pet, bg` (ids as today).
- `PET_IMG` = `{ kitten:'kitten', puppy:'puppy', bunny:'bunny', unicorn:'unicorn', dragon:'dragon' }`, `DEF_WEAR`.

### js/storage.js (core)
```js
export function load()                 // sync. Reads saved progress, migrates, sets and returns store.P. Never throws.
export function save()                 // sync write to localStorage + async mirror to IndexedDB. Stamps P.updatedAt.
export function requestPersist()       // navigator.storage.persist() once, after a user gesture; safe to call often
export function onRestored(cb)         // cb() if a newer copy (IndexedDB) replaces store.P after boot → caller re-renders
export function exportCode()           // string code a parent can copy, e.g. 'RW1-…' (base64url JSON + checksum)
export function importCode(text)       // → { ok:true } | { ok:false, error:'<Korean message>' }; on ok replaces + saves P
export function resetProgress()        // clears to defaults and saves (only the parent screen calls this)
export function countGot(W), gotTotal(), itemOf(cid, id), owns(cid, id)
```
`P` = `{ v:2, stars, got:{key:1}, owned:{'cat:id':1}, wear:{dress,hat,hair,wings,hand,pet,bg}, settings:{ music:true, sfx:true }, stats:{ games:0, firstPlayed, lastPlayed }, updatedAt }`.
Keep reading the existing localStorage key **`rainbow-words-v1`** (players already have progress there) and keep writing it. Unknown fields are preserved. Corrupt data never wipes progress silently: keep the last good copy (`rainbow-words-v1.bak`).

### js/audio.js (core)
```js
export function audio()                         // shared AudioContext (24 kHz preferred), resumes on gesture
export const sfx                                // pop, yay, boop, jump, fanfare (+ any you add: tap, land, sparkle, sticker, buy, whoosh, coin)
export function say(parts, { queue=false }={})  // string | string[] → Promise; plays clips from js/voice-index.js via audio/<sprite>.mp3
export function stopVoice()
export function loadSprite(name), preload(names)
export function setMusic(on), isMusicOn(), musicScene(kind)   // kind: 'menu' | 'game' | 'off'
export function setSfx(on), isSfxOn()
```
Callers outside core only use the five baseline `sfx` names directly; for any other name use `sfx.name?.()`. Voice keys: `vkey(text)` = lowercase, non-alphanumerics → single space, trimmed. Every line the game says must exist in `VO`; the device voice is a last-resort fallback only.

### js/images.js (engine)
```js
export function imgSrc(name)                 // 'img/<name>.webp'
export function picHTML(w, cls='')           // <img class="pic …"> for a word, or the glossy heart SVG for a colour word
export function iconHTML(name, cls='')       // <img> for any img/ name (UI icons, pets, game icons)
export function getImage(name)               // cached HTMLImageElement for canvas use
export function preloadImages(names)
export function drawPic(ctx, w, x, y, size)  // canvas: Fluent image or glossy heart, centred at x,y
```

### js/fx.js (engine)
```js
export function burst(x, y, n), burstAt(el, n), wiggle(el), shake(el), toast(msg)
export function flyStarXY(x, y, onArrive?)   // a star flies from viewport point to #sesStars
```

### js/art.js (art)
```js
export function avatarSVG(wear, { standalone=false, pose='idle' }={})  // pose: 'idle' | 'cheer' | 'jump'
export function sceneSVG(bgId, uid)
export function stageHTML(extra='', cls='', wear=store.P.wear)        // princess on her background + pet
export function thumbHTML(cid, id)                                    // closet item thumbnail
export function avatarImage(pose='idle')                              // HTMLImageElement for canvases, cached per wear+pose
```

### js/router.js (ui)
```js
export const app                                   // #app element
export function registerScreen(name, { html(), mount?(later), unmount?() })
export function registerActions(map)               // data-act="name" click handlers: (el, event) => void
export function render({ keepScroll }={})
export function go(screen, opts)                   // sets store.S.screen and renders
```
`later(fn, ms)` passed to `mount` only fires if no newer render happened.

### js/session.js (ui)
`buildSession(wid, game)`, `startSession(wid)`, `sw(k)` (word of session index k).

### js/engine.js + js/screens/play.js (engine)
```js
export const G                                   // runtime: on, W, H, U, dpr, t, round, target, items, done, hint, …
export function registerGame(id, impl)
export function startGame(), stopGame()
export function gotIt(x, y), oops(j)             // canvas coords; oops says the tapped WORD only, then the prompt
export function pickSet(n)
export const PAL; export function pal()
export function skyFill(ctx), dots(ctx), cloudC(ctx, x, y, s), drawBubble(ctx, item, glow), drawPop(ctx, item, x, y), easeBack(t)
```
Game modules: `registerGame(id, { init(), resize(), round(), press(x, y), update(dt), draw(ctx), testHint() })`.
`testHint()` → `{ action:'move'|'tap'|'press', x, y }` in canvas CSS pixels for the current target (or `null`), used only by automated tests: `move` = move the pointer there (worm), `tap` = click there (balloon), `press` = press Space now (jump, return it only at the right moment).

## Behaviour that must stay (proved by tests)
- Home → pick game → pick world (5 worlds + mix) → intro (5 new words, tap letters to hear letter names) → game of `ROUNDS` questions → result → closet / again / home.
- Each correct answer: +1 star, word becomes a collected sticker. Finishing a game: +2 bonus stars. All saved immediately.
- Closet: categories, buy with stars, wear owned items; tapping an item says its English name.
- Sticker book: 47 words grouped by world, locked ones as silhouettes.
- Worm speed ≥ the current `U * 4.2` px/s (the user asked for faster); worm never dies.

## Testing (every builder)
- Serve: `python3 -m http.server <PORT> --bind 127.0.0.1` from the repo root, in the background. Use your own port (ui 8801, engine 8802, art 8803, worm 8804, jump 8805, balloon 8806, core 8807, integration 8810–8819).
- Playwright: `import { createRequire } from 'module'; const require = createRequire('/opt/node22/lib/node_modules/'); const { chromium } = require('playwright');` then `chromium.launch()`. Put scripts and screenshots in your scratchpad, not the repo.
- Reach module state from a test with `page.evaluate(async () => { const m = await import('/js/engine.js'); … })` (same module instance as the app).
- Look at your screenshots (Read the PNG) at 390×844 and 1024×768 and fix what looks off. Zero console errors.
- `tests/smoke.mjs` (written in phase 1) runs the full flow; keep it passing for your area.
- Do not git commit or push. Do not edit files you do not own.
