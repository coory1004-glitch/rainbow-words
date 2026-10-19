// engine.js (owner: engine) — shared canvas game runtime: rounds, scoring, input, drawing helpers.
// Game modules call registerGame(id, { init(), resize(), round(), press(x, y), update(dt), draw(ctx), testHint(),
//   move?(x, y, e), key?(e) → true if handled }).
//
// Round flow (all voice lines exist in js/voice-index.js):
//   start   → "Ready, set, go!" overlay (G.done stays true, input ignored) → first prompt
//   gotIt   → +1 star (saved at once), sticker, word-reveal banner + [praise, word] (+ "New sticker!" the first time)
//   oops(j) → the tapped WORD only, short pause, the prompt again; the target starts glowing (G.hint)
//   ~8 s    → "Listen!" + the prompt, target glows (G.hint)
//   finish  → "Bonus stars!" (+2, saved at once) → result screen
//
// Drawing helpers (canvas CSS pixels; everything expensive is cached as sprites, no per-frame allocation):
//   skyFill(c)                 world sky (gradient, soft light, bokeh; Halloween: moon + stars), cached per size/world
//   dots(c)                    polka-dot overlay, cached per size/world
//   cloudC(c, x, y, s)         glossy puffy cloud, same footprint as before (x-.5s … x+1.65s, y-.9s … y+.5s)
//   drawBubble(c, it, glow)    glossy white bubble (rainbow rim RAINBOW[it.k%7], rim light, soft shadow, highlight)
//                              with the word picture sw(it.j); uses it.x, it.y, it.r, it.s (0..1 grow), it.ph (bob phase)
//   drawPop(c, it, x?, y?)     sparkle ring while it.pop goes 1 → 0
//   drawGlow(c, x, y, r)       ADDED: pulsing golden halo (what drawBubble uses for glow)
//   drawTwinkle(c, x, y, r, color?) ADDED: four-point sparkle
//   easeBack(t), pickSet(n), PAL, pal()
// Other added exports: GAMES, currentGame(), testHint(), promptText(), revealing() (true while a banner shows).
import { store, ROUNDS, REDUCED_MOTION } from './state.js';
import { PROMPTS, PRAISE, RAINBOW, TAU, shuffle, range, pickOne } from './data.js';
import { save } from './storage.js';
import { say, sfx } from './audio.js';
import { burst, flyStarXY, wiggle, shake } from './fx.js';
import { drawPic, picHTML, imgSrc, preloadWords } from './images.js';
import { sw } from './session.js';
import { app, go, letters } from './router.js';

export const G = { on:false };
export const GAMES = {};
export function registerGame(id, impl){ GAMES[id] = impl; }
export const currentGame = () => (G.type ? GAMES[G.type] : null);
// automated tests only: what to do now to hit the current target (canvas CSS px), or null
export function testHint(){ const g = currentGame(); return G.on && !G.paused && g && g.testHint ? g.testHint() : null; }

export const PAL = {
  home:{ sky:['#ffe0f1','#e4dcff'], dot:'rgba(255,255,255,.6)', ground:'#a8e9bf', ground2:'#7fd6a0', hill:'#d4f4de', cloud:'#ffffff' },
  unicorn:{ sky:['#ffd6ee','#e8d8ff'], dot:'rgba(255,255,255,.6)', ground:'#b9f0c8', ground2:'#8fe0a8', hill:'#ffd0ea', cloud:'#ffffff' },
  sweets:{ sky:['#fff0d8','#ffd6e4'], dot:'rgba(255,255,255,.6)', ground:'#ffc2d6', ground2:'#ff9fbf', hill:'#ffe3b8', cloud:'#ffffff' },
  colors:{ sky:['#fff6c4','#d6efff'], dot:'rgba(255,255,255,.65)', ground:'#a7e8b0', ground2:'#7fd690', hill:'#ffe9a8', cloud:'#ffffff' },
  cars:{ sky:['#c6ebff','#e4fae2'], dot:'rgba(255,255,255,.6)', ground:'#8e93a6', ground2:'#6f7488', hill:'#bfe8b0', cloud:'#ffffff', road:true },
  halloween:{ sky:['#24133f','#56307f'], dot:'rgba(255,236,190,.3)', ground:'#3b2a55', ground2:'#2a1d40', hill:'#4a2f70', cloud:'rgba(255,255,255,.12)', moon:true },
};
export const pal = () => PAL[store.S.ses && store.S.ses.world] || PAL.home;

