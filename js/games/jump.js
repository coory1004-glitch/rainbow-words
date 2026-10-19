// games/jump.js (owner: jump) — the princess runs through a storybook world; tap (or Space) to jump into the bubble you hear.
// Art: each world is a parallax side-scroller (sky, sun or moon, drifting clouds, far hills, near props, textured ground).
// The static layers are painted once per size/world into offscreen strips that tile horizontally; the bubbles, puffs,
// halos and shadows are pre-rendered sprites, so a frame is mostly drawImage calls. Particles come from a fixed pool.
import { G, registerGame, gotIt, oops, pickSet } from '../engine.js';
import { store } from '../state.js';
import { PET_IMG, TAU, RAINBOW } from '../data.js';
import { sfx } from '../audio.js';
import { avatarImage } from '../art.js';
import { getImage, drawPic } from '../images.js';
import { sw } from '../session.js';

const REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const BUFFER = .26;          // s: a tap this close before landing still jumps
const FEET = .965;           // feet sit at this fraction of the avatar image height

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ready = im => !!im && (im instanceof HTMLCanvasElement || (im.complete && im.naturalWidth > 0));
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const easeBack = t => { const s = 1.9; t -= 1; return 1 + t * t * ((s + 1) * t + s); };
function rng(seed){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function canvas(w, h){ const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
// an offscreen canvas painted in CSS px (scaled by dpr); .w/.h = CSS size
function layer(w, h, paint){
  const d = G.dpr || 1, cv = canvas(w * d, h * d), x = cv.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0); paint(x, w, h); cv.w = w; cv.h = h; return cv;
}
const sprite = (css, paint) => layer(css, css, (x, w) => paint(x, w / 2));
const put = (c, sp, x, y, w, h = w) => c.drawImage(sp, x - w / 2, y - h / 2, w, h);
function star4(c, x, y, s){
  c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s);
}
function rrect(x, X, Y, w, h, r){
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}

/* ======================= worlds ======================= */
// near/front: [image, size × princess height]; props that are also a word of this session are skipped
const MEADOW = {
  sky:['#ffcfe9', '#efdcff', '#fff3fa'], sun:true, rays:'#fff6d8', rainbow:0, twinkle:.6,
  cloud:['#ffffff', '#efdff9'], cloudA:1,
  farA:{ kind:'mount', top:'#dcc8f6', bot:'#f5e7fd', h:.4 },
  farB:{ kind:'domes', cols:['#f8cbe5', '#f2bfdf', '#fbd6ea'], bot:'#fde9f4', h:.25 },
  mid:{ kind:'domes', cols:['#b6eac6', '#a3e2b8', '#c3efcf'], bot:'#e0f8e7', h:.15, props:[['tree', .5], ['evergreen', .46], ['tree', .4]] },
  ground:'grass', gc:{ top:'#a5e9b9', hi:'#d2fadc', edge:'#7ccf98', face:'#f8d2b4', face2:'#e9b28f', pebble:'#ffe6d2', tuft:'#74cb92', dots:['#ffffff', '#ff9fd2', '#ffe066', '#b79bff'] },
  near:[['tulip', .34], ['flower', .3], ['sunflower', .46], ['mushroom', .27], ['tree', .8], ['blossom', .2], ['evergreen', .68], ['herb', .26]],
  front:[['tulip', .52], ['blossom', .34], ['flower', .46], ['herb', .44], ['leaf', .36]],
  fly:'butterfly', dust:'#ffffff', shade:'#6d3f8e',
};
const THEMES = {
  mix: MEADOW,
  unicorn:{ ...MEADOW, rainbow:.34, castle:true,
    sky:['#ffc9e8', '#f0d6ff', '#fff0fa'],
    farB:{ kind:'domes', cols:['#f9c6e3', '#efbde0', '#fbd3ea'], bot:'#feeaf5', h:.26, castle:true },
    near:[['tulip', .34], ['blossom', .2], ['sunflower', .46], ['mushroom', .27], ['tree', .78], ['flower', .3], ['ribbon', .26], ['bouquet', .34]] },
  sweets:{
    sky:['#ffc6dc', '#ffe0d6', '#fff6e6'], sun:true, rays:'#fff3cf', rainbow:0, twinkle:0,
    cloud:['#ffffff', '#ffe0ea'], cloudA:1,
    farA:{ kind:'domes', cols:['#ffd9e6', '#ffe9c9', '#e3f6e8', '#e9dcff'], bot:'#fff4f1', h:.36, drip:'#ffffff' },
    farB:{ kind:'domes', cols:['#ffb9d2', '#ffd09a', '#c8eccf', '#d6c4ff'], bot:'#ffeef3', h:.22, drip:'#fff8f2' },
    mid:{ kind:'domes', cols:['#c98a5f', '#d79a6c', '#b97a52'], bot:'#f1c9a2', h:.14, drip:'#ffe2ee', props:[['lollipop', .5], ['candy-cane', .5], ['ice-cream', .46]] },
    ground:'cake', gc:{ top:'#ffb3cf', hi:'#ffd8e7', edge:'#ff8fb7', face:'#ffe2a6', face2:'#f6c37a', jam:'#ff7d9f', base:'#a8663f', dots:RAINBOW },
    near:[['cupcake', .34], ['lollipop', .5], ['candy', .26], ['ice-cream', .4], ['cake', .4], ['strawberry', .26], ['candy-cane', .5], ['present', .32], ['gift', .32]],
    front:[['candy', .4], ['lollipop', .62], ['strawberry', .4], ['cupcake', .44]],
    fly:'confetti', dust:'#ffffff', shade:'#8e3f62',
  },
  colors:{
    sky:['#b9e3ff', '#e2f3ff', '#fff8d4'], sun:true, rays:'#fffbe0', rainbow:.5, twinkle:0,
    cloud:['#ffffff', '#deebfb'], cloudA:1,
    farA:{ kind:'mount', top:'#bfd9f6', bot:'#eaf4ff', h:.34 },
    farB:{ kind:'domes', cols:['#ffb3c1', '#ffd09e', '#fff0a3', '#b9efcb', '#b5d8ff', '#d5c4ff'], bot:'#fffaf0', h:.24 },
    mid:{ kind:'domes', cols:['#a8e6a6', '#93dc98', '#b8eeb2'], bot:'#e2f9dc', h:.14, props:[['sunflower', .5], ['tree', .46], ['tulip', .32]] },
    ground:'grass', gc:{ top:'#9fe59d', hi:'#cff8c9', edge:'#78cc78', face:'#ffd9a8', face2:'#f2b97e', pebble:'#fff0d6', tuft:'#6cc46e', dots:RAINBOW },
    near:[['tulip', .34], ['sunflower', .48], ['flower', .3], ['mushroom', .27], ['tree', .8], ['lady-beetle', .18], ['herb', .26]],
    front:[['tulip', .52], ['sunflower', .6], ['flower', .46], ['leaf', .36]],
    fly:'kite', dust:'#ffffff', shade:'#3f5b8e',
  },
  cars:{
    sky:['#93d2ff', '#c9ecff', '#f2fbff'], sun:true, rays:'#fffbe2', rainbow:0, twinkle:0,
    cloud:['#ffffff', '#dceefc'], cloudA:1,
    farA:{ kind:'city', cols:['#9cc3ee', '#b2d0f3', '#a6c0ee', '#c0b8ef'], win:'#f4f9ff', h:.36 },
    farB:{ kind:'domes', cols:['#c4ebb8', '#b3e3a8', '#cff0c4'], bot:'#ecfae6', h:.2 },
    mid:{ kind:'domes', cols:['#9fdc95', '#8fd487', '#addf9f'], bot:'#dcf5d4', h:.13, props:[['house', .5], ['evergreen', .44], ['tree', .44], ['house', .46]] },
    ground:'road', gc:{ top:'#ece8f6', hi:'#faf8ff', edge:'#cfc8e3', hedge:'#8fd68f', curb:'#ffffff', road:'#7f84a0', road2:'#6c7190', line:'#ffffff', stripe:'#ffd23f' },
    near:[['cone', .3], ['traffic-light', .62], ['police-car', .44], ['fire-engine', .5], ['ambulance', .46], ['tree', .78], ['evergreen', .66], ['car', .4], ['school-bus', .5], ['fire-extinguisher', .3]],
    front:[['cone', .44], ['herb', .4]],
    fly:'heli', dust:'#ffffff', shade:'#2f4a7a',
  },
  halloween:{
    sky:['#140a2c', '#33195c', '#6a3a8e'], sun:false, rays:null, rainbow:0, twinkle:1, night:true,
    cloud:['#8f73c4', '#5e4592'], cloudA:.32,
    farA:{ kind:'mount', top:'#3d2566', bot:'#5d3a87', h:.36, rim:'rgba(220,190,255,.18)' },
    farB:{ kind:'domes', cols:['#2f1c50', '#2a1848', '#341f58'], bot:'#47306c', h:.24, castle:true, rim:'rgba(220,190,255,.16)' },
    mid:{ kind:'domes', cols:['#24153e', '#2b1949', '#21133a'], bot:'#3b2760', h:.14, spooky:true, rim:'rgba(230,200,255,.14)' },
    ground:'night', gc:{ top:'#5a3c87', hi:'#7656a8', edge:'#3f2766', face:'#2b1c45', face2:'#21153a', pebble:'#3d2b5e', tuft:'#432a6c', dots:['#ffd36b', '#9cff9a', '#ff9a3c'] },
    near:[['jack-o-lantern', .34, 1], ['mushroom', .27], ['evergreen', .66], ['candy', .24, 1], ['jack-o-lantern', .3, 1], ['owl', .3], ['tree', .74], ['lollipop', .4, 1]],
    front:[['jack-o-lantern', .48, 1], ['herb', .4], ['mushroom', .42]],
    fly:'bats', dust:'#b69ad8', shade:'#07020f',
  },
};
const worldId = () => (store.S.ses && THEMES[store.S.ses.world] ? store.S.ses.world : 'mix');
const theme = () => THEMES[worldId()];

