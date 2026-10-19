// games/balloon.js (owner: balloon) — glossy picture balloons drift up through a storybook sky; pop the one you hear.
// Everything that does not change per frame (sky, hills, balloon bodies, clouds, sun/moon) is rendered once into
// offscreen canvases and blitted, so a frame is a handful of drawImage calls plus strings and particles.
import { G, registerGame, gotIt, oops, pickSet, pal } from '../engine.js';
import { store, REDUCED_MOTION as REDUCE } from '../state.js';
import { TAU, RAINBOW, shuffle } from '../data.js';
import { sfx } from '../audio.js';
import { avatarImage } from '../art.js';
import { drawPic } from '../images.js';
import { sw } from '../session.js';

/* ---------- colour helpers ---------- */
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
const rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const easeBack = t => { const s = 1.6; t -= 1; return 1 + t * t * ((s + 1) * t + s); };
const rnd = (a, b) => a + Math.random() * (b - a);
const FONT = '"Fredoka","Varela Round","Trebuchet MS",system-ui,sans-serif';

// balloon colours: candy brights by day, spooky brights at night, soft pearls in Color Land (so a pink balloon
// never competes with a colour word)
const DAY = ['#ff5fa8', '#a275ff', '#3fa9ff', '#2ec990', '#ffbf2e', '#ff7461'];
const NIGHT = ['#ff8a2a', '#9b5cff', '#6fd23f', '#ff4fa3', '#2fc4c0', '#ffc533'];
const PEARL = ['#ffd9ee', '#e3d9ff', '#d5f3e8', '#fff0c9', '#d9ecff'];

const scene = () => {
  const w = store.S.ses && store.S.ses.world;
  return w === 'halloween' ? 'night' : w === 'colors' ? 'pearl' : 'day';
};
const palette = () => { const s = scene(); return s === 'night' ? NIGHT : s === 'pearl' ? PEARL : DAY; };