export const easeBack = t => { const s = 1.7; t -= 1; return 1 + t * t * ((s + 1) * t + s); };

/* ---------- sprite cache ---------- */
const sprites = new Map();
function sprite(key, w, h, paint){
  let s = sprites.get(key);
  if (s) return s;
  if (sprites.size > 80) sprites.clear();
  const dpr = G.dpr || 1, cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr));
  const c = cv.getContext('2d'); c.scale(dpr, dpr); paint(c, w, h);
  s = cv; sprites.set(key, s);
  return s;
}
const hex2rgb = h => { h = h.replace('#', ''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const tint = (hex, t, to = 255) => { const c = hex2rgb(hex).map(v => Math.round(v + (to - v) * t)); return `rgb(${c[0]},${c[1]},${c[2]})`; };
// parse '#rgb/#rrggbb' or 'rgba(r,g,b,a)' → { rgb:[r,g,b], a }
function parseColor(s){
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) { const p = m[1].split(',').map(Number); return { rgb:p.slice(0, 3), a:p[3] == null ? 1 : p[3] }; }
  let h = s.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join('');
  return { rgb:hex2rgb(h), a:1 };
}

/* ---------- bubble ---------- */
// base layer (shadow, body, rim) and gloss layer (drawn over the picture), per radius + rim colour
function bubbleBase(r, k){
  const col = RAINBOW[k], pad = r * .35, D = r * 2 + pad * 2;
  return sprite(`bb|${r}|${k}|${G.dpr}`, D, D + r * .3, (c) => {
    const x = D / 2, y = D / 2;
    // soft contact shadow
    let g = c.createRadialGradient(x, y + r * .98, 0, x, y + r * .98, r * .8);
    g.addColorStop(0, 'rgba(60,30,90,.22)'); g.addColorStop(1, 'rgba(60,30,90,0)');
    c.save(); c.translate(x, y + r * .98); c.scale(1, .26); c.translate(-x, -(y + r * .98));
    c.fillStyle = g; c.beginPath(); c.arc(x, y + r * .98, r * .8, 0, TAU); c.fill(); c.restore();
    // coloured rim: lighter on top, deeper underneath
    g = c.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, tint(col, .45)); g.addColorStop(.5, col); g.addColorStop(1, tint(col, .28, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    // pearly white body
    const ri = r * .87;
    g = c.createRadialGradient(x - ri * .3, y - ri * .38, ri * .1, x, y, ri);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.62, '#ffffff'); g.addColorStop(1, tint(col, .82));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, ri, 0, TAU); c.fill();
    // inner rim shade so the body sits inside the ring
    c.lineWidth = r * .05; c.strokeStyle = 'rgba(74,43,94,.10)';
    c.beginPath(); c.arc(x, y + r * .02, ri - r * .02, 0, TAU); c.stroke();
    // white rim light on the ring's top edge
    c.lineWidth = r * .035; c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y, r * .955, Math.PI * 1.12, Math.PI * 1.62); c.stroke();
  });
}
function bubbleGloss(r){
  const D = r * 2;
  return sprite(`bg|${r}|${G.dpr}`, D, D, (c) => {
    const x = r, y = r, ri = r * .87;
    c.save(); c.translate(x - ri * .38, y - ri * .5); c.rotate(-.55);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, ri * .42);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.55, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.scale(1, .5); c.fillStyle = g; c.beginPath(); c.arc(0, 0, ri * .42, 0, TAU); c.fill(); c.restore();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(x - ri * .02, y - ri * .66, ri * .055, 0, TAU); c.fill();
    // bottom reflected light
    c.lineWidth = r * .045; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.55)';
    c.beginPath(); c.arc(x, y, ri * .84, Math.PI * .2, Math.PI * .52); c.stroke();
  });
}
function glowSprite(r){
  const D = r * 2;
  return sprite(`gl|${r}|${G.dpr}`, D, D, (c) => {
    const g = c.createRadialGradient(r, r, r * .45, r, r, r);
    g.addColorStop(0, 'rgba(255,214,70,.95)'); g.addColorStop(.5, 'rgba(255,200,60,.45)'); g.addColorStop(1, 'rgba(255,190,60,0)');
    c.fillStyle = g; c.beginPath(); c.arc(r, r, r, 0, TAU); c.fill();
  });
}
// four-point sparkle
export function drawTwinkle(c, x, y, r, color = '#fff'){
  const q = r * .18;
  c.fillStyle = color; c.beginPath();
  c.moveTo(x, y - r); c.quadraticCurveTo(x + q, y - q, x + r, y); c.quadraticCurveTo(x + q, y + q, x, y + r);
  c.quadraticCurveTo(x - q, y + q, x - r, y); c.quadraticCurveTo(x - q, y - q, x, y - r); c.fill();
}
// pulsing golden halo behind a target of radius r
export function drawGlow(c, x, y, r){
  const p = (Math.sin(G.t * 6) + 1) / 2, R = Math.round(r * 1.6), gs = glowSprite(R);
  const sz = R * 2 * (1 + p * .12);
  c.globalAlpha = .65 + .35 * p; c.drawImage(gs, x - sz / 2, y - sz / 2, sz, sz); c.globalAlpha = 1;
  for (let i = 0; i < 3; i++) {
    const a = G.t * 1.6 + i * TAU / 3, d = r * 1.22;
    drawTwinkle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (.13 + .06 * Math.sin(G.t * 5 + i * 2)), '#fff7c2');
  }
}
export function drawBubble(c, it, glow){
  const s = easeBack(Math.min(1, it.s == null ? 1 : it.s));
  const x = it.x, y = it.y + Math.sin(G.t * 2.2 + (it.ph || 0)) * G.U * .08, R = Math.max(4, Math.round(it.r)), r = it.r * s;
  if (r <= 1) return;
  if (glow) drawGlow(c, x, y, r);
  const k = ((it.k || 0) % 7 + 7) % 7, base = bubbleBase(R, k), f = r / R;
  const bw = base.width / (G.dpr || 1) * f, bh = base.height / (G.dpr || 1) * f;
  c.drawImage(base, x - bw / 2, y - bw / 2, bw, bh);
  drawPic(c, sw(it.j), x, y + r * .02, r * 1.32);
  const gl = bubbleGloss(R);
  c.drawImage(gl, x - r, y - r, r * 2, r * 2);
}
// sparkle ring while it.pop goes 1 → 0
export function drawPop(c, it, x = it.x, y = it.y){
  const p = it.pop; if (!(p > 0)) return;
  const q = 1 - p, r = it.r;
  if (p > .6) { c.globalAlpha = (p - .6) * 1.6; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * (.7 + q), 0, TAU); c.fill(); }
  c.globalAlpha = p;
  c.lineWidth = Math.max(1, r * .12 * p); c.strokeStyle = '#fff';
  c.beginPath(); c.arc(x, y, r * (1 + q * .7), 0, TAU); c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + q * .8, d = r * (1.05 + q * 1.1);
    drawTwinkle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (.1 + .16 * p) * (i % 2 ? .7 : 1), RAINBOW[i % 7]);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) * TAU / 8 - q * .6, d = r * (.9 + q * .7);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * .05 * p + .5, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}