/* ======================= runtime state ======================= */
const J = { scroll:0, py:0, vy:0, ground:true, buf:0, dizzy:0, cheer:0, sq:0, sqv:0, run:0, step:0, queue:[], spawnT:.5, spawnK:0,
  pet:{ py:0, vy:0, sq:0, hop:.4, jumpIn:-1 }, props:[], front:[], nearX:0, frontX:0, fliers:[], flyT:0 };
const POOL = [];
for (let k = 0; k < 64; k++) POOL.push({ on:false, kind:0, x:0, y:0, vx:0, vy:0, life:0, max:1, s:1, rot:0, vr:0, col:'#fff' });
function emit(kind, x, y, vx, vy, max, s, col){
  for (const p of POOL) if (!p.on) { p.on = true; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = 0; p.max = max; p.s = s; p.col = col || '#fff'; p.rot = Math.random() * TAU; p.vr = (Math.random() - .5) * 8; return p; }
  return null;
}
function puff(x, y, n, dir, power){
  for (let k = 0; k < n; k++) {
    const a = dir == null ? Math.PI + (k / Math.max(1, n - 1)) * Math.PI : dir + (Math.random() - .5) * .8;
    const v = G.U * (power || 1.4) * (.6 + Math.random() * .7);
    emit(0, x + (Math.random() - .5) * G.U * .3, y, Math.cos(a) * v, Math.min(0, Math.sin(a) * v) - G.U * .3, .45 + Math.random() * .3, G.U * (.32 + Math.random() * .22));
  }
}
function sparkle(x, y, n, spread){
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU + Math.random() * .4, v = G.U * (spread || 3.4) * (.5 + Math.random() * .6);
    emit(1, x, y, Math.cos(a) * v, Math.sin(a) * v, .6 + Math.random() * .35, G.U * (.14 + Math.random() * .12), RAINBOW[k % 7]);
  }
}

/* ======================= geometry + jump physics ======================= */
function stepJump(s, dt){
  const hang = Math.abs(s.vy) < J.v0 * .32 ? .45 : 1, down = s.vy < 0 ? 1.08 : 1;
  s.vy -= J.g * hang * down * dt; s.py += s.vy * dt;
}
function geo(){
  const W = G.W, H = G.H, U = G.U;
  J.gy = H * (H > W * 1.15 ? .815 : .8);          // the line her feet run on
  J.gTop = J.gy - U * .42;                           // top of the ground surface (props stand here)
  J.ch = clamp(Math.min(H * .33, W * .52), 96, 250);  // princess height
  J.cw = J.ch * 2 / 3;
  J.ps = J.ch * .36;                                  // pet size
  J.cx = Math.max(W * .24, J.cw * .5 + J.ps * .72 + 10);
  J.jh = J.ch * .92;
  J.v0 = 3.6 * J.jh; J.g = 7 * J.jh;
  const s = { py:0, vy:J.v0 }; let t = 0, apex = 0, tA = 0;
  while (t < 4) { stepJump(s, 1 / 240); t += 1 / 240; if (s.py > apex) { apex = s.py; tA = t; } if (s.py <= 0 && s.vy < 0) break; }
  J.apex = apex; J.tApex = tA; J.air = t;
  J.r = J.ch * .29;
  J.iy = J.gy - apex - J.ch * .6;
  J.vx = Math.max(W * .2, J.ch * .74);
  J.gap = (J.ch * 1.1 + J.r * 2.1) / J.vx;          // seconds between bubbles
}
// does a bubble at x,y touch her when she is py above the ground? wide = the forgiving box used for the target
function touch(x, y, r, py, wide){
  const top = J.gy - py - J.ch * .93;
  const bx = J.cw * (wide ? .44 : .26), y0 = top + (wide ? 0 : J.ch * .12), y1 = top + J.ch * (wide ? .8 : .58);
  const dx = x - clamp(x, J.cx - bx, J.cx + bx), dy = y - clamp(y, y0, y1);
  const rr = r * (wide ? 1.08 : .66);
  return dx * dx + dy * dy < rr * rr;
}
const bobY = (it, t) => J.iy + Math.sin(t * 2.3 + it.ph) * G.U * .12;

/* ======================= scene (offscreen, per size + world) ======================= */
let SC = null;
const avoidSet = () => { const s = new Set(); if (store.S.ses) for (let k = 0; k < store.S.ses.words.length; k++) s.add(sw(k).pic); return s; };
const tints = new Map();
// a darker, moonlit copy of a Fluent image for the night world
function nightImg(name){
  const im = getImage(name);
  if (!theme().night) return im;
  let t = tints.get(name);
  if (t) return t;
  if (!ready(im)) return im;
  t = canvas(256, 256); const x = t.getContext('2d');
  x.drawImage(im, 0, 0, 256, 256); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(46,22,92,.42)'; x.fillRect(0, 0, 256, 256);
  tints.set(name, t); return t;
}
function silhouette(name, col, a){
  const key = name + col + a; let t = tints.get(key); const im = getImage(name);
  if (t) return t; if (!ready(im)) return null;
  t = canvas(256, 256); const x = t.getContext('2d');
  x.drawImage(im, 0, 0, 256, 256); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a; x.fillStyle = col; x.fillRect(0, 0, 256, 256);
  tints.set(key, t); return t;
}