/* ---------- balloon sprites (one per colour, drawn once) ---------- */
// unit space: body ≈ x ±1, y −1.12 … 1.08 (rx = 1), knot to 1.24
const K = 150;                       // sprite pixels per unit
const SPR = { w:Math.round(2.6 * K), h:Math.round(2.75 * K), ox:1.3 * K, oy:1.3 * K };
const WIN = { y:-.1, r:.64 };        // picture window
function bodyPath(c, k){
  c.beginPath();
  c.moveTo(0, -1.12 * k);
  c.bezierCurveTo(.64 * k, -1.12 * k, 1.0 * k, -.68 * k, 1.0 * k, -.12 * k);
  c.bezierCurveTo(1.0 * k, .44 * k, .56 * k, .9 * k, .07 * k, 1.07 * k);
  c.lineTo(-.07 * k, 1.07 * k);
  c.bezierCurveTo(-.56 * k, .9 * k, -1.0 * k, .44 * k, -1.0 * k, -.12 * k);
  c.bezierCurveTo(-1.0 * k, -.68 * k, -.64 * k, -1.12 * k, 0, -1.12 * k);
  c.closePath();
}
function knotPath(c, k){
  c.beginPath();
  c.moveTo(-.07 * k, 1.04 * k); c.lineTo(.07 * k, 1.04 * k);
  c.quadraticCurveTo(.1 * k, 1.13 * k, .15 * k, 1.2 * k);
  c.quadraticCurveTo(0, 1.27 * k, -.15 * k, 1.2 * k);
  c.quadraticCurveTo(-.1 * k, 1.13 * k, -.07 * k, 1.04 * k);
  c.closePath();
}
const sprites = new Map();
function balloonSprite(col, pearl){
  const key = col + (pearl ? 'p' : '');
  let cv = sprites.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = SPR.w; cv.height = SPR.h;
  const c = cv.getContext('2d'), k = K;
  c.translate(SPR.ox, SPR.oy);
  const dark = mix(col, '#2a1240', pearl ? .22 : .3), deep = mix(col, '#2a1240', pearl ? .35 : .45);
  // soft drop shadow
  c.save(); c.shadowColor = 'rgba(60,30,90,.25)'; c.shadowBlur = .16 * k; c.shadowOffsetY = .1 * k;
  bodyPath(c, k); c.fillStyle = col; c.fill(); c.restore();
  // knot
  knotPath(c, k); c.fillStyle = dark; c.fill();
  c.beginPath(); c.ellipse(-.03 * k, 1.1 * k, .035 * k, .05 * k, -.4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
  // body: lit from the top left
  let g = c.createRadialGradient(-.4 * k, -.55 * k, .05 * k, -.15 * k, -.15 * k, 1.5 * k);
  g.addColorStop(0, mix(col, '#ffffff', pearl ? .75 : .55)); g.addColorStop(.38, col);
  g.addColorStop(.8, mix(col, '#2a1240', pearl ? .1 : .16)); g.addColorStop(1, dark);
  bodyPath(c, k); c.fillStyle = g; c.fill();
  c.save(); bodyPath(c, k); c.clip();
  // reflected light on the lower right rim
  g = c.createRadialGradient(.62 * k, .55 * k, 0, .62 * k, .55 * k, .6 * k);
  g.addColorStop(0, 'rgba(255,255,255,.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(-k, -1.2 * k, 2 * k, 2.4 * k);
  if (pearl) {   // pearly sheen bands
    g = c.createLinearGradient(-k, -k, k, k);
    g.addColorStop(0, 'rgba(255,190,235,.35)'); g.addColorStop(.35, 'rgba(190,230,255,.0)');
    g.addColorStop(.6, 'rgba(200,255,230,.3)'); g.addColorStop(1, 'rgba(220,200,255,.35)');
    c.fillStyle = g; c.fillRect(-k, -1.2 * k, 2 * k, 2.4 * k);
  }
  c.restore();
  // crisp outline
  bodyPath(c, k); c.lineWidth = .035 * k; c.strokeStyle = rgba(deep, .45); c.stroke();
  // picture window: lighter rim, then a soft white disc with a faint inner shade
  const wy = WIN.y * k, wr = WIN.r * k;
  c.beginPath(); c.arc(0, wy, wr + .07 * k, 0, TAU); c.fillStyle = rgba(mix(col, '#ffffff', .55), .95); c.fill();
  c.beginPath(); c.arc(0, wy, wr + .07 * k, 0, TAU); c.lineWidth = .02 * k; c.strokeStyle = rgba(deep, .25); c.stroke();
  g = c.createRadialGradient(0, wy - .12 * k, wr * .2, 0, wy, wr);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.72, pearl ? '#fbf8ff' : '#ffffff'); g.addColorStop(1, pearl ? '#e4dcf5' : mix(col, '#ffffff', .78));
  c.beginPath(); c.arc(0, wy, wr, 0, TAU); c.fillStyle = g; c.fill();
  // inner shadow at the top of the window (the window sits slightly inside the balloon)
  c.save(); c.beginPath(); c.arc(0, wy, wr, 0, TAU); c.clip();
  c.beginPath(); c.arc(0, wy + .07 * k, wr + .02 * k, 0, TAU); c.lineWidth = .07 * k; c.strokeStyle = rgba(deep, .14); c.stroke();
  c.restore();
  sprites.set(key, cv);
  return cv;
}
// glass glare + body specular, drawn over the picture (shared by every colour)
let glossCv = null;
function glossSprite(){
  if (glossCv) return glossCv;
  glossCv = document.createElement('canvas'); glossCv.width = SPR.w; glossCv.height = SPR.h;
  const c = glossCv.getContext('2d'), k = K;
  c.translate(SPR.ox, SPR.oy);
  const wy = WIN.y * k, wr = WIN.r * k;
  // window glare: a soft crescent on the upper left of the glass
  c.save(); c.beginPath(); c.arc(0, wy, wr, 0, TAU); c.clip();
  c.beginPath(); c.arc(0, wy, wr * .9, Math.PI * 1.02, Math.PI * 1.58); c.arc(wr * .1, wy + wr * .12, wr * .86, Math.PI * 1.5, Math.PI * 1.08, true); c.closePath();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
  c.beginPath(); c.arc(wr * .62, wy + wr * .5, wr * .07, 0, TAU); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
  c.restore();
  // big body specular
  c.save(); c.translate(-.66 * k, -.52 * k); c.rotate(.55);
  let g = c.createRadialGradient(0, 0, 0, 0, 0, .24 * k);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.55, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.scale(.45, 1); c.beginPath(); c.arc(0, 0, .24 * k, 0, TAU); c.fillStyle = g; c.fill(); c.restore();
  c.beginPath(); c.arc(-.32 * k, -.95 * k, .055 * k, 0, TAU); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
  return glossCv;
}
// golden halo for the hint
let glowCv = null;
function glowSprite(){
  if (glowCv) return glowCv;
  glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 256;
  const c = glowCv.getContext('2d'), g = c.createRadialGradient(128, 128, 30, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,240,150,.95)'); g.addColorStop(.45, 'rgba(255,214,80,.6)'); g.addColorStop(1, 'rgba(255,190,60,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  return glowCv;
}

/* ---------- scenery (rebuilt on resize / world change) ---------- */
const SC = { key:'', bg:null, fg:null, sun:null, sunCore:null, clouds:[], cloudSpr:[], stars:[], hillA:null, sunR:0, sunX:0, sunY:0 };
// puffs in sprite pixels (300×200), all inside the canvas so no puff gets cut flat
const CLOUD_SHAPES = [
  [[62, 124, 44], [118, 92, 58], [186, 96, 52], [244, 126, 38], [150, 132, 40]],
  [[70, 122, 46], [134, 96, 56], [204, 116, 46], [150, 134, 36], [96, 136, 32]],
  [[48, 132, 30], [96, 108, 44], [156, 86, 58], [220, 108, 46], [262, 134, 28], [160, 136, 34]],
];
function cloudSprite(shape, night){
  const W = 300, H = 200, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const path = (dy = 0) => { c.beginPath(); for (const [x, y, r] of shape) { c.moveTo(x + r, y + dy); c.arc(x, y + dy, r, 0, TAU); } };
  const g = c.createLinearGradient(0, 30, 0, 170);
  if (night) { g.addColorStop(0, 'rgba(160,130,215,.42)'); g.addColorStop(1, 'rgba(95,65,150,.3)'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#fefbff'); g.addColorStop(1, '#eee3ff'); }
  if (!night) { c.save(); c.shadowColor = 'rgba(140,100,190,.2)'; c.shadowBlur = 14; c.shadowOffsetY = 7; path(); c.fillStyle = '#fff'; c.fill(); c.restore(); }
  path(); c.fillStyle = g; c.fill();
  return cv;
}
function hillTop(h, x){ const d = (x - h.cx) / h.rx; return Math.abs(d) >= 1 ? Infinity : h.cy - h.ry * Math.sqrt(1 - d * d); }
function buildScene(){
  const W = G.W, H = G.H, dpr = G.dpr, sc = scene(), p = pal();
  const key = [W, H, dpr, sc, p.sky[0], p.ground].join('|');
  if (key === SC.key) return;
  SC.key = key;
  const night = sc === 'night';
  const mk = () => { const n = document.createElement('canvas'); n.width = Math.round(W * dpr); n.height = Math.round(H * dpr); return n; };
  // --- background: sky, rainbow / stars, far hills
  const bg = mk(), c = bg.getContext('2d'); c.scale(dpr, dpr);
  let g = c.createLinearGradient(0, 0, 0, H);
  if (night) { g.addColorStop(0, '#170c30'); g.addColorStop(.55, p.sky[0]); g.addColorStop(1, '#6a3a8e'); }
  else { g.addColorStop(0, p.sky[0]); g.addColorStop(.7, p.sky[1]); g.addColorStop(1, mix(p.sky[1], '#ffffff', .45)); }
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const M = Math.min(W, H);
  if (!night) {
    // pastel rainbow arc behind everything
    const R = Math.max(W * .62, H * .55), cx = W * .18, cy = H * 1.02, bw = R * .045;
    c.save(); c.globalAlpha = .32; c.lineCap = 'round';
    RAINBOW.forEach((col, i) => { c.beginPath(); c.arc(cx, cy, R - i * bw, Math.PI * 1.02, Math.PI * 1.98); c.lineWidth = bw + 1; c.strokeStyle = mix(col, '#ffffff', .25); c.stroke(); });
    c.restore();
    // haze dots (very soft bokeh)
    for (let i = 0; i < 14; i++) { const x = (i * 97.3 % 1) * W, y = ((i * 61.7 + .3) % 1) * H * .7, r = M * (.015 + (i % 4) * .01); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = 'rgba(255,255,255,.28)'; c.fill(); }
  } else {
    // static faint star field
    for (let i = 0; i < 70; i++) { const x = Math.random() * W, y = Math.random() * H * .75, r = Math.random() * 1.2 + .4; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = `rgba(255,240,210,${.25 + Math.random() * .4})`; c.fill(); }
  }
  // far hills
  const hb = night ? ['#3e2763', '#33205a'] : [mix(p.hill, '#ffffff', .25), mix(p.hill, p.sky[1], .3)];
  const farH = clamp(H * .2, 90, 190);
  c.fillStyle = hb[1];
  c.beginPath(); c.ellipse(W * .9, H + farH * .25, W * .55, farH * 1.05, 0, 0, TAU); c.fill();
  c.fillStyle = hb[0];
  c.beginPath(); c.ellipse(W * .28, H + farH * .3, W * .6, farH, 0, 0, TAU); c.fill();
  SC.bg = bg;

  // --- foreground hills (balloons rise from behind them; the princess stands on the left one)
  const fg = mk(), f = fg.getContext('2d'); f.scale(dpr, dpr);
  const hA = clamp(H * .11, 52, 100);
  const A = { cx:Math.min(W * .16, 150), cy:H + hA * .12, rx:Math.max(W * .5, 230), ry:hA };
  const B = { cx:W * .82, cy:H + hA * .2, rx:Math.max(W * .55, 240), ry:hA * .78 };
  SC.hillA = A; SC.hillB = B; SC.hillH = hA;
  const gc = night ? ['#4b2f78', '#2c1b4a'] : (p.road ? ['#b5ecc3', '#86d9a2'] : [p.ground, p.ground2]);
  const hill = (h, c0, c1) => {
    const gr = f.createLinearGradient(0, h.cy - h.ry, 0, H); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    f.beginPath(); f.ellipse(h.cx, h.cy, h.rx, h.ry, 0, 0, TAU); f.fillStyle = gr; f.fill();
    // glossy rim light along the top
    f.save(); f.beginPath(); f.ellipse(h.cx, h.cy, h.rx, h.ry, 0, 0, TAU); f.clip();
    f.beginPath(); f.ellipse(h.cx, h.cy + 4, h.rx - 2, h.ry - 2, 0, Math.PI * 1.05, Math.PI * 1.95); f.lineWidth = 5; f.strokeStyle = night ? 'rgba(200,170,255,.35)' : 'rgba(255,255,255,.55)'; f.stroke();
    f.restore();
  };
  hill(B, mix(gc[0], night ? '#000000' : '#ffffff', night ? .1 : .12), mix(gc[1], '#ffffff', night ? 0 : .1));
  hill(A, gc[0], gc[1]);
  // flowers / grass tufts
  const fl = night ? ['#9b7bd4', '#ff9a3c', '#c6b2f0'] : ['#ffffff', '#ff8fc4', '#ffe066', '#c7a6ff'];
  for (let i = 0; i < Math.round(W / 26); i++) {
    const x = (i + .5) * W / Math.round(W / 26) + Math.sin(i * 12.9) * 9;
    const top = Math.min(hillTop(A, x), hillTop(B, x));
    if (!isFinite(top) || top > H - 6) continue;
    const y = top + 8 + Math.abs(Math.sin(i * 7.3)) * Math.min(26, (H - top) * .5), r = M * (.009 + .004 * (i % 3));
    if (night) {   // tiny glowing lantern-bugs in the grass
      if (i % 2) continue;
      const gg = f.createRadialGradient(x, y, 0, x, y, r * 3); gg.addColorStop(0, i % 4 ? 'rgba(255,190,90,.7)' : 'rgba(200,160,255,.7)'); gg.addColorStop(1, 'rgba(255,190,90,0)');
      f.fillStyle = gg; f.beginPath(); f.arc(x, y, r * 3, 0, TAU); f.fill();
      f.fillStyle = i % 4 ? '#ffd59a' : '#e6d6ff'; f.beginPath(); f.arc(x, y, r * .55, 0, TAU); f.fill(); continue;
    }
    f.fillStyle = fl[i % 4];
    for (let q = 0; q < 5; q++) { const a = q * TAU / 5 + i; f.beginPath(); f.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .72, 0, TAU); f.fill(); }
    f.beginPath(); f.arc(x, y, r * .55, 0, TAU); f.fillStyle = '#ffd23f'; f.fill();
  }
  SC.fg = fg;

  // --- sun (day) or crescent moon (night)
  SC.sunR = clamp(M * .085, 26, 60); SC.sunX = W - SC.sunR * 1.9; SC.sunY = SC.sunR * 1.9;
  const S = Math.ceil(SC.sunR * 3.2 * dpr), sun = document.createElement('canvas'); sun.width = sun.height = S * 2;
  const s = sun.getContext('2d'); s.translate(S, S); s.scale(dpr, dpr);
  const r = SC.sunR;
  if (!night) {
    g = s.createRadialGradient(0, 0, r * .6, 0, 0, r * 3); g.addColorStop(0, 'rgba(255,236,150,.75)'); g.addColorStop(1, 'rgba(255,236,150,0)');
    s.fillStyle = g; s.beginPath(); s.arc(0, 0, r * 3, 0, TAU); s.fill();
    s.fillStyle = 'rgba(255,214,90,.55)';
    for (let i = 0; i < 12; i++) { s.save(); s.rotate(i * TAU / 12); const L = i % 2 ? r * 1.65 : r * 2; s.beginPath(); s.moveTo(-r * .2, -r * 1.05); s.quadraticCurveTo(0, -L - r * .1, r * .2, -r * 1.05); s.fill(); s.restore(); }
  } else {
    g = s.createRadialGradient(0, 0, r * .5, 0, 0, r * 3); g.addColorStop(0, 'rgba(255,240,200,.45)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    s.fillStyle = g; s.beginPath(); s.arc(0, 0, r * 3, 0, TAU); s.fill();
  }
  SC.sun = sun;
  const core = document.createElement('canvas'); core.width = core.height = S * 2;
  const o = core.getContext('2d'); o.translate(S, S); o.scale(dpr, dpr);
  if (!night) {
    g = o.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); g.addColorStop(0, '#fffbe0'); g.addColorStop(.5, '#ffe36b'); g.addColorStop(1, '#ffc23a');
    o.beginPath(); o.arc(0, 0, r, 0, TAU); o.fillStyle = g; o.fill();
    o.lineWidth = r * .08; o.strokeStyle = 'rgba(255,170,40,.5)'; o.stroke();
    o.beginPath(); o.ellipse(-r * .38, -r * .42, r * .22, r * .13, -.6, 0, TAU); o.fillStyle = 'rgba(255,255,255,.75)'; o.fill();
  } else {
    g = o.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#ffe39a');
    o.beginPath(); o.arc(0, 0, r, 0, TAU); o.fillStyle = g; o.fill();
    o.globalCompositeOperation = 'destination-out';
    o.beginPath(); o.arc(r * .48, -r * .3, r * .9, 0, TAU); o.fill();
    o.globalCompositeOperation = 'source-over';
  }
  SC.sunCore = core;

  // clouds and twinkling stars
  SC.cloudSpr = CLOUD_SHAPES.map(sh => cloudSprite(sh, night));
  const nC = W > 700 ? 6 : 4;
  SC.clouds = [];
  for (let i = 0; i < nC; i++) {
    const far = i % 2 === 1, w = (far ? rnd(.26, .34) : rnd(.38, .5)) * Math.min(W, 620);
    SC.clouds.push({ x:(i + Math.random() * .6) / nC * (W + w) - w * .5, y:H * (far ? rnd(.05, .3) : rnd(.18, .55)), w, v:(far ? 5 : 11) * (REDUCE ? .3 : 1), spr:i % 3, a:far ? .7 : .95 });
  }
  SC.stars = [];
  if (night) for (let i = 0; i < 16; i++) SC.stars.push({ x:Math.random() * W, y:Math.random() * H * .6, r:rnd(2.5, 5.5), ph:Math.random() * TAU, sp:rnd(1.2, 2.6) });
}
function drawSparkle(c, x, y, r){
  c.beginPath(); c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * .18, y - r * .18, x + r, y); c.quadraticCurveTo(x + r * .18, y + r * .18, x, y + r);
  c.quadraticCurveTo(x - r * .18, y + r * .18, x - r, y); c.quadraticCurveTo(x - r * .18, y - r * .18, x, y - r);
  c.fill();
}
function drawBack(c){
  const night = scene() === 'night';
  c.drawImage(SC.bg, 0, 0, G.W, G.H);
  // sun / moon
  const S = SC.sun.width / G.dpr, half = S / 2;
  c.save(); c.translate(SC.sunX, SC.sunY);
  if (!night && !REDUCE) c.rotate(G.t * .12);
  c.drawImage(SC.sun, -half, -half, S, S);
  c.restore();
  const bob = REDUCE ? 0 : Math.sin(G.t * 1.2) * 2;
  c.drawImage(SC.sunCore, SC.sunX - half, SC.sunY - half + bob, S, S);
  if (night) {
    c.fillStyle = '#fff4cf';
    for (const s of SC.stars) { c.globalAlpha = .35 + .65 * (.5 + .5 * Math.sin(G.t * s.sp + s.ph)); drawSparkle(c, s.x, s.y, s.r); }
    c.globalAlpha = 1;
  }
  // clouds drift to the right and wrap
  for (const cl of SC.clouds) {
    const spr = SC.cloudSpr[cl.spr], h = cl.w * spr.height / spr.width;
    c.globalAlpha = cl.a; c.drawImage(spr, cl.x, cl.y, cl.w, h);
  }
  c.globalAlpha = 1;
}

/* ---------- layout ---------- */
const L = { lanes:[], rx:50, spacing:300, v:40, hb:200, ys:0 };
function layout(){
  const W = G.W, H = G.H;
  const n = clamp(Math.floor(W / 165), 2, 5), laneW = W / n;
  L.rx = clamp(Math.min(laneW * .4, H * .13), 34, 92);
  L.hb = L.rx * (2.25 + 1.45);                    // body + string
  const perLane = n <= 2 ? 2.4 : n === 3 ? 1.9 : n === 4 ? 1.5 : 1.3;
  L.spacing = Math.max(L.hb * 1.2, (H + L.hb) / perLane);
  L.v = (H + L.hb) / 16;                          // ~16 s from bottom to top
  L.ys = H + L.rx * 1.25;                         // spawn: body just below the bottom edge
  const phases = [[0, .5], [0, .55, .25], [0, .5, .25, .75], [0, .5, .2, .7, .4]][n - 2];
  const old = L.lanes;
  L.lanes = [];
  for (let i = 0; i < n; i++) {
    // keep the outer balloons clear of the field's rounded edge
    const x = laneW * (i + .5) + (i === 0 ? laneW * .04 : i === n - 1 ? -laneW * .04 : 0);
    L.lanes.push({ i, x, ph:phases[i], v:L.v * (1 + (i % 2 ? .06 : -.04)), dist:old[i] ? old[i].dist : 0, last:-1 });
  }
}

/* ---------- balloons ---------- */
let seq = 0;
// the colour least used by the balloons in flight (never the one just above in this lane)
function pickColour(pl, lane){
  let best = pl[0], bc = 1e9;
  for (const col of shuffle(pl)) {
    if (col === lane.lastCol) continue;
    let c = 0; for (const b of G.items) if (b.alive && b.col === col) c++;
    if (c < bc) { bc = c; best = col; }
  }
  return best;
}
function makeBalloon(lane, y, j){
  const pl = palette(), b = {
    id:++seq, lane, j, w:j >= 0 ? sw(j) : null, y, alive:true, leave:0, ent:1, entDelay:0,
    s:rnd(.9, 1.04), ph:Math.random() * TAU, col:pickColour(pl, lane), wob:0, wobT:0, sq:0,
  };
  lane.lastCol = b.col; lane.last = j;
  G.items.push(b);
  return b;
}
const bR = b => L.rx * b.s;
const swayAmp = () => L.rx * (REDUCE ? .03 : .11);
const bX = b => b.lane.x + Math.sin(G.t * .85 + b.ph) * swayAmp();
const bAng = b => (REDUCE ? 0 : Math.cos(G.t * .85 + b.ph) * .07) + Math.sin(b.wobT * 26) * b.wob * .24;
function bY(b){ return b.y + (b.ent < 1 ? (1 - easeBack(Math.max(0, b.ent))) * G.H * 1.05 : 0); }

// a target that stays on screen for a while: in the lower part of the field (or still entering)
function needTarget(){
  if (G.done) return false;
  return !G.items.some(b => b.alive && b.j === G.target && b.y > G.H * .56);
}
// the princess stands at the bottom of lane 0, so new targets prefer the other lanes
const targetLane = lane => lane.i !== 0 || L.lanes.length < 2;
function wordFor(lane){
  if (needTarget()) return G.target;
  const counts = new Map();
  for (const b of G.items) if (b.alive) counts.set(b.j, (counts.get(b.j) || 0) + 1);
  let best = null, bc = 1e9;
  for (const j of shuffle(G.pool)) {
    if (j === G.target || j === lane.last) continue;
    const c = counts.get(j) || 0;
    if (c < bc) { bc = c; best = j; }
  }
  return best == null ? G.pool.find(j => j !== G.target) ?? G.target : best;
}

// fill the field for a new round; balloons swoop up from below with a springy overshoot
function fillRound(animate){
  layout();
  const fresh = [];
  for (const lane of L.lanes) {
    let y = L.rx * 1.45 + lane.ph * L.spacing + rnd(-.04, .04) * L.spacing;
    lane.last = -1;
    while (y <= L.ys) { fresh.push(makeBalloon(lane, y, -1)); y += L.spacing; }
    lane.dist = y - L.ys;
  }
  // the target goes on the lowest fully visible balloon (longest time on screen), away from the princess if possible
  const vis = fresh.filter(b => b.y - bR(b) * 1.15 > 0 && b.y + bR(b) * 1.15 < G.H - SC.hillH);
  const pref = vis.filter(b => targetLane(b.lane));
  const tgt = (pref.length ? pref : vis.length ? vis : fresh).reduce((a, b) => b.y > a.y ? b : a);
  const others = shuffle(G.pool.filter(j => j !== G.target));
  let k = 0;
  for (const b of fresh.sort((a, c) => a.y - c.y)) {
    b.j = b === tgt ? G.target : others[k++ % Math.max(1, others.length)] ?? G.target;
    b.w = sw(b.j);
    if (animate) { b.ent = 0; b.entDelay = (b.lane.i * .07 + (b.y / G.H) * .25); }
  }
}

/* ---------- pop effects ---------- */
const pops = [];
function addPop(b, x, y){
  const r = bR(b), bits = [], conf = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU + rnd(-.25, .25), sp = r * rnd(3, 5.5);
    bits.push({ x:0, y:0, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - r * 1.5, rot:a, vr:rnd(-9, 9), s:r * rnd(.18, .3) });
  }
  const nConf = REDUCE ? 8 : 26;
  for (let i = 0; i < nConf; i++) {
    const a = rnd(0, TAU), sp = r * rnd(1.5, 5);
    conf.push({ x:0, y:0, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - r * 3, rot:rnd(0, TAU), vr:rnd(-8, 8), w:r * rnd(.1, .16), c:RAINBOW[i % 7], ph:rnd(0, TAU), shape:i % 3 });
  }
  pops.push({ x, y, r, col:b.col, w:b.w, t:0, bits, conf, tilt:rnd(-.18, .08) });
}
function updatePops(dt){
  let n = 0;
  for (const p of pops) {
    p.t += dt;
    if (p.t > 1.8) continue;
    pops[n++] = p;
    for (const q of p.bits) { q.vy += p.r * 9 * dt; q.vx *= 1 - 1.5 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; }
    for (const q of p.conf) { q.vy += p.r * 4 * dt; q.vx *= 1 - 2.2 * dt; q.vy *= 1 - 1.2 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; }
  }
  pops.length = n;
}
function starPath(c, n, R, r){
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r : R * (i % 4 === 0 ? 1 : .9), a = i * Math.PI / n - Math.PI / 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath();
}
function drawPops(c){
  for (const p of pops) {
    const t = p.t, r = p.r;
    c.save(); c.translate(p.x, p.y);
    // expanding ring
    if (t < .4) { const e = easeOut(t / .4); c.beginPath(); c.arc(0, 0, r * (.9 + 1.3 * e), 0, TAU); c.lineWidth = r * .16 * (1 - e); c.strokeStyle = `rgba(255,255,255,${1 - e})`; c.stroke(); }
    // comic burst shape (the POP! word is drawn last, on top)
    const bs = t < .24 ? easeBack(t / .24) : 1, ba = Math.max(0, t < .7 ? 1 : 1 - (t - .7) / .35);
    if (t < 1.05) {
      c.save(); c.globalAlpha = ba; c.rotate(p.tilt); c.scale(bs, bs);
      starPath(c, 12, r * 1.35, r * .95); c.fillStyle = '#ffe24d'; c.fill(); c.lineWidth = r * .07; c.lineJoin = 'round'; c.strokeStyle = '#ff9a1f'; c.stroke();
      starPath(c, 12, r * 1.08, r * .78); c.fillStyle = '#fff6c4'; c.fill();
      c.restore();
    }
    // rubber shreds
    if (t < .9) {
      c.globalAlpha = t < .55 ? 1 : 1 - (t - .55) / .35; c.fillStyle = p.col;
      for (const q of p.bits) {
        c.save(); c.translate(q.x, q.y); c.rotate(q.rot);
        c.beginPath(); c.moveTo(-q.s, 0); c.quadraticCurveTo(0, -q.s * .9, q.s, 0); c.quadraticCurveTo(0, -q.s * .35, -q.s, 0); c.fill();
        c.restore();
      }
      c.globalAlpha = 1;
    }
    // confetti
    for (const q of p.conf) {
      c.globalAlpha = t < 1.2 ? 1 : Math.max(0, 1 - (t - 1.2) / .6);
      c.save(); c.translate(q.x + Math.sin(t * 6 + q.ph) * r * .15, q.y); c.rotate(q.rot); c.scale(1, Math.cos(t * 9 + q.ph));
      c.fillStyle = q.c;
      if (q.shape === 0) c.fillRect(-q.w, -q.w * .55, q.w * 2, q.w * 1.1);
      else if (q.shape === 1) { c.beginPath(); c.arc(0, 0, q.w * .8, 0, TAU); c.fill(); }
      else drawSparkle(c, 0, 0, q.w * 1.3);
      c.restore();
    }
    c.globalAlpha = 1;
    // the picture floats up as a sticker
    if (t < 1.5) {
      const e = easeOut(Math.min(1, t / .6)), a = t < 1 ? 1 : 1 - (t - 1) / .5, size = r * (1.15 + .35 * e), y = -r * 1.5 * e;
      c.globalAlpha = Math.max(0, a);
      const gl = glowSprite(); c.drawImage(gl, -size, y - size, size * 2, size * 2);
      drawPic(c, p.w, 0, y, size);
      c.globalAlpha = 1;
    }
    if (t < 1.05) {
      c.save(); c.globalAlpha = ba; c.rotate(p.tilt); c.scale(bs, bs); c.translate(0, r * .3);
      c.font = `700 ${Math.round(r * .66)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = r * .2; c.strokeStyle = '#ffffff'; c.strokeText('POP!', 0, 0);
      c.fillStyle = '#7a2fd0'; c.fillText('POP!', r * .035, r * .045);
      c.fillStyle = '#ff3d8f'; c.fillText('POP!', 0, 0);
      c.restore();
    }
    c.restore();
  }
}

/* ---------- drawing one balloon ---------- */
function drawString(c, b, kx, ky, r, ang){
  const len = r * 1.45, seg = 14, amp = r * .075, t = G.t * 2.2 + b.ph;
  const drift = -Math.cos(G.t * .85 + b.ph) * r * .18 * (REDUCE ? 0 : 1);
  c.beginPath(); c.moveTo(kx, ky);
  for (let i = 1; i <= seg; i++) {
    const s = i / seg;
    c.lineTo(kx + Math.sin(s * 9 + t) * amp * (.35 + s) + drift * s * s - Math.sin(ang) * len * s * .3, ky + s * len);
  }
  c.lineWidth = Math.max(1.6, r * .035); c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = scene() === 'night' ? 'rgba(255,240,220,.6)' : rgba(mix(b.col, '#4a2b5e', .35), .6);
  c.stroke();
}
function drawBalloon(c, b, alpha){
  const r = bR(b), x = bX(b) + Math.sin(b.wobT * 40) * b.wob * r * .1, y = bY(b), ang = bAng(b);
  if (y - r * 1.3 > G.H || y + r * 3 < 0) return;
  c.globalAlpha = alpha;
  const kx = x - Math.sin(ang) * r * 1.22, ky = y + Math.cos(ang) * r * 1.22;
  drawString(c, b, kx, ky, r, ang);
  if (b.alive && b.j === G.target && G.hint && !G.done) {
    const p = (Math.sin(G.t * 6) + 1) / 2, gs = r * (1.75 + p * .2);
    c.globalAlpha = alpha * (.65 + .35 * p);
    c.drawImage(glowSprite(), x - gs, y - gs * 1.05, gs * 2, gs * 2.1);
    c.globalAlpha = alpha;
  }
  const k = r / K, sq = b.sq > 0 ? Math.sin(b.sq * Math.PI) * .08 : 0;
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(1 + sq, 1 - sq);
  c.drawImage(balloonSprite(b.col, scene() === 'pearl'), -SPR.ox * k, -SPR.oy * k, SPR.w * k, SPR.h * k);
  drawPic(c, b.w, 0, WIN.y * r, r * 1.2);
  c.drawImage(glossSprite(), -SPR.ox * k, -SPR.oy * k, SPR.w * k, SPR.h * k);
  c.restore();
  // hint sparkles orbiting the target
  if (b.alive && b.j === G.target && G.hint && !G.done) {
    c.fillStyle = '#fff3b0';
    for (let i = 0; i < 4; i++) {
      const a = G.t * 1.6 + i * TAU / 4, rr = r * (1.35 + .1 * Math.sin(G.t * 4 + i));
      drawSparkle(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 1.15, r * (.12 + .06 * Math.sin(G.t * 7 + i * 2)));
    }
  }
  c.globalAlpha = 1;
}

/* ---------- the princess ---------- */
let cheerAt = -9;
function drawPrincess(c){
  const A = SC.hillA, h = clamp(G.H * .24, 118, 230), w = h * 2 / 3;
  const x = Math.max(6, A.cx - w * .62), feet = hillTop(A, x + w / 2) + h * .03;
  const ct = G.t - cheerAt, cheering = ct >= 0 && ct < 1.7;
  const img = avatarImage(cheering ? 'cheer' : 'idle');
  const hop = cheering && !REDUCE ? Math.abs(Math.sin(Math.min(ct, 1.2) / 1.2 * Math.PI * 2)) * h * .1 : 0;
  const breathe = REDUCE ? 0 : Math.sin(G.t * 2.4) * .012;
  // soft contact shadow
  c.beginPath(); c.ellipse(x + w / 2, feet - h * .015, w * .32 * (1 - hop / h), h * .035, 0, 0, TAU);
  c.fillStyle = scene() === 'night' ? 'rgba(10,0,30,.35)' : 'rgba(60,90,60,.22)'; c.fill();
  if (img && img.complete && img.naturalWidth) {
    const hh = h * (1 + breathe), ww = w * (1 - breathe * .5);
    c.drawImage(img, x + (w - ww) / 2, feet - hh - hop, ww, hh);
  }
}

/* ---------- game ---------- */
let lastOops = -9;
const balloon = {
  init(){
    G.items = []; pops.length = 0; cheerAt = -9; lastOops = -9; L.lanes = []; SC.key = '';
    avatarImage('idle'); avatarImage('cheer');
    palette().forEach(col => balloonSprite(col, scene() === 'pearl')); glossSprite(); glowSprite();
    buildScene(); layout();
  },
  resize(){
    const oldN = L.lanes.length;
    buildScene();
    layout();
    if (L.lanes.length !== oldN && G.pool) {
      // lane count changed (rotation): lay the round out again without the swoop
      G.items = G.items.filter(b => !b.alive);
      fillRound(false);
    } else for (const b of G.items) b.lane = L.lanes[b.lane.i] || L.lanes[0];
  },
  round(){
    // the old bunch drifts away fast; a new bunch swoops in from below
    for (const b of G.items) if (b.alive) { b.alive = false; b.leave = 1; }
    const n = Math.min(G.round < 2 ? 4 : 5, store.S.ses.words.length);
    G.pool = pickSet(n);
    buildScene();
    fillRound(true);
  },
  press(x, y){
    if (G.done) return;
    let best = null, bd = 1;
    for (const b of G.items) {
      if (!b.alive || b.ent < .8) continue;
      const r = bR(b), cx = bX(b), cy = bY(b);
      // generous: 1.3× the body, and down over the knot
      const dx = (x - cx) / (r * 1.3), dy = (y - cy) / (r * (y > cy ? 1.75 : 1.45));
      const d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = b; }
    }
    if (!best) return;
    if (best.j === G.target) {
      const px = bX(best), py = bY(best);
      best.alive = false; best.popped = true;
      addPop(best, px, py);
      cheerAt = G.t;
      sfx.pop();
      gotIt(px, py);
    } else {
      best.wob = 1; best.wobT = 0; best.sq = 1;
      if (G.t - lastOops > .7) { lastOops = G.t; oops(best.j); }
    }
  },
  update(dt){
    if (!L.lanes.length) return;
    const slow = G.hint && !G.done ? .65 : 1;
    for (const cl of SC.clouds) { cl.x += cl.v * dt; if (cl.x > G.W + 10) cl.x = -cl.w - 10; }
    for (const b of G.items) {
      if (b.leave) { b.leave += dt; b.y -= (L.v + G.H * 2.2 * (b.leave - 1)) * dt; continue; }
      if (b.ent < 1) { if (b.entDelay > 0) b.entDelay -= dt; else b.ent = Math.min(1, b.ent + dt / 1.05); }
      b.y -= b.lane.v * slow * dt;
      if (b.wob > 0) { b.wob = Math.max(0, b.wob - dt * 1.6); b.wobT += dt; }
      if (b.sq > 0) b.sq = Math.max(0, b.sq - dt * 3.5);
    }
    // keep each lane flowing; spawn when the gap below the last balloon reaches the spacing
    for (const lane of L.lanes) {
      lane.dist -= lane.v * slow * dt;
      if (lane.dist <= 0) { const j = wordFor(lane); makeBalloon(lane, L.ys + lane.dist, j); lane.dist += L.spacing; }
    }
    // the target must never be missing for long: spawn it early in the lane with the most room
    if (needTarget()) {
      let best = null;
      const room = lane => L.spacing - lane.dist >= L.hb * 1.02;
      for (const lane of L.lanes) if (room(lane) && (!best || (targetLane(lane) && !targetLane(best)))) best = lane;
      if (best) { makeBalloon(best, L.ys, G.target); best.dist = L.spacing; }
    }
    G.items = G.items.filter(b => !b.popped && (b.leave ? b.y + bR(b) * 3 > 0 && b.leave < 3 : b.y + bR(b) * 3 > 0));
    updatePops(dt);
  },
  draw(c){
    if (!SC.bg) buildScene();
    drawBack(c);
    for (const b of G.items) if (b.leave) drawBalloon(c, b, Math.max(0, 1 - (b.leave - 1) * 1.4));
    for (const b of G.items) if (!b.leave) drawBalloon(c, b, 1);
    c.drawImage(SC.fg, 0, 0, G.W, G.H);
    drawPrincess(c);
    drawPops(c);
  },
  // tests: tap the centre of a target balloon that is fully on screen and settled
  testHint(){
    if (G.done) return null;
    const ok = b => {
      if (!b.alive || b.j !== G.target || b.ent < 1) return false;
      const r = bR(b), y = bY(b), x = bX(b);
      return y - r * 1.15 > 2 && y + r * 1.1 < G.H - SC.hillH && x - r > 0 && x + r < G.W;
    };
    const b = G.items.find(ok);
    return b ? { action:'tap', x:bX(b), y:bY(b) - bR(b) * .05 } : null;
  },
};

registerGame('balloon', balloon);