/* ---------- sky, dots, clouds ---------- */
let skyKey = '', skyCv = null;
function paintSky(c, W, H, p){
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, p.sky[0]); g.addColorStop(1, p.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const U = Math.min(W, H) / 10;
  if (p.moon) {
    // night: tiny stars, moon with halo
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < Math.round(W * H / 5200); i++) {
      const x = rnd() * W, y = rnd() * H * .75, r = .6 + rnd() * 1.4;
      c.globalAlpha = .35 + rnd() * .6; c.fillStyle = '#fff6dc'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    const mx = W * .82, my = H * .16, mr = U * .75;
    let hg = c.createRadialGradient(mx, my, mr * .8, mx, my, mr * 3.2);
    hg.addColorStop(0, 'rgba(255,240,190,.38)'); hg.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(mx, my, mr * 3.2, 0, TAU); c.fill();
    hg = c.createRadialGradient(mx - mr * .35, my - mr * .35, mr * .1, mx, my, mr);
    hg.addColorStop(0, '#fffbe6'); hg.addColorStop(.7, '#fff0b8'); hg.addColorStop(1, '#f5d98a');
    c.fillStyle = hg; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
    c.fillStyle = 'rgba(214,176,98,.28)';
    [[.3, -.2, .18], [-.28, .25, .13], [.18, .38, .1]].forEach(([a, b, s]) => { c.beginPath(); c.arc(mx + a * mr, my + b * mr, s * mr, 0, TAU); c.fill(); });
  } else {
    // daylight: a soft sun-glow and a few big pastel bokeh discs
    let hg = c.createRadialGradient(W * .22, H * .08, 0, W * .22, H * .08, Math.max(W, H) * .6);
    hg.addColorStop(0, 'rgba(255,255,255,.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hg; c.fillRect(0, 0, W, H);
    const disc = [[.85, .12, 1.6], [.1, .55, 1.2], [.78, .62, .9], [.35, .3, .7]];
    disc.forEach(([a, b, s]) => { c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.arc(W * a, H * b, U * s, 0, TAU); c.fill(); });
  }
}
export function skyFill(c){
  const p = pal(), dpr = G.dpr || 1, k = `${G.W}|${G.H}|${dpr}|${p.sky[0]}${p.sky[1]}`;
  if (k !== skyKey || !skyCv) {
    skyKey = k; skyCv = document.createElement('canvas');
    skyCv.width = Math.max(1, Math.round(G.W * dpr)); skyCv.height = Math.max(1, Math.round(G.H * dpr));
    const sc = skyCv.getContext('2d'); sc.scale(dpr, dpr); paintSky(sc, G.W, G.H, p);
  }
  c.drawImage(skyCv, 0, 0, G.W, G.H);
}
let dotKey = '', dotCv = null;
export function dots(c){
  const p = pal(), dpr = G.dpr || 1, k = `${G.W}|${G.H}|${dpr}|${p.dot}`;
  if (k !== dotKey || !dotCv) {
    dotKey = k; dotCv = document.createElement('canvas');
    dotCv.width = Math.max(1, Math.round(G.W * dpr)); dotCv.height = Math.max(1, Math.round(G.H * dpr));
    const d = dotCv.getContext('2d'); d.scale(dpr, dpr); d.fillStyle = p.dot; d.beginPath();
    for (let y = 22, r = 0; y < G.H + 22; y += 44, r++) for (let x = r % 2 ? 22 : 0; x < G.W + 22; x += 44) { d.moveTo(x + 2, y); d.arc(x, y, 2, 0, TAU); }
    d.fill();
  }
  c.drawImage(dotCv, 0, 0, G.W, G.H);
}
const CLOUD_S = 80;   // sprite drawn at this s, scaled for other sizes
function cloudSprite(color){
  const { rgb, a } = parseColor(color), S = CLOUD_S, W = S * 2.45, H = S * 1.75;
  const spr = sprite(`cl|${rgb.join(',')}|${G.dpr}`, W, H, (c) => {
    const ox = S * .6, oy = S * 1.05;
    const shape = (dx, dy, k = 1) => {
      c.beginPath();
      c.arc(ox + dx, oy + dy, S * .5 * k, 0, TAU);
      c.arc(ox + dx + S * .55, oy + dy - S * .25, S * .65 * k, 0, TAU);
      c.arc(ox + dx + S * 1.15, oy + dy, S * .5 * k, 0, TAU);
      c.rect(ox + dx, oy + dy, S * 1.15, S * .5 * k);
    };
    // soft shadow under the cloud
    c.fillStyle = 'rgba(90,60,140,.10)'; shape(0, S * .08); c.fill();
    const g = c.createLinearGradient(0, oy - S * .9, 0, oy + S * .5);
    const [r, gg, b] = rgb, lo = `rgb(${Math.round(r * .9)},${Math.round(gg * .9)},${Math.min(255, Math.round(b * .97 + 8))})`;
    g.addColorStop(0, `rgb(${r},${gg},${b})`); g.addColorStop(.55, `rgb(${r},${gg},${b})`); g.addColorStop(1, lo);
    c.fillStyle = g; shape(0, 0); c.fill();
    // highlights on the bumps
    c.fillStyle = 'rgba(255,255,255,.8)';
    c.beginPath(); c.ellipse(ox + S * .42, oy - S * .62, S * .2, S * .09, -.5, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(ox - S * .14, oy - S * .2, S * .1, S * .05, -.7, 0, TAU); c.fill();
  });
  return { spr, a };
}
export function cloudC(c, x, y, s){
  const { spr, a } = cloudSprite(pal().cloud), f = s / CLOUD_S;
  const w = CLOUD_S * 2.45 * f, h = CLOUD_S * 1.75 * f;
  if (a < 1) c.globalAlpha = a * 1.4 > 1 ? 1 : a * 1.4;
  c.drawImage(spr, x - CLOUD_S * .6 * f, y - CLOUD_S * 1.05 * f, w, h);
  if (a < 1) c.globalAlpha = 1;
}
// n session-word indexes including the current target, shuffled
export function pickSet(n){
  const others = shuffle(range(store.S.ses.words.length).filter(j => j !== G.target)).slice(0, n - 1);
  return shuffle([G.target, ...others]);
}

/* ---------- loop, input ---------- */
function sizeField(){
  if (!G.on) return;
  const r = G.field.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (r.width < 10 || r.height < 10) return;
  if (dpr !== G.dpr) sprites.clear();
  G.W = r.width; G.H = r.height; G.dpr = dpr;
  G.cv.width = Math.round(r.width * dpr); G.cv.height = Math.round(r.height * dpr);
  G.U = Math.min(G.W, G.H) / 10;
  if (G.ready) GAMES[G.type].resize();
  fitAsk();
}
const pt = e => { const r = G.cv.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; };
function hideCue(){ const el = app.querySelector('.field-cue'); if (el) el.classList.add('gone'); }
function onDown(e){
  if (!G.on) return;
  const p = pt(e); G.down = true;
  try { G.cv.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
  if (G.paused) return;
  hideCue();
  GAMES[G.type].press(p.x, p.y);
}
function onMove(e){ const g = G.on && !G.paused && GAMES[G.type]; if (g && g.move) { const p = pt(e); g.move(p.x, p.y, e); } }
function onUp(){ G.down = false; }
function onKey(e){
  const g = G.on && !G.paused && GAMES[G.type];
  if (g && g.key && g.key(e)) { hideCue(); e.preventDefault(); }
}

/* ---------- overlays (DOM inside .field, built by screens/play.js) ---------- */
const $ = s => app.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const alive = tok => G.on && G.token === tok;
// a voice line that never blocks the flow for long (clips can be slow to decode on the first tap)
const sayCapped = (parts, ms, opts) => Promise.race([say(parts, opts), wait(ms)]);
function showOv(sel, html){
  const el = $(sel); if (!el) return null;
  if (html != null) el.innerHTML = html;
  el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
  return el;
}
function hideOv(sel){
  const el = $(sel); if (!el || el.hidden) return;
  el.classList.remove('in'); el.classList.add('out');
  setTimeout(() => { if (el.classList.contains('out')) { el.hidden = true; el.classList.remove('out'); } }, 260);
}
export const revealing = () => !!G.revealing;

async function readySetGo(tok){
  G.paused = true;
  showOv('.ov-ready', `<div class="rsg">
      <span class="rsg-w w1">${letters('Ready')}</span>
      <span class="rsg-w w2">${letters('Set')}</span>
      <span class="rsg-w w3">${letters('Go!')}</span></div>`);
  const t0 = performance.now();
  await sayCapped('Ready, set, go!', 3000, { queue:true });
  const left = 1750 - (performance.now() - t0);
  if (left > 0) await wait(left);
  if (!alive(tok)) return;
  hideOv('.ov-ready');
  sfx.pop();
  G.paused = false;
}

/* ---------- rounds ---------- */
export function startGame(){
  const field = app.querySelector('.field'); if (!field) return;
  const S = store.S, cv = field.querySelector('canvas');
  if (!GAMES[S.ses.game]) { console.error('no game registered for', S.ses.game); return; }
  Object.assign(G, { on:true, ready:false, token:{}, cv, ctx:cv.getContext('2d'), field, type:S.ses.game, t:0, round:0, items:[], done:true, hint:false, roundT:0, down:false, aim:null, head:null, paused:true, revealing:false });
  G.targets = shuffle(range(S.ses.words.length));
  while (G.targets.length < ROUNDS) { let c; do { c = Math.floor(Math.random() * S.ses.words.length); } while (c === G.targets[G.targets.length - 1]); G.targets.push(c); }
  preloadWords(S.ses.words.map((_, k) => sw(k)));
  sizeField();
  if (window.ResizeObserver) { G.ro = new ResizeObserver(sizeField); G.ro.observe(field); }
  else { G.ro = { disconnect(){ removeEventListener('resize', sizeField); } }; addEventListener('resize', sizeField); }
  GAMES[G.type].init(); G.ready = true;
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  // first round is laid out behind the "Ready, set, go!" overlay, then it goes live
  const tok = G.token;
  G.target = G.targets[0]; hud(); GAMES[G.type].round();
  readySetGo(tok).then(() => { if (alive(tok)) beginRound(); });
  G.last = performance.now();
  G.raf = requestAnimationFrame(frame);
}
export function stopGame(){
  if (!G.on) return;
  G.on = false; G.paused = false; G.revealing = false; cancelAnimationFrame(G.raf);
  if (G.ro) G.ro.disconnect();
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('keydown', onKey);
}
export const promptText = () => PROMPTS[G.type].say(sw(G.target));

// the prompt chip's word: rainbow letters, sized to fit one line
function fitAsk(){
  const el = $('.ask-word'), chip = $('.ask'); if (!el || !chip || G.target == null || !store.S.ses) return;
  // measure at the largest size, then scale down so the word fits on one line inside the chip
  const avail = Math.min(app.clientWidth - 32, 640) - 118, MAX = 48;
  el.style.fontSize = MAX + 'px';
  const wpx = el.scrollWidth || 1;
  el.style.fontSize = Math.max(18, Math.min(MAX, MAX * avail / wpx)).toFixed(1) + 'px';
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (G.on) fitAsk(); });
function hud(){
  const w = sw(G.target), el = $('.ask-word');
  if (el) { el.innerHTML = letters(w.en); el.setAttribute('aria-label', w.en); }
  fitAsk();
  app.querySelectorAll('.slots .slot').forEach((d, k) => { d.classList.toggle('now', k === G.round); });
}
function fillSlot(k){
  const d = app.querySelectorAll('.slots .slot')[k];
  if (d) { d.classList.remove('now'); d.classList.add('on'); }
}
function beginRound(){
  G.done = false; G.hint = false; G.roundT = 0;
  say(promptText());
}
function nextRound(){
  if (!G.on) return;
  if (G.round >= G.targets.length) { finishGame(); return; }
  G.target = G.targets[G.round]; G.done = false; G.hint = false; G.roundT = 0;
  hud();
  const ask = $('.ask'); if (ask) { ask.classList.remove('hinting'); wiggle(ask); }
  GAMES[G.type].round();
  say(promptText());
}

// correct answer at canvas point x,y: +1 star (saved now), sticker, word-reveal banner with praise + the word, next round
export function gotIt(x, y){
  if (!G.on || G.done) return;
  const S = store.S, P = store.P, w = sw(G.target), k = G.round;
  G.done = true; G.round++;
  S.ses.stars++; P.stars++;
  const fresh = !P.got[w.key];
  if (fresh) { P.got[w.key] = 1; S.ses.newStickers.push(w.key); }
  save();
  sfx.yay();
  const r = G.cv.getBoundingClientRect();
  burst(r.left + x, r.top + y, 46); flyStarXY(r.left + x, r.top + y);
  fillSlot(k);
  const ask = $('.ask'); if (ask) ask.classList.remove('hinting');
  const tok = G.token;
  revealWord(w, fresh, tok).then(() => { if (alive(tok)) nextRound(); });
}
async function revealWord(w, fresh, tok){
  G.revealing = true;
  const ov = showOv('.ov-reveal', `<div class="rv-rays" aria-hidden="true"></div>
    <div class="rv-card">
      <div class="rv-pic">${picHTML(w)}<img class="rv-sp sp1" src="${imgSrc('sparkles')}" alt=""><img class="rv-sp sp2" src="${imgSrc('sparkles')}" alt=""></div>
      <div class="word rv-word" aria-label="${w.en}">${letters(w.en)}</div>
      ${fresh ? `<div class="rv-new" aria-hidden="true"><img src="${imgSrc('star')}" alt="">New sticker!</div>` : ''}
    </div>`);
  if (ov) {
    const L = Math.max(3, w.en.length), fw = G.W || 300;
    const ww = ov.querySelector('.rv-word'); if (ww) ww.style.fontSize = Math.max(24, Math.min(60, (Math.min(fw, 560) - 96) / (L * .6))).toFixed(1) + 'px';
  }
  const t0 = performance.now();
  await sayCapped([pickOne(PRAISE), w.en], 4500);
  if (!alive(tok)) return;
  if (fresh) {
    const b = ov && ov.querySelector('.rv-new');
    if (b) { b.classList.add('show'); const br = b.getBoundingClientRect(); burst(br.left + br.width / 2, br.top + br.height / 2, 18); }
    if (sfx.sticker) sfx.sticker(); else sfx.pop();
    await sayCapped('New sticker!', 2600);
    if (!alive(tok)) return;
  }
  const left = 1200 - (performance.now() - t0);
  if (left > 0) await wait(left);
  await wait(220);
  if (!alive(tok)) return;
  hideOv('.ov-reveal');
  G.revealing = false;
  await wait(180);
}
// wrong answer (session word index j): say the tapped WORD only, short pause, then the prompt again
export function oops(j){
  if (!G.on || G.done) return;
  const w = sw(j);
  sfx.boop(); G.hint = true;
  const ask = $('.ask'); if (ask) { shake(ask); ask.classList.add('hinting'); }
  const tag = $('.ov-tag');
  if (tag) {
    tag.innerHTML = `<span class="tag-pic">${picHTML(w)}</span><b>${w.en}</b>`;
    tag.hidden = false; tag.classList.remove('in'); void tag.offsetWidth; tag.classList.add('in');
    clearTimeout(G.tagT); G.tagT = setTimeout(() => { tag.classList.remove('in'); tag.hidden = true; }, 1700);
  }
  say([w.en, promptText()], { gap:650 });
}
function hintNow(){
  G.hint = true;
  const ask = $('.ask'); if (ask) { ask.classList.add('hinting'); wiggle(ask.querySelector('.spk')); }
  say(['Listen!', promptText()], { gap:250 });
}
async function finishGame(){
  const S = store.S, P = store.P, tok = G.token;
  G.done = true; G.paused = true;
  S.ses.bonus = 2; S.ses.stars += 2; P.stars += 2;
  P.stats.games = (P.stats.games || 0) + 1; P.stats.lastPlayed = Date.now();
  save();
  const ov = showOv('.ov-bonus', `<div class="rv-rays" aria-hidden="true"></div><div class="rv-card bn-card">
      <div class="bn-stars"><img class="s1" src="${imgSrc('star')}" alt=""><img class="s2" src="${imgSrc('star')}" alt=""></div>
      <div class="word bn-word" aria-label="Bonus stars!">${letters('Bonus stars!')}</div>
      <div class="bn-plus">+2</div></div>`);
  sfx.fanfare();
  const t0 = performance.now();
  const v = sayCapped('Bonus stars!', 3000);
  await wait(REDUCED_MOTION ? 200 : 700);
  if (!alive(tok)) return;
  if (ov) ov.querySelectorAll('.bn-stars img').forEach((im, i) => {
    const b = im.getBoundingClientRect();
    setTimeout(() => { if (alive(tok)) flyStarXY(b.left + b.width / 2, b.top + b.height / 2); }, i * 220);
  });
  await v;
  const left = 2100 - (performance.now() - t0);
  if (left > 0) await wait(left);
  if (!alive(tok)) return;
  go('result');
}
function frame(now){
  if (!G.on) return;
  const dt = Math.min(.05, (now - G.last) / 1000); G.last = now;
  if (!document.hidden && G.W) {
    G.t += dt;
    if (!G.done && !G.paused) { G.roundT += dt; if (!G.hint && G.roundT > 8) hintNow(); }
    GAMES[G.type].update(dt);
    const c = G.ctx; c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); c.clearRect(0, 0, G.W, G.H);
    GAMES[G.type].draw(c);
  }
  G.raf = requestAnimationFrame(frame);
}