function paintSky(x, W, H, th){
  const g = x.createLinearGradient(0, 0, 0, J.gTop);
  g.addColorStop(0, th.sky[0]); g.addColorStop(.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const U = G.U, ss = U * (H > W ? (th.night ? 1.9 : 2.1) : 1.65), sx = W * (H > W ? .82 : .86);
  const sy = Math.max(ss * .58, Math.min(U * 1.55, J.gTop * .2, J.iy - J.r - ss * .5 - U * .25));
  J.sun = { x:sx, y:sy, s:ss };
  // big soft glow around the sun / moon
  const R = U * (th.night ? 4.2 : 5.5), gl = x.createRadialGradient(sx, sy, 0, sx, sy, R);
  if (th.night) { gl.addColorStop(0, 'rgba(255,240,200,.55)'); gl.addColorStop(.25, 'rgba(230,190,255,.22)'); gl.addColorStop(1, 'rgba(200,150,255,0)'); }
  else { gl.addColorStop(0, 'rgba(255,252,230,.95)'); gl.addColorStop(.3, 'rgba(255,244,214,.45)'); gl.addColorStop(1, 'rgba(255,240,220,0)'); }
  x.fillStyle = gl; x.fillRect(0, 0, W, H);
  if (th.rainbow) {                      // soft pastel rainbow behind the far hills
    const cx = W * .34, cy = J.gTop + U * .6, R0 = Math.min(J.gTop * .72, W * .95), bw = Math.min(U * .26, R0 * .05);
    x.save(); x.globalAlpha = .55; x.lineWidth = bw * 8.2; x.strokeStyle = '#ffffff';
    x.beginPath(); x.arc(cx, cy, R0 - bw * 3, Math.PI, 0); x.stroke();
    x.globalAlpha = th.rainbow; x.lineWidth = bw + .8;
    RAINBOW.forEach((c, k) => { x.beginPath(); x.arc(cx, cy, R0 - k * bw, Math.PI, 0); x.strokeStyle = mix(c, '#ffffff', .3); x.stroke(); });
    x.restore();
  }
  if (th.night) {                        // starfield
    const r = rng(7); x.fillStyle = '#fff6e0';
    for (let k = 0; k < 90; k++) { const px = r() * W, py = r() * J.gTop * .8, s = r() < .15 ? 1.4 : .7 + r() * .5; x.globalAlpha = .35 + r() * .55; x.beginPath(); x.arc(px, py, s, 0, TAU); x.fill(); }
    x.globalAlpha = 1;
  }
}
// periodic ridge line for mountains
function ridge(P, h, r){
  const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
  return x => h * (.62 + .2 * Math.sin(TAU * 2 * x / P + ph[0]) + .1 * Math.sin(TAU * 5 * x / P + ph[1]) + .06 * Math.sin(TAU * 9 * x / P + ph[2]) + .03 * Math.sin(TAU * 17 * x / P + ph[3]));
}
function paintMount(x, P, Hs, hh, o, r){
  const f = ridge(P, hh * .9, r);
  x.beginPath(); x.moveTo(0, Hs);
  for (let px = 0; px < P; px += 3) x.lineTo(px, Hs - f(px));
  x.lineTo(P, Hs - f(P)); x.lineTo(P, Hs); x.closePath();
  const g = x.createLinearGradient(0, Hs * .05, 0, Hs); g.addColorStop(0, o.top); g.addColorStop(1, o.bot);
  x.fillStyle = g; x.fill();
  x.beginPath(); for (let px = 0; px < P + 3; px += 3) { const q = Math.min(px, P), y = Hs - f(q) + G.U * .05; px ? x.lineTo(q, y) : x.moveTo(q, y); }
  x.lineWidth = G.U * .08; x.strokeStyle = o.rim || 'rgba(255,255,255,.55)'; x.stroke();
}
function domeList(P, hh, o, r){
  const out = []; let c = 0, k = 0;
  while (c < P - G.U) {
    const w = G.U * lerp(3.6, 6.4, r()), h = hh * lerp(.55, .95, r());
    out.push({ c:c + w * .5, w, h, col:o.cols[k++ % o.cols.length] });
    c += w * lerp(.5, .72, r());
  }
  return out;
}
function paintDome(x, d, cx, Hs, o){
  const top = Hs - d.h;
  x.save();
  x.beginPath(); x.ellipse(cx, Hs, d.w / 2, d.h, 0, Math.PI, 0); x.closePath();
  const g = x.createLinearGradient(0, top, 0, Hs); g.addColorStop(0, d.col); g.addColorStop(1, o.bot); x.fillStyle = g; x.fill();
  x.clip();
  if (o.drip) {                         // frosting cap with drips (sweets)
    x.fillStyle = o.drip; x.beginPath();
    const yb = top + d.h * .3; x.rect(cx - d.w / 2, top - 2, d.w, d.h * .3 + 2); x.fill();
    const n = Math.max(3, Math.round(d.w / (G.U * .8)));
    for (let k = 0; k <= n; k++) { const px = cx - d.w / 2 + k * d.w / n, rr = d.w / n * .5, len = (k * 7919 % 5) / 5 * d.h * .16 + rr; x.beginPath(); x.arc(px, yb, rr, 0, TAU); x.fill(); x.fillRect(px - rr * .45, yb, rr * .9, len); x.beginPath(); x.arc(px, yb + len, rr * .45, 0, TAU); x.fill(); }
  }
  // soft shade on the right, gloss on the upper left
  const sh = x.createLinearGradient(cx - d.w / 2, 0, cx + d.w / 2, 0); sh.addColorStop(.55, 'rgba(60,20,90,0)'); sh.addColorStop(1, 'rgba(60,20,90,.1)');
  x.fillStyle = sh; x.fillRect(cx - d.w / 2, top, d.w, d.h);
  x.restore();
  x.beginPath(); x.ellipse(cx, Hs, d.w / 2 - G.U * .12, d.h - G.U * .12, 0, Math.PI * 1.14, Math.PI * 1.42);
  x.lineCap = 'round'; x.lineWidth = G.U * .1; x.strokeStyle = o.rim || 'rgba(255,255,255,.6)'; x.stroke();
}
function paintCity(x, P, Hs, hh, o, r){
  let px = 0, k = 0; const U = G.U, list = [];
  while (px < P) { const w = U * lerp(.9, 1.7, r()), h = hh * lerp(.35, .95, r()); list.push({ px, w, h, col:o.cols[k++ % o.cols.length], dome:r() < .25 }); px += w + U * lerp(-.1, .25, r()); }
  for (const b of list) for (const off of [-P, 0, P]) {
    const X = b.px + off; if (X > P || X + b.w < 0) continue;
    x.beginPath(); rrect(x, X, Hs - b.h, b.w, b.h + U, U * .18); x.fillStyle = b.col; x.fill();
    if (b.dome) { x.beginPath(); x.arc(X + b.w / 2, Hs - b.h, b.w * .3, Math.PI, 0); x.fill(); }
    x.fillStyle = rgba(o.win, .75);
    const cols = Math.max(1, Math.floor(b.w / (U * .42))), gw = b.w / cols;
    for (let yy = Hs - b.h + U * .32; yy < Hs - U * .2; yy += U * .46) for (let cc = 0; cc < cols; cc++) { x.beginPath(); rrect(x, X + cc * gw + gw * .28, yy, gw * .44, U * .2, U * .06); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X + U * .06, Hs - b.h + U * .1, U * .07, b.h);
  }
}
function spookyTree(x, X, base, h, col){
  x.strokeStyle = col; x.lineCap = 'round';
  const br = (px, py, a, len, w, d) => {
    const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
    x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + .3) * len * .5, py + Math.sin(a + .3) * len * .5, ex, ey); x.stroke();
    if (d > 0) { br(ex, ey, a - .55, len * .66, w * .62, d - 1); br(ex, ey, a + .5, len * .6, w * .62, d - 1); }
  };
  br(X, base, -Math.PI / 2, h * .45, h * .09, 3);
}
function paintHills(x, P, Hs, hh, o, r, avoid){
  if (o.kind === 'mount') return paintMount(x, P, Hs, hh, o, r);
  if (o.kind === 'city') return paintCity(x, P, Hs, hh, o, r);
  const ds = domeList(P, hh, o, r);
  const order = ds.slice().sort((a, b) => b.h - a.h);
  for (const d of order) for (const off of [-P, 0, P]) if (d.c + off + d.w / 2 > 0 && d.c + off - d.w / 2 < P) paintDome(x, d, d.c + off, Hs, o);
  const U = G.U;
  // things standing on the hill tops
  const put1 = (im, d, size, dx = 0, alpha = 1) => {
    if (!im) return;
    const px = d.c + dx, top = Hs - d.h * Math.sqrt(Math.max(0, 1 - (2 * dx / d.w) ** 2));
    x.globalAlpha = alpha;
    for (const off of [-P, 0, P]) { const X = px + off; if (X + size < 0 || X - size > P) continue; x.drawImage(im, X - size / 2, top - size * .92, size, size); }
    x.globalAlpha = 1;
  };
  if (o.castle) {
    const d = ds[Math.floor(ds.length * .35)], night = theme().night;
    put1(night ? silhouette('castle', '#22103e', .8) : silhouette('castle', '#f6d9f4', .28), d, J.ch * (night ? .9 : .78), 0);
  }
  if (o.props) {
    const list = o.props.filter(p => !avoid.has(p[0]));
    ds.forEach((d, k) => {
      if (!list.length || (o.castle && k === Math.floor(ds.length * .35))) return;
      const p = list[k % list.length];
      if (r() < .35) return;
      const im = silhouette(p[0], theme().sky[2], .22);
      put1(im, d, J.ch * p[1] * lerp(.8, 1.1, r()), d.w * lerp(-.18, .18, r()));
      if (r() < .45) put1(im, d, J.ch * p[1] * .7, d.w * lerp(.2, .3, r()));
    });
  }
  if (o.spooky) {
    ds.forEach((d, k) => {
      const h = J.ch * lerp(.5, .85, r()), top = Hs - d.h;
      if (k % 2 === 0) for (const off of [-P, 0, P]) spookyTree(x, d.c + off + d.w * .1, top + d.h * .04, h, '#1a0d30');
    });
  }
  return ds;
}
// the ground: a chunky slab whose top surface she runs on and whose front face shows grass/cake/road/soil
function paintGround(x, P, Hg, th, r){
  const U = G.U, c = th.gc, top = U * .45;                   // strip y of the surface top (= J.gTop)
  const face = top + (J.gy - J.gTop) + U * .55;              // where the front face starts
  const n = Math.max(6, Math.round(P / (U * .62))), sw = P / n;
  if (th.ground === 'road') {
    // hedge along the back
    x.fillStyle = c.hedge; x.beginPath(); x.rect(0, top - U * .05, P, U * .3);
    for (let k = 0; k <= n; k++) x.arc(k * sw, top, sw * .62, 0, TAU);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.28)'; for (let k = 0; k <= n; k++) { x.beginPath(); x.arc(k * sw - sw * .15, top - sw * .2, sw * .22, 0, TAU); x.fill(); }
    // pavement
    let g = x.createLinearGradient(0, top, 0, face); g.addColorStop(0, c.hi); g.addColorStop(1, c.top);
    x.fillStyle = g; x.fillRect(0, top + U * .12, P, face - top);
    x.strokeStyle = c.edge; x.lineWidth = 1.5;
    const tiles = Math.round(P / (U * 1.3));
    for (let k = 0; k < tiles; k++) { const px = k * P / tiles; x.beginPath(); x.moveTo(px, top + U * .2); x.lineTo(px - U * .25, face); x.stroke(); }
    // curb + road
    x.fillStyle = c.curb; x.fillRect(0, face, P, U * .26);
    x.fillStyle = c.edge; x.fillRect(0, face + U * .26, P, U * .1);
    g = x.createLinearGradient(0, face + U * .36, 0, Hg); g.addColorStop(0, c.road); g.addColorStop(1, c.road2);
    x.fillStyle = g; x.fillRect(0, face + U * .36, P, Hg);
    const mid = face + U * .36 + (Hg - face - U * .36) * .45, dashes = Math.max(3, Math.round(P / (U * 2)));
    x.fillStyle = c.line; for (let k = 0; k < dashes; k++) { x.beginPath(); rrect(x, k * P / dashes, mid - U * .07, P / dashes * .5, U * .14, U * .07); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,.07)'; for (let k = 0; k < 140; k++) { x.beginPath(); x.arc(r() * P, face + U * .5 + r() * (Hg - face), 1 + r() * 1.4, 0, TAU); x.fill(); }
    return;
  }
  // surface (grass / frosting)
  let g = x.createLinearGradient(0, top - U * .3, 0, face); g.addColorStop(0, c.hi); g.addColorStop(.35, c.top); g.addColorStop(1, mix(c.top, c.edge, .5));
  x.fillStyle = g; x.beginPath(); x.rect(0, top, P, face - top + 2);
  for (let k = 0; k <= n; k++) { x.moveTo(k * sw + sw * .6, top); x.arc(k * sw, top, sw * .6, 0, TAU); }
  x.fill();
  x.fillStyle = 'rgba(255,255,255,.4)';
  for (let k = 0; k <= n; k++) { x.beginPath(); x.ellipse(k * sw - sw * .12, top - sw * .28, sw * .2, sw * .1, -.3, 0, TAU); x.fill(); }
  const wrap = (px, fn) => { fn(px); if (px < U) fn(px + P); if (px > P - U) fn(px - P); };
  if (th.ground === 'cake') {       // sprinkles
    for (let k = 0; k < P / U * 2.2; k++) {
      const px = r() * P, py = top + U * .2 + r() * (face - top - U * .35), a = r() * Math.PI, col = c.dots[k % c.dots.length];
      wrap(px, X => { x.save(); x.translate(X, py); x.rotate(a); x.fillStyle = col; x.beginPath(); rrect(x, -U * .12, -U * .04, U * .24, U * .08, U * .04); x.fill(); x.restore(); });
    }
  } else {                          // grass tufts and tiny flowers
    x.strokeStyle = c.tuft; x.lineCap = 'round'; x.lineWidth = Math.max(1.5, U * .05);
    for (let k = 0; k < P / U * 1.6; k++) {
      const px = r() * P, py = top + U * .25 + r() * (face - top - U * .3), s = U * (.12 + r() * .1);
      wrap(px, X => { x.beginPath(); x.moveTo(X - s * .6, py - s); x.lineTo(X, py); x.lineTo(X + s * .6, py - s); x.moveTo(X, py); x.lineTo(X + s * .1, py - s * 1.25); x.stroke(); });
    }
    for (let k = 0; k < P / U * .7; k++) {
      const px = r() * P, py = top + U * .3 + r() * (face - top - U * .4), col = c.dots[k % c.dots.length], s = U * .07;
      wrap(px, X => { x.fillStyle = col; x.beginPath(); for (let q = 0; q < 5; q++) { const a = q * TAU / 5; x.moveTo(X + Math.cos(a) * s * 1.6 + s, py + Math.sin(a) * s * 1.6); x.arc(X + Math.cos(a) * s * 1.6, py + Math.sin(a) * s * 1.6, s, 0, TAU); } x.fill(); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(X, py, s * .9, 0, TAU); x.fill(); });
    }
  }
  // front face
  g = x.createLinearGradient(0, face, 0, Hg); g.addColorStop(0, c.face); g.addColorStop(1, c.face2);
  x.fillStyle = g; x.fillRect(0, face, P, Hg - face);
  if (th.ground === 'cake') {
    x.fillStyle = c.jam; x.fillRect(0, face + (Hg - face) * .42, P, U * .2);
    x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, face + (Hg - face) * .42 + U * .2, P, U * .07);
    x.fillStyle = c.base; x.fillRect(0, face + (Hg - face) * .78, P, Hg);
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, face + (Hg - face) * .78, P, U * .06);
    x.fillStyle = 'rgba(160,90,40,.18)';
    for (let k = 0; k < P / U * 3; k++) { const px = r() * P, py = face + U * .5 + r() * (Hg - face) * .7; x.beginPath(); x.arc(px, py, 1 + r() * 1.6, 0, TAU); x.fill(); }
  } else {
    x.fillStyle = mix(c.face, c.face2, .5); x.globalAlpha = .55;
    x.fillRect(0, face + (Hg - face) * .5, P, U * .1); x.globalAlpha = 1;
    for (let k = 0; k < P / U * .9; k++) {
      const px = r() * P, py = face + U * .55 + r() * (Hg - face - U * .4), w = U * (.16 + r() * .2);
      wrap(px, X => {
        x.fillStyle = c.pebble; x.beginPath(); x.ellipse(X, py, w, w * .62, 0, 0, TAU); x.fill();
        x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(X - w * .25, py - w * .2, w * .35, w * .18, -.3, 0, TAU); x.fill();
      });
    }
    if (th.night) for (let k = 0; k < P / U * .6; k++) { x.fillStyle = rgba(c.dots[k % 3], .7); x.beginPath(); x.arc(r() * P, face + U * .5 + r() * (Hg - face), 1.2 + r() * 1.2, 0, TAU); x.fill(); }
  }
  // the surface laps over the face in soft scallops (frosting drips on the cake)
  const lip = th.ground === 'cake' ? c.top : mix(c.top, c.edge, .5);
  x.fillStyle = 'rgba(60,20,70,.12)'; x.beginPath();
  for (let k = 0; k <= n; k++) { x.moveTo(k * sw + sw * .55, face + U * .1); x.arc(k * sw, face + U * .1, sw * .55, 0, Math.PI); }
  x.fill();
  x.fillStyle = lip; x.beginPath();
  for (let k = 0; k <= n; k++) {
    if (th.ground === 'cake') { const len = U * (.15 + (k * 37 % 7) / 7 * .55); x.moveTo(k * sw, face); x.arc(k * sw, face, sw * .5, 0, Math.PI); x.rect(k * sw - sw * .5, face - 1, sw, 1.5); if (k % 2) { x.rect(k * sw - sw * .18, face, sw * .36, len); x.moveTo(k * sw + sw * .18, face + len); x.arc(k * sw, face + len, sw * .18, 0, Math.PI); } }
    else { x.moveTo(k * sw + sw * .55, face - 1); x.arc(k * sw, face - 1, sw * .55, 0, Math.PI); }
  }
  x.fill();
}

function buildScene(key){
  const th = theme(), W = G.W, H = G.H, U = G.U, avoid = avoidSet(), r = rng(worldId().length * 977 + 13);
  const need = [];
  const want = n => { need.push(n); return getImage(n); };
  if (th.castle || th.farB.castle) want('castle');
  for (const L of [th.farA, th.farB, th.mid]) (L.props || []).forEach(p => want(p[0]));
  const P = Math.ceil(Math.max(W, 520) / 4) * 4;
  const sc = { key, th, P, need };
  sc.sky = layer(W, H, (x, w, h) => paintSky(x, w, h, th));
  const avail = J.gTop, base = J.gTop + U * .5;
  const mk = (o, f) => { const hh = avail * o.h, Hs = Math.ceil(hh + J.ch * (o.props || o.castle || o.spooky ? 1.05 : .05)); return { cv:layer(P, Hs + U * .6, x => paintHills(x, P, Hs, hh, o, r, avoid)), y:base - Hs, f }; };
  sc.farA = mk(th.farA, .07);
  sc.farB = mk(th.farB, .16);
  sc.mid = mk(th.mid, .34);
  const gTopStrip = J.gTop - U * .45;
  sc.ground = { cv:layer(P, H - gTopStrip, (x, w, h) => paintGround(x, P, h, th, r)), y:gTopStrip, f:1 };
  // sprites
  const R = J.r;
  sc.bub = RAINBOW.map(col => sprite(R * 2 + 8, (x, o) => {
    let g = x.createRadialGradient(o - R * .35, o - R * .4, R * .1, o, o, R);
    g.addColorStop(0, mix(col, '#ffffff', .55)); g.addColorStop(.7, col); g.addColorStop(1, mix(col, '#000000', .18));
    x.beginPath(); x.arc(o, o, R, 0, TAU); x.fillStyle = g; x.fill();
    g = x.createRadialGradient(o, o - R * .2, R * .2, o, o, R * .84);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.82, '#ffffff'); g.addColorStop(1, mix(col, '#ffffff', .72));
    x.beginPath(); x.arc(o, o, R * .82, 0, TAU); x.fillStyle = g; x.fill();
    x.beginPath(); x.arc(o, o + R * .04, R * .82, Math.PI * 1.05, Math.PI * 1.95); x.lineWidth = R * .06; x.strokeStyle = rgba(mix(col, '#000000', .2), .16); x.stroke();
    x.beginPath(); x.arc(o, o, R - .8, 0, TAU); x.lineWidth = 1.6; x.strokeStyle = rgba(mix(col, '#000000', .45), .45); x.stroke();
    x.save(); x.translate(o - R * .52, o - R * .56); x.rotate(-.75); x.scale(1, .42);
    g = x.createRadialGradient(0, 0, 0, 0, 0, R * .3); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.beginPath(); x.arc(0, 0, R * .3, 0, TAU); x.fillStyle = g; x.fill(); x.restore();
    x.beginPath(); x.arc(o + R * .62, o + R * .42, R * .07, 0, TAU); x.fillStyle = 'rgba(255,255,255,.8)'; x.fill();
  }));
  sc.halo = sprite(R * 4, (x, o) => {
    const g = x.createRadialGradient(o, o, R * .7, o, o, o);
    g.addColorStop(0, 'rgba(255,226,92,.95)'); g.addColorStop(.45, 'rgba(255,214,70,.45)'); g.addColorStop(1, 'rgba(255,200,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, o * 2, o * 2);
  });
  sc.puff = sprite(64, (x, o) => {
    const g = x.createRadialGradient(o - 6, o - 8, 2, o, o, o);
    g.addColorStop(0, rgba(th.dust, 1)); g.addColorStop(.55, rgba(th.dust, .75)); g.addColorStop(1, rgba(th.dust, 0));
    x.fillStyle = g; x.fillRect(0, 0, o * 2, o * 2);
  });
  sc.shadow = sprite(64, (x, o) => {
    const g = x.createRadialGradient(o, o, 0, o, o, o); g.addColorStop(0, rgba(th.shade, th.night ? .55 : .3)); g.addColorStop(.6, rgba(th.shade, th.night ? .3 : .16)); g.addColorStop(1, rgba(th.shade, 0));
    x.fillStyle = g; x.fillRect(0, 0, o * 2, o * 2);
  });
  if (th.rays) sc.rays = sprite(U * 7, (x, o) => {
    for (let k = 0; k < 14; k++) {
      const a = k * TAU / 14, g = x.createRadialGradient(o, o, 0, o, o, o);
      g.addColorStop(0, rgba(th.rays, .7)); g.addColorStop(1, rgba(th.rays, 0));
      x.fillStyle = g; x.beginPath(); x.moveTo(o, o); x.arc(o, o, o, a, a + TAU / 28); x.closePath(); x.fill();
    }
  });
  if (th.night) sc.glow = sprite(J.ch * .9, (x, o) => {
    const g = x.createRadialGradient(o, o, 0, o, o, o); g.addColorStop(0, 'rgba(255,170,60,.55)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, o * 2, o * 2);
  });
  sc.clouds = [0, 1, 2].map(k => {
    const cw = U * (3.2 + k * .6), chh = cw * .5, rr = rng(31 + k * 11);
    return layer(cw, chh, x => {
      const blobs = []; const n = 5 + k;
      for (let q = 0; q < n; q++) { const t = q / (n - 1); blobs.push([cw * (.16 + t * .68), chh * (.68 - Math.sin(t * Math.PI) * (.24 + rr() * .14)), chh * (.2 + Math.sin(t * Math.PI) * (.16 + rr() * .1))]); }
      const g = x.createLinearGradient(0, chh * .15, 0, chh * .95); g.addColorStop(0, th.cloud[0]); g.addColorStop(.6, th.cloud[0]); g.addColorStop(1, th.cloud[1]);
      x.fillStyle = g; x.beginPath();
      for (const b of blobs) { x.moveTo(b[0] + b[2], b[1]); x.arc(b[0], b[1], b[2], 0, TAU); }
      x.rect(cw * .16, chh * .55, cw * .68, chh * .3); x.fill();
      x.fillStyle = th.night ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,.55)';
      for (const b of blobs.slice(1, -1)) { x.beginPath(); x.arc(b[0] - b[2] * .2, b[1] - b[2] * .3, b[2] * .45, 0, TAU); x.fill(); }
    });
  });
  // drifting clouds
  sc.cloudList = [];
  const span = W + U * 8, nC = Math.max(5, Math.round(W / (U * 3)));
  for (let k = 0; k < nC; k++) sc.cloudList.push({ x:k * span / nC + r() * U, y:lerp(U * .4, Math.max(U * .8, J.gTop * .55), r()), s:lerp(.65, 1.15, r()), f:lerp(.03, .07, r()), sp:lerp(4, 10, r()), k:k % 3 });
  sc.twinkles = [];
  if (th.twinkle) for (let k = 0; k < 14; k++) sc.twinkles.push({ x:r() * W, y:r() * J.gTop * .7, s:U * lerp(.08, .17, r()), ph:r() * TAU, sp:lerp(1.5, 3, r()) });
  sc.complete = need.every(n => ready(getImage(n)));
  SC = sc;
}
function ensureScene(){
  const key = [G.W, G.H, G.dpr, worldId(), store.S.ses && store.S.ses.id].join('|');
  if (!SC || SC.key !== key) buildScene(key);
  else if (!SC.complete && (G.t * 10 | 0) % 3 === 0 && SC.need.every(n => ready(getImage(n)))) buildScene(key);
}
function strip(c, L, scroll){
  const P = L.cv.w, d = G.dpr || 1;
  let x = -(scroll * L.f % P); if (x > 0) x -= P;
  x = Math.round(x * d) / d;
  for (; x < G.W; x += P) c.drawImage(L.cv, x, L.y, P, L.cv.h);
}

/* ======================= props + fliers ======================= */
function propList(kind){ const th = theme(), avoid = avoidSet(); return th[kind].filter(p => !avoid.has(p[0])); }
function spawnNear(x){
  const list = J.nearList; if (!list.length) return;
  const p = list[Math.floor(Math.random() * list.length)], s = J.ch * p[1] * lerp(.85, 1.12, Math.random());
  J.props.push({ name:p[0], x:x + s / 2, s, glow:!!p[2], flip:Math.random() < .5 && p[0] !== 'traffic-light', y:J.gTop + G.U * lerp(.05, .2, Math.random()) });
  J.nearX = x + s + J.ch * lerp(.35, 1.1, Math.random());
}
function spawnFront(x){
  const list = J.frontList; if (!list.length) return;
  const p = list[Math.floor(Math.random() * list.length)], s = J.ch * p[1] * lerp(.9, 1.15, Math.random());
  J.front.push({ name:p[0], x:x + s / 2, s, glow:!!p[2], flip:Math.random() < .5 });
  J.frontX = x + s + J.ch * lerp(1.4, 3.4, Math.random());
}
function resetWorld(){
  J.nearList = propList('near'); J.frontList = propList('front');
  J.props.length = 0; J.front.length = 0; J.nearX = -J.ch; J.frontX = G.W * .55;
  while (J.nearX < G.W + J.ch) spawnNear(J.nearX);
  J.fliers.length = 0; J.flyT = 2;
  const th = theme(), U = G.U;
  if (th.fly === 'butterfly') for (let k = 0; k < 2; k++) J.fliers.push({ kind:'butterfly', x:G.W * (.45 + k * .4), y:0, ph:k * 2.1 });
  if (th.fly === 'kite') J.fliers.push({ kind:'kite', x:G.W * .3, y:0, ph:0 });
  if (th.fly === 'confetti') for (let k = 0; k < 22; k++) J.fliers.push({ kind:'confetti', x:Math.random() * G.W, y:Math.random() * J.gTop, ph:Math.random() * TAU, col:RAINBOW[k % 7], s:U * lerp(.1, .16, Math.random()) });
}
function updateFliers(dt){
  const th = theme(), W = G.W, U = G.U;
  for (const f of J.fliers) {
    f.ph += dt;
    if (f.kind === 'butterfly') { f.x -= J.vx * dt * .35; if (f.x < -U) f.x = W + U * (1 + Math.random() * 4); }
    else if (f.kind === 'confetti') { f.y += U * .5 * dt; f.x -= J.vx * dt * .12; if (f.y > J.gTop - J.ch * .2) { f.y = -U * .3; f.x = Math.random() * W * 1.2; } if (f.x < -U) f.x += W + U * 2; }
    else if (f.kind === 'heli') f.x += U * 1.6 * dt;
    else if (f.kind === 'bat') f.x -= f.v * dt;
    else if (f.kind === 'ghost') f.x -= J.vx * .55 * dt;
  }
  for (let k = J.fliers.length - 1; k >= 0; k--) { const f = J.fliers[k]; if ((f.kind === 'heli' && f.x > W + U * 3) || ((f.kind === 'bat' || f.kind === 'ghost') && f.x < -U * 3)) J.fliers.splice(k, 1); }
  J.flyT -= dt;
  if (J.flyT <= 0) {
    if (th.fly === 'heli') { J.fliers.push({ kind:'heli', x:-U * 2, y:lerp(U * .9, J.gTop * .3, Math.random()), ph:0 }); J.flyT = lerp(9, 15, Math.random()); }
    else if (th.fly === 'bats') {
      const y = lerp(U * .9, J.gTop * .4, Math.random());
      for (let k = 0; k < 3; k++) J.fliers.push({ kind:'bat', x:W + U * (1 + k * 1.1), y:y + (k - 1) * U * .5, v:U * lerp(2.2, 2.8, Math.random()), ph:k * .7, s:U * lerp(.8, 1.05, Math.random()) });
      if (Math.random() < .6) J.fliers.push({ kind:'ghost', x:W + U * 2, y:J.gTop - J.ch * .55, ph:0 });
      J.flyT = lerp(7, 11, Math.random());
    } else J.flyT = 99;
  }
}
function drawFliers(c, sky){
  const U = G.U;
  for (const f of J.fliers) {
    const isSky = f.kind !== 'butterfly' && f.kind !== 'ghost';
    if (isSky !== sky) continue;
    if (f.kind === 'butterfly') {
      const im = getImage('butterfly'); if (!ready(im)) continue;
      const s = U * .62, y = J.gTop - J.ch * (.45 + .1 * Math.sin(f.ph * 1.3)) + Math.sin(f.ph * 3) * U * .25, flap = .3 + .7 * Math.abs(Math.sin(f.ph * 13));
      c.save(); c.translate(f.x, y); c.rotate(Math.sin(f.ph * 2) * .2); c.scale(flap, 1); c.drawImage(im, -s / 2, -s / 2, s, s); c.restore();
    } else if (f.kind === 'kite') {
      const im = getImage('kite'); if (!ready(im)) continue;
      const s = U * 1.5, x = f.x + Math.sin(f.ph * .7) * U * .6, y = U * 1.6 + Math.sin(f.ph * 1.1) * U * .35;
      c.beginPath(); c.moveTo(x - s * .1, y + s * .35); c.quadraticCurveTo(x - U * .6, y + U * 2, x - U * 2.2, y + U * 3.6); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5; c.stroke();
      c.save(); c.translate(x, y); c.rotate(Math.sin(f.ph * 1.6) * .12); c.drawImage(im, -s / 2, -s / 2, s, s); c.restore();
    } else if (f.kind === 'confetti') {
      c.save(); c.translate(f.x + Math.sin(f.ph * 1.7) * U * .3, f.y); c.rotate(f.ph * 1.3); c.scale(1, Math.cos(f.ph * 4)); c.fillStyle = f.col;
      c.beginPath(); rrect(c, -f.s, -f.s * .45, f.s * 2, f.s * .9, f.s * .4); c.fill(); c.restore();
    } else if (f.kind === 'heli') {
      const im = getImage('helicopter'); if (!ready(im)) continue;
      const s = U * 1.5; c.drawImage(im, f.x - s / 2, f.y + Math.sin(f.ph * 2.2) * U * .2 - s / 2, s, s);
    } else if (f.kind === 'bat') {
      const im = getImage('bat'); if (!ready(im)) continue;
      const s = f.s, flap = .45 + .55 * Math.abs(Math.sin(f.ph * 11));
      c.save(); c.translate(f.x, f.y + Math.sin(f.ph * 3) * U * .3); c.scale(1, flap); c.drawImage(im, -s / 2, -s / 2, s, s); c.restore();
    } else if (f.kind === 'ghost') {
      const im = getImage('ghost'); if (!ready(im)) continue;
      const s = J.ch * .45; c.globalAlpha = .85; c.drawImage(im, f.x - s / 2, f.y + Math.sin(f.ph * 2) * U * .3 - s / 2, s, s); c.globalAlpha = 1;
    }
  }
}
function drawProp(c, p, base){
  const im = p.glow ? getImage(p.name) : nightImg(p.name); if (!ready(im)) return;
  if (p.glow && SC.glow) { const gs = p.s * 2.2, pulse = 1 + Math.sin(G.t * 3 + p.x * .01) * .06; put(c, SC.glow, p.x, base - p.s * .45, gs * pulse); }
  put(c, SC.shadow, p.x, base - p.s * .02, p.s * .95, p.s * .22);
  if (p.flip) { c.save(); c.translate(p.x, 0); c.scale(-1, 1); c.drawImage(im, -p.s / 2, base - p.s * .96, p.s, p.s); c.restore(); }
  else c.drawImage(im, p.x - p.s / 2, base - p.s * .96, p.s, p.s);
}

/* ======================= bubbles ======================= */
function spawnBubble(j){
  G.items.push({ j, k:J.spawnK++, x:G.W + J.r * .8, y:J.iy, r:J.r, ph:Math.random() * TAU, mode:'live', age:0, mt:0, vx2:0, vy2:0, rot:0, alive:true });
}
function hitBubble(it){
  it.alive = false; it.mt = 0;
  if (it.j === G.target) {
    it.mode = 'pop';
    sparkle(it.x, it.y, 14);
    J.cheer = 1.3;
    for (const o of G.items) if (o !== it && o.mode === 'live') { o.mode = 'away'; o.alive = false; o.mt = 0; }
    gotIt(it.x, it.y);
  } else {
    it.mode = 'bonk'; it.vx2 = J.vx * .9 + G.U * 2; it.vy2 = -G.U * 6;
    J.dizzy = 1.1;
    oops(it.j);
  }
}
function drawBubbleAt(c, it, x, y, s, a, rot){
  const sp = SC.bub[it.k % 7], R = it.r * s;
  if (R < 1 || a <= 0) return;
  c.globalAlpha = a;
  if (rot) { c.save(); c.translate(x, y); c.rotate(rot); x = 0; y = 0; }
  const breathe = it.mode === 'live' ? 1 + Math.sin(G.t * 3.1 + it.ph) * .025 : 1;
  c.drawImage(sp, x - sp.w / 2 * s * breathe, y - sp.w / 2 * s / breathe, sp.w * s * breathe, sp.w * s / breathe);
  drawPic(c, sw(it.j), x, y + R * .02, R * 1.28);
  if (rot) c.restore();
  c.globalAlpha = 1;
}

/* ======================= the game ======================= */
function takeoff(){
  J.ground = false; J.vy = J.v0; J.buf = 0;
  J.sq = 0; J.sqv = 2.6;
  puff(J.cx - J.cw * .1, J.gy, 4, Math.PI * .92, 1.3);
  J.pet.jumpIn = .14;
  sfx.jump();
}
function land(){
  J.ground = true; J.py = 0; J.vy = 0;
  J.sqv = -3.4;
  puff(J.cx, J.gy, 7, null, 1.7);
  sfx.land?.();
  if (J.buf > 0) takeoff();
}

const jump = {
  init(){
    Object.assign(J, { scroll:0, py:0, vy:0, ground:true, buf:0, dizzy:0, cheer:0, sq:0, sqv:0, run:0, step:0, queue:[], spawnT:.5, spawnK:0 });
    J.pet = { py:0, vy:0, sq:0, sqv:0, hop:.4, jumpIn:-1 };
    for (const p of POOL) p.on = false;
    G.items = [];
    geo(); SC = null; resetWorld();
    const th = theme();
    ['butterfly', 'kite', 'helicopter', 'bat', 'ghost', 'star', 'castle'].forEach(n => getImage(n));
    th.near.concat(th.front).forEach(p => getImage(p[0]));
    if (th.sun) getImage('sun'); else getImage('moon');
    ['idle', 'jump', 'cheer'].forEach(p => avatarImage(p));
  },
  resize(){
    geo(); SC = null;
    for (const it of G.items) { it.r = J.r; it.y = J.iy; }
    resetWorld();
  },
  round(){
    for (const it of G.items) if (it.mode === 'live') { it.mode = 'away'; it.alive = false; it.mt = 0; }
    // the target comes first or second, so a new round never makes her wait long
    const q = pickSet(G.round < 2 ? 3 : 4), k = q.indexOf(G.target), to = Math.random() < .5 ? 0 : 1;
    if (k > to) { q[k] = q[to]; q[to] = G.target; }
    J.queue = q;
    J.spawnT = Math.min(J.spawnT, .45);
  },
  press(){ if (J.ground) takeoff(); else J.buf = BUFFER; },
  key(e){
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter' || e.code === 'Space') { if (!e.repeat) jump.press(); return true; }
    return false;
  },
  update(dt){
    const U = G.U, vx = J.vx;
    J.scroll += vx * dt;
    J.dizzy = Math.max(0, J.dizzy - dt); J.cheer = Math.max(0, J.cheer - dt); J.buf = Math.max(0, J.buf - dt);
    // jump physics in small fixed steps (the same steps testHint simulates)
    if (!J.ground) {
      let left = dt;
      while (left > 1e-6 && !J.ground) { const h = Math.min(left, 1 / 120); stepJump(J, h); left -= h; if (J.py <= 0 && J.vy < 0) land(); }
    } else {
      const before = Math.floor(J.run / Math.PI);
      J.run += dt * Math.PI * 2.7;
      if (Math.floor(J.run / Math.PI) !== before && !REDUCE) emit(0, J.cx - J.cw * .12, J.gy, -U * .9, -U * .2, .4, U * .24);
    }
    // squash & stretch spring
    J.sqv += (-240 * J.sq - 14 * J.sqv) * dt; J.sq += J.sqv * dt;
    // pet: little hops, a big one right after hers
    const pt = J.pet;
    if (pt.jumpIn > 0) { pt.jumpIn -= dt; if (pt.jumpIn <= 0 && pt.py <= 0) { pt.vy = J.apex * 2.3; pt.sqv = 2; } }
    if (pt.py > 0 || pt.vy > 0) { pt.vy -= J.apex * 6.5 * dt; pt.py += pt.vy * dt; if (pt.py <= 0) { pt.py = 0; pt.vy = 0; pt.sqv = -3; } }
    else { pt.hop -= dt; if (pt.hop <= 0) { pt.vy = J.apex * .95; pt.hop = .42; pt.sqv = 1.4; } }
    pt.sqv += (-260 * pt.sq - 13 * pt.sqv) * dt; pt.sq += pt.sqv * dt;
    // bubbles
    if (!G.done) {
      J.spawnT -= dt;
      if (J.spawnT <= 0) {
        if (!J.queue.length) { J.queue = pickSet(G.round < 2 ? 3 : 4); G.hint = true; }
        spawnBubble(J.queue.shift());
        J.spawnT = J.gap;
      }
    }
    let target = null, wrong = null;
    for (const it of G.items) {
      it.age += dt; it.mt += dt;
      if (it.mode === 'live') {
        it.x -= vx * dt; it.y = bobY(it, G.t);
        if (!G.done) {
          if (it.j === G.target) { if (!target && touch(it.x, it.y, it.r, J.py, true)) target = it; }
          else if (!wrong && touch(it.x, it.y, it.r, J.py, false)) wrong = it;
        }
      } else if (it.mode === 'bonk') { it.x += it.vx2 * dt - vx * dt * .3; it.y += it.vy2 * dt; it.vy2 += U * 14 * dt; it.rot += dt * 7; }
      else if (it.mode === 'away') { it.y -= U * 2.5 * dt; it.x -= vx * dt * .4; }
      else it.x -= vx * dt * .3;
    }
    if (target) hitBubble(target); else if (wrong) hitBubble(wrong);
    let n = 0;
    for (const it of G.items) {
      const gone = it.mode === 'live' ? it.x < -it.r * 1.5 : it.mode === 'pop' ? it.mt > .45 : it.mt > .9;
      if (!gone) G.items[n++] = it;
    }
    G.items.length = n;
    // props
    for (const p of J.props) p.x -= vx * dt;
    for (const p of J.front) p.x -= vx * 1.38 * dt;
    J.nearX -= vx * dt; J.frontX -= vx * 1.38 * dt;
    while (J.nearX < G.W + J.ch) spawnNear(J.nearX);
    while (J.frontX < G.W + J.ch) spawnFront(Math.max(J.frontX, G.W + 4));
    for (let k = J.props.length - 1; k >= 0; k--) if (J.props[k].x < -J.props[k].s) J.props.splice(k, 1);
    for (let k = J.front.length - 1; k >= 0; k--) if (J.front[k].x < -J.front[k].s) J.front.splice(k, 1);
    updateFliers(dt);
    // particles
    for (const p of POOL) {
      if (!p.on) continue;
      p.life += dt; if (p.life >= p.max) { p.on = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.kind === 0) { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; } else { p.vx *= 1 - 2 * dt; p.vy = p.vy * (1 - 2 * dt) + U * 3 * dt; }
    }
  },
  draw(c){
    ensureScene();
    const th = SC.th, U = G.U, W = G.W, t = G.t;
    c.drawImage(SC.sky, 0, 0, W, G.H);
    if (SC.twinkles.length) {
      c.fillStyle = th.night ? '#fff3c9' : '#ffffff';
      for (const s of SC.twinkles) { const a = .5 + .5 * Math.sin(t * s.sp + s.ph); c.globalAlpha = a * (th.night ? 1 : .8); c.beginPath(); star4(c, s.x, s.y, s.s * (.6 + a * .6)); c.fill(); }
      c.globalAlpha = 1;
    }
    const sun = J.sun;
    if (th.sun && SC.rays) { c.save(); c.translate(sun.x, sun.y); c.rotate(REDUCE ? 0 : t * .12); c.drawImage(SC.rays, -SC.rays.w / 2, -SC.rays.w / 2, SC.rays.w, SC.rays.w); c.restore(); }
    strip(c, SC.farA, J.scroll);
    // clouds drift behind the nearer hills
    const span = W + U * 8;
    c.globalAlpha = th.cloudA;
    for (const cl of SC.cloudList) {
      let x = (cl.x - J.scroll * cl.f - t * cl.sp) % span; if (x < 0) x += span; x -= U * 4;
      const cv = SC.clouds[cl.k], w = cv.w * cl.s;
      c.drawImage(cv, x, cl.y, w, cv.h * cl.s);
    }
    c.globalAlpha = 1;
    // the sun (in front of the clouds so her face always shows), or the moon
    if (th.sun) {
      const im = getImage('sun'); if (ready(im)) { const s = sun.s * (1 + Math.sin(t * 1.6) * .03); c.drawImage(im, sun.x - s / 2, sun.y - s / 2, s, s); }
    } else { const im = getImage('moon'); if (ready(im)) c.drawImage(im, sun.x - sun.s / 2, sun.y - sun.s / 2, sun.s, sun.s); }
    drawFliers(c, true);
    strip(c, SC.farB, J.scroll);
    strip(c, SC.mid, J.scroll);
    for (const p of J.props) drawProp(c, p, p.y);
    drawFliers(c, false);
    strip(c, SC.ground, J.scroll);
    // bubble shadows on the ground
    for (const it of G.items) if (it.mode === 'live') put(c, SC.shadow, it.x, J.gy + U * .12, it.r * 1.3, it.r * .3);
    // pet
    const pet = store.P.wear.pet, pt = J.pet;
    if (pet !== 'none' && PET_IMG[pet]) {
      const im = getImage(PET_IMG[pet]), ps = J.ps, px = J.cx - J.cw * .5 - ps * .22, base = J.gy - U * .1;
      put(c, SC.shadow, px, base, ps * .8 * (1 - Math.min(.5, pt.py / J.apex)), ps * .2);
      if (ready(im)) {
        const sy = 1 + pt.sq * .5, sx = 1 - pt.sq * .3;
        const face = pet === 'unicorn' || pet === 'dragon' ? -1 : 1;    // these two look left in the art: turn them to run with her
        c.save(); c.translate(px, base - pt.py); c.rotate(pt.py > 0 ? -.12 : 0); c.scale(sx * face, sy); c.drawImage(im, -ps / 2, -ps * .97, ps, ps); c.restore();
      }
    }
    // princess
    const lift = Math.min(1, J.py / J.apex);
    put(c, SC.shadow, J.cx, J.gy + U * .02, J.cw * .95 * (1 - lift * .45), U * .42 * (1 - lift * .4));
    if (th.night) { const gl = SC.glow; c.globalAlpha = .35; put(c, gl, J.cx, J.gy - J.py - J.ch * .45, J.ch * 1.3); c.globalAlpha = 1; }
    for (const p of POOL) if (p.on && p.kind === 0) { const k = p.life / p.max, s = p.s * (.6 + k * .9); c.globalAlpha = (1 - k) * .85; put(c, SC.puff, p.x, p.y - s * .3, s); }
    c.globalAlpha = 1;
    const pose = J.cheer > 0 ? 'cheer' : J.ground ? 'idle' : 'jump';
    let img = avatarImage(pose); if (!ready(img)) img = avatarImage('idle');
    let bob = 0, tilt = 0, st = 0;
    if (J.ground) { const s = Math.abs(Math.sin(J.run)); bob = s * J.ch * .045; tilt = Math.sin(J.run) * .045; st = -.05 * Math.pow(1 - s, 4) + .015 * s; }
    else { st = clamp(J.vy / J.v0, -1, 1) * .07; tilt = -clamp(J.vy / J.v0, -1, 1) * .06; }
    if (J.dizzy > 0) tilt += Math.sin(t * 14) * .07 * Math.min(1, J.dizzy * 2);
    if (REDUCE) { bob *= .4; tilt *= .4; }
    const k = J.sq + st, sy = 1 + k, sx = 1 - k * .6;
    if (ready(img)) {
      c.save(); c.translate(J.cx, J.gy - J.py - bob); c.rotate(tilt); c.scale(sx, sy);
      c.drawImage(img, -J.cw / 2, -J.ch * FEET, J.cw, J.ch); c.restore();
    }
    if (J.dizzy > 0) {
      const im = getImage('star'), ss = U * .5, a = Math.min(1, J.dizzy * 2);
      if (ready(im)) {
        c.globalAlpha = a;
        for (let q = 0; q < 3; q++) {
          const ang = t * 6 + q * TAU / 3, x = J.cx + Math.cos(ang) * J.cw * .34, y = J.gy - J.py - bob - J.ch * .98 + Math.sin(ang) * U * .18;
          c.drawImage(im, x - ss / 2, y - ss / 2, ss, ss);
        }
        c.globalAlpha = 1;
      }
    }
    // bubbles
    const glowOn = G.hint && !G.done;
    for (const it of G.items) {
      if (it.mode === 'live') {
        const s = easeBack(Math.min(1, it.age / .45));
        if (glowOn && it.j === G.target) {
          const p = (Math.sin(t * 6) + 1) / 2, hs = SC.halo.w * (1 + p * .14);
          c.globalAlpha = .55 + p * .45; put(c, SC.halo, it.x, it.y, hs); c.globalAlpha = 1;
          c.fillStyle = '#fff6c2';
          for (let q = 0; q < 4; q++) { const a = t * 1.8 + q * TAU / 4, d = it.r * 1.32; c.beginPath(); star4(c, it.x + Math.cos(a) * d, it.y + Math.sin(a) * d, U * (.12 + .08 * Math.sin(t * 7 + q))); c.fill(); }
        }
        drawBubbleAt(c, it, it.x, it.y, s, 1, 0);
      } else if (it.mode === 'pop') {
        const p = Math.min(1, it.mt / .45);
        c.beginPath(); c.arc(it.x, it.y, it.r * (1 + p * .9), 0, TAU); c.lineWidth = U * .22 * (1 - p); c.strokeStyle = `rgba(255,255,255,${1 - p})`; c.stroke();
        drawBubbleAt(c, it, it.x, it.y, 1 + p * .35, 1 - p, 0);
      } else if (it.mode === 'bonk') drawBubbleAt(c, it, it.x, it.y, 1, 1 - it.mt / .9, it.rot);
      else drawBubbleAt(c, it, it.x, it.y, 1 - it.mt * .3, 1 - it.mt / .9, 0);
    }
    for (const p of POOL) if (p.on && p.kind === 1) { const k = p.life / p.max; c.globalAlpha = 1 - k * k; c.fillStyle = p.col; c.beginPath(); star4(c, p.x, p.y, p.s * (1.2 - k * .5)); c.fill(); }
    c.globalAlpha = 1;
    // foreground props pass in front, a little faster
    for (const p of J.front) drawProp(c, p, G.H + p.s * .18);
  },
  // tests: press Space now if one press makes her meet the target bubble near the top of the jump
  testHint(){
    if (G.done || !J.ground || !SC) return null;
    const it = G.items.find(o => o.mode === 'live' && o.j === G.target);
    if (!it) return null;
    const tReach = (it.x - J.cx) / J.vx;
    if (tReach < J.tApex * .55 || tReach > J.tApex + .2) return null;
    if (!simCatch(0) || !simCatch(.12)) return null;
    return { action:'press', x:J.cx, y:J.gy - J.ch / 2 };
  },
};
// simulate a press after `delay` seconds: true if she meets the target before any other bubble
function simCatch(delay){
  const s = { py:0, vy:0 }, dt = 1 / 120; let air = false;
  for (let t = 0; t < delay + J.air + .2; t += dt) {
    if (!air && t >= delay) { air = true; s.vy = J.v0; }
    if (air) { stepJump(s, dt); if (s.py <= 0 && s.vy < 0) return false; }
    for (const it of G.items) {
      if (it.mode !== 'live') continue;
      const x = it.x - J.vx * t, y = bobY(it, G.t + t);
      if (it.j === G.target) { if (touch(x, y, it.r, s.py, true)) return true; }
      else if (touch(x, y, it.r, s.py, false)) return false;
    }
  }
  return false;
}

registerGame('jump', jump);
export const _debug = { J, scene:() => SC, tints, silhouette };
