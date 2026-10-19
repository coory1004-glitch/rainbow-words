// games/worm.js (owner: worm) — steer the rainbow worm with a finger and eat the picture you hear. The worm never dies.
// Art: every world gets its own garden field painted once into an offscreen canvas (meadow, candy land, rainbow park,
// toy town, pumpkin patch). The worm, bubbles, halos and shadows are pre-rendered sprites, so a frame is mostly
// drawImage calls; particles, ripples and "+1" floats come from preallocated pools (no per-frame allocations).
import { G, registerGame, gotIt, oops, pickSet } from '../engine.js';
import { store } from '../state.js';
import { TAU } from '../data.js';
import { sfx } from '../audio.js';
import { drawPic, getImage } from '../images.js';
import { sw } from '../session.js';

const BASE_SPEED = 4.6;     // × U px/s at the start — must stay >= 4.2 (the user asked for a fast worm); grows a bit per bite
const REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = t => t * t;
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const popEase = t => { const s = 2.1; t -= 1; return 1 + t * t * ((s + 1) * t + s); };

const headR = () => G.U * .72;
const segR = () => G.U * .54;
const itemR = () => G.U * .92;
const GAP = .44;            // × U between body segments
const START_SEGS = 5;

/* ---------- colours ---------- */
const HEAD_COL = '#ff7dbd';
const BODY_COLS = ['#ffa35f', '#ffd43c', '#55d69b', '#58abff', '#a286ff', '#ff88c6'];
const RIM_COLS = ['#ff6aa9', '#45a8ff', '#33c98d', '#9b7bff', '#ff9445', '#f2b600'];
const SPARK_COLS = ['#ffd23f', '#ff6fae', '#7cc8ff', '#b58cff', '#5fe0a5', '#ffffff', '#ff9a4d'];

const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
function rng(seed){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function canvas(w, h){ const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
// a sprite: square canvas drawn in CSS px around its centre; .cw = CSS width
function sprite(css, paint){
  const d = G.dpr || 1, cv = canvas(css * d, css * d), x = cv.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0); paint(x, css / 2); cv.cw = css; return cv;
}
const put = (c, sp, x, y, w, h = w) => c.drawImage(sp, x - w / 2, y - h / 2, w, h);
function rrect(x, X, Y, w, h, r){
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}
function heartPath(x, cx, cy, s){
  x.moveTo(cx, cy + s * .42);
  x.bezierCurveTo(cx - s * 1.05, cy - s * .2, cx - s * .5, cy - s * .95, cx, cy - s * .42);
  x.bezierCurveTo(cx + s * .5, cy - s * .95, cx + s * 1.05, cy - s * .2, cx, cy + s * .42);
}
function star4(c, x, y, s){
  c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s);
}

/* ---------- sprites (rebuilt when U or dpr change) ---------- */
const SP = { ball:[], bubble:[] };
let spKey = '';
function glossBall(r, col, outline = true){
  return sprite(2 * r + 6, (x, o) => {
    let g = x.createRadialGradient(o - r * .32, o - r * .4, r * .06, o, o, r);
    g.addColorStop(0, mix(col, '#ffffff', .62)); g.addColorStop(.42, mix(col, '#ffffff', .14)); g.addColorStop(.86, col); g.addColorStop(1, mix(col, '#000000', .16));
    x.beginPath(); x.arc(o, o, r, 0, TAU); x.fillStyle = g; x.fill();
    x.save(); x.clip();
    g = x.createRadialGradient(o + r * .2, o + r * 1.05, r * .1, o + r * .2, o + r * 1.05, r * .85);   // warm bounce light at the bottom
    g.addColorStop(0, rgba(mix(col, '#ffffff', .55), .55)); g.addColorStop(1, rgba(mix(col, '#ffffff', .55), 0));
    x.fillStyle = g; x.fillRect(o - r, o - r, 2 * r, 2 * r);
    x.restore();
    if (outline) { x.beginPath(); x.arc(o, o, r - .6, 0, TAU); x.lineWidth = Math.max(1.4, r * .07); x.strokeStyle = rgba(mix(col, '#000000', .38), .5); x.stroke(); }
    x.save(); x.translate(o - r * .36, o - r * .44); x.rotate(-.65);                                   // specular highlight
    g = x.createRadialGradient(0, 0, 0, 0, 0, r * .36); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.scale(1, .55); x.beginPath(); x.arc(0, 0, r * .36, 0, TAU); x.fillStyle = g; x.fill(); x.restore();
    x.beginPath(); x.arc(o + r * .34, o - r * .5, r * .07, 0, TAU); x.fillStyle = 'rgba(255,255,255,.75)'; x.fill();
  });
}
function bubbleSprite(r, col){
  return sprite(2 * r + 6, (x, o) => {
    let g = x.createLinearGradient(0, o - r, 0, o + r);                    // candy rim
    g.addColorStop(0, mix(col, '#ffffff', .45)); g.addColorStop(.5, col); g.addColorStop(1, mix(col, '#000000', .2));
    x.beginPath(); x.arc(o, o, r, 0, TAU); x.fillStyle = g; x.fill();
    const ri = r * .83;
    g = x.createRadialGradient(o - ri * .25, o - ri * .3, ri * .1, o, o, ri);   // pearly inside
    g.addColorStop(0, '#ffffff'); g.addColorStop(.62, mix(col, '#ffffff', .95)); g.addColorStop(1, mix(col, '#ffffff', .7));
    x.beginPath(); x.arc(o, o, ri, 0, TAU); x.fillStyle = g; x.fill();
    x.save(); x.clip();                                                        // recessed: soft inner shade under the rim
    g = x.createLinearGradient(0, o - ri, 0, o - ri * .45);
    g.addColorStop(0, rgba(mix(col, '#000000', .35), .28)); g.addColorStop(1, rgba(mix(col, '#000000', .35), 0));
    x.fillStyle = g; x.fillRect(o - ri, o - ri, 2 * ri, ri * .6);
    x.restore();
    x.beginPath(); x.arc(o, o, ri, 0, TAU); x.lineWidth = Math.max(1, r * .025); x.strokeStyle = rgba(mix(col, '#000000', .3), .35); x.stroke();
    x.beginPath(); x.arc(o, o, r - .7, 0, TAU); x.lineWidth = Math.max(1.4, r * .04); x.strokeStyle = rgba(mix(col, '#000000', .4), .5); x.stroke();
    x.lineCap = 'round';                                                       // shine on the rim
    x.beginPath(); x.arc(o, o, r * .915, Math.PI * 1.1, Math.PI * 1.42); x.lineWidth = r * .075; x.strokeStyle = 'rgba(255,255,255,.85)'; x.stroke();
    x.beginPath(); x.arc(o, o, r * .915, Math.PI * 1.5, Math.PI * 1.56); x.stroke();
    x.beginPath(); x.arc(o, o, r * .915, Math.PI * .12, Math.PI * .38); x.lineWidth = r * .05; x.strokeStyle = rgba(mix(col, '#ffffff', .5), .7); x.stroke();
  });
}
function buildSprites(){
  const U = G.U, d = G.dpr, key = U.toFixed(2) + '@' + d;
  if (key === spKey) return;
  spKey = key;
  const rb = segR(), rh = headR(), ri = itemR();
  SP.ball = BODY_COLS.map(c => glossBall(rb, c)); SP.ballR = rb;
  SP.head = glossBall(rh, HEAD_COL); SP.headR = rh;
  SP.bubble = RIM_COLS.map(c => bubbleSprite(ri, c)); SP.itemR = ri;
  SP.gloss = sprite(2 * ri + 6, (x, o) => {                                   // glass gloss drawn over the picture
    const r = ri * .83;
    x.save(); x.beginPath(); x.arc(o, o, r, 0, TAU); x.clip();
    x.translate(o - r * .42, o - r * .52); x.rotate(-.7);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, r * .55);
    g.addColorStop(0, 'rgba(255,255,255,.62)'); g.addColorStop(.55, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.scale(1, .42); x.beginPath(); x.arc(0, 0, r * .55, 0, TAU); x.fillStyle = g; x.fill();
    x.restore();
    x.beginPath(); x.arc(o + r * .52, o + r * .5, r * .06, 0, TAU); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill();
  });
  SP.shadow = sprite(64, (x, o) => {
    const g = x.createRadialGradient(o, o, 0, o, o, o);
    g.addColorStop(0, 'rgba(40,24,70,.34)'); g.addColorStop(.55, 'rgba(40,24,70,.2)'); g.addColorStop(1, 'rgba(40,24,70,0)');
    x.fillStyle = g; x.fillRect(0, 0, 2 * o, 2 * o);
  });
  SP.font = `700 ${Math.round(U * .72)}px Fredoka, "Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif`;
  SP.halo = sprite(ri * 3.6, (x, o) => {
    const g = x.createRadialGradient(o, o, ri * .7, o, o, o);
    g.addColorStop(0, 'rgba(255,238,150,.95)'); g.addColorStop(.35, 'rgba(255,214,80,.6)'); g.addColorStop(1, 'rgba(255,190,60,0)');
    x.fillStyle = g; x.beginPath(); x.arc(o, o, o, 0, TAU); x.fill();
  });
  SP.blush = sprite(rh * .5, (x, o) => {
    const g = x.createRadialGradient(o, o, 0, o, o, o);
    g.addColorStop(0, 'rgba(255,70,130,.62)'); g.addColorStop(.6, 'rgba(255,90,140,.3)'); g.addColorStop(1, 'rgba(255,110,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, 2 * o, 2 * o);
  });
  const tip = rh * .2;
  SP.tip = sprite(tip * 2.6, (x, o) => {
    x.beginPath(); heartPath(x, o, o + tip * .12, tip);
    const g = x.createRadialGradient(o - tip * .35, o - tip * .4, tip * .05, o, o, tip * 1.1);
    g.addColorStop(0, '#ffd6ec'); g.addColorStop(.5, '#ff5fa8'); g.addColorStop(1, '#d93d86');
    x.fillStyle = g; x.fill(); x.lineWidth = Math.max(1, tip * .1); x.strokeStyle = 'rgba(150,30,90,.5)'; x.stroke();
    x.beginPath(); x.ellipse(o - tip * .38, o - tip * .28, tip * .2, tip * .12, -.6, 0, TAU); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill();
  });
  SP.bow = sprite(rh * 1.25, (x, o) => {                                       // pink ribbon bow
    const s = rh * .5;
    x.save(); x.translate(o, o); x.lineJoin = 'round';
    const g = x.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#ff9fd0'); g.addColorStop(.55, '#ff4f9b'); g.addColorStop(1, '#d42f7c');
    x.beginPath();                                                             // tails
    x.moveTo(-s * .08, s * .05); x.lineTo(-s * .5, s * .88); x.lineTo(-s * .28, s * .8); x.lineTo(-s * .18, s * .98); x.lineTo(s * .06, s * .12);
    x.moveTo(s * .08, s * .05); x.lineTo(s * .5, s * .88); x.lineTo(s * .28, s * .8); x.lineTo(s * .18, s * .98); x.lineTo(-s * .06, s * .12);
    x.fillStyle = '#e8438f'; x.fill(); x.lineWidth = Math.max(1, s * .07); x.strokeStyle = 'rgba(140,20,80,.45)'; x.stroke();
    x.beginPath();                                                             // loops
    x.moveTo(0, 0); x.bezierCurveTo(-s * .3, -s * .62, -s * 1.08, -s * .58, -s * .98, s * .02); x.bezierCurveTo(-s * .92, s * .5, -s * .32, s * .36, 0, 0);
    x.moveTo(0, 0); x.bezierCurveTo(s * .3, -s * .62, s * 1.08, -s * .58, s * .98, s * .02); x.bezierCurveTo(s * .92, s * .5, s * .32, s * .36, 0, 0);
    x.fillStyle = g; x.fill(); x.stroke();
    x.beginPath(); x.ellipse(-s * .55, -s * .2, s * .2, s * .1, -.5, 0, TAU); x.ellipse(s * .5, -s * .24, s * .16, s * .08, .5, 0, TAU);
    x.fillStyle = 'rgba(255,255,255,.75)'; x.fill();
    x.beginPath(); x.ellipse(0, s * .02, s * .2, s * .24, 0, 0, TAU);           // knot
    const k = x.createRadialGradient(-s * .06, -s * .06, 0, 0, 0, s * .26); k.addColorStop(0, '#ffc2e1'); k.addColorStop(1, '#e8438f');
    x.fillStyle = k; x.fill(); x.stroke();
    x.restore();
  });
  SP.glow = sprite(U * 1.1, (x, o) => {                                        // firefly glow
    const g = x.createRadialGradient(o, o, 0, o, o, o);
    g.addColorStop(0, 'rgba(255,250,190,1)'); g.addColorStop(.18, 'rgba(240,255,150,.75)'); g.addColorStop(1, 'rgba(200,255,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, 2 * o, 2 * o);
  });
  SP.cloud = sprite(U * 6, (x, o) => {                                         // drifting cloud shadow
    const lobes = [[0, 0, .42], [-.38, .08, .3], [.38, .06, .32], [.12, -.16, .3]];
    for (const [lx, ly, lr] of lobes) {
      const cx = o + lx * 2 * o, cy = o + ly * 2 * o, rr = lr * 2 * o;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, 'rgba(30,40,90,.5)'); g.addColorStop(.6, 'rgba(30,40,90,.3)'); g.addColorStop(1, 'rgba(30,40,90,0)');
      x.fillStyle = g; x.fillRect(0, 0, 2 * o, 2 * o);
    }
  });
  SP.fog = sprite(U * 7, (x, o) => {
    x.save(); x.scale(1, .45); x.translate(0, o * .62);
    const g = x.createRadialGradient(o, o, 0, o, o, o);
    g.addColorStop(0, 'rgba(225,210,255,.55)'); g.addColorStop(1, 'rgba(225,210,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 2 * o, 2 * o); x.restore();
  });
  SP.car = sprite(U * 1.5, (x, o) => {                                         // little red toy car, top view, facing +x
    const L = U * .95, Wd = U * .55;
    x.save(); x.translate(o, o);
    x.fillStyle = 'rgba(30,30,60,.25)'; x.beginPath(); rrect(x, -L / 2 + U * .05, -Wd / 2 + U * .08, L, Wd, Wd * .4); x.fill();
    x.fillStyle = '#2b2d42'; for (const [wx, wy] of [[-.28, -.5], [.28, -.5], [-.28, .5], [.28, .5]]) { x.beginPath(); rrect(x, wx * L - U * .1, wy * Wd - U * .06, U * .2, U * .12, U * .05); x.fill(); }
    const g = x.createLinearGradient(0, -Wd / 2, 0, Wd / 2); g.addColorStop(0, '#ff8a8a'); g.addColorStop(.5, '#ff4a5e'); g.addColorStop(1, '#d42f45');
    x.fillStyle = g; x.beginPath(); rrect(x, -L / 2, -Wd / 2, L, Wd, Wd * .42); x.fill();
    x.lineWidth = Math.max(1, U * .03); x.strokeStyle = 'rgba(120,10,30,.5)'; x.stroke();
    x.fillStyle = '#bfe8ff'; x.beginPath(); rrect(x, L * .06, -Wd * .36, L * .16, Wd * .72, U * .05); x.fill();
    x.fillStyle = '#ff6b7d'; x.beginPath(); rrect(x, -L * .22, -Wd * .34, L * .3, Wd * .68, U * .07); x.fill();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); rrect(x, -L * .4, -Wd * .36, L * .5, Wd * .14, U * .05); x.fill();
    x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(L * .46, -Wd * .3, U * .055, 0, TAU); x.arc(L * .46, Wd * .3, U * .055, 0, TAU); x.fill();
    x.restore();
  });
}

/* ---------- world backgrounds (painted once per size + world) ---------- */
const art = { w:0, h:0, d:0, world:'', bg:null, amb:null };
function shadowOn(x, col, blur, oy){ x.shadowColor = col; x.shadowBlur = blur * art.d; x.shadowOffsetX = 0; x.shadowOffsetY = oy * art.d; }
function shadowOff(x){ x.shadowColor = 'rgba(0,0,0,0)'; x.shadowBlur = 0; x.shadowOffsetY = 0; }
function ground(x, W, H, top, bot, light){
  let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const R = Math.max(W, H) * .75;
  g = x.createRadialGradient(W * .5, H * .4, 0, W * .5, H * .4, R); g.addColorStop(0, light); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
}
function vignette(x, W, H, col){
  const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .58);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
}
function stripes(x, W, H, U, col){
  x.save(); x.translate(W / 2, H / 2); x.rotate(-.55); x.fillStyle = col;
  const s = U * 1.7, n = Math.ceil(Math.hypot(W, H) / s / 2) + 1, L = Math.hypot(W, H);
  for (let k = -n; k <= n; k += 2) x.fillRect(k * s, -L, s, 2 * L);
  x.restore();
}
function tufts(x, rnd, W, H, U, n, col, len){
  x.beginPath();
  for (let i = 0; i < n; i++) {
    const px = rnd() * W, py = rnd() * H, l = len * (.65 + rnd() * .6);
    x.moveTo(px - l * .35, py - l * .7); x.quadraticCurveTo(px - l * .2, py - l * .1, px, py);
    x.moveTo(px, py - l); x.lineTo(px, py);
    x.moveTo(px + l * .35, py - l * .7); x.quadraticCurveTo(px + l * .2, py - l * .1, px, py);
  }
  x.strokeStyle = col; x.lineWidth = Math.max(1, U * .045); x.lineCap = 'round'; x.stroke();
}
// grass grows in clumps, not as an even carpet
function tuftPatches(x, rnd, W, H, U, patches, dark, light){
  for (let p = 0; p < patches; p++) {
    const cx = rnd() * W, cy = rnd() * H, n = 3 + Math.floor(rnd() * 5);
    x.beginPath();
    for (let i = 0; i < n; i++) {
      const px = cx + (rnd() - .5) * U * 1.3, py = cy + (rnd() - .5) * U * .9, l = U * (.16 + rnd() * .12);
      x.moveTo(px - l * .38, py - l * .72); x.quadraticCurveTo(px - l * .18, py - l * .12, px, py);
      x.moveTo(px + l * .05, py - l); x.quadraticCurveTo(px + l * .02, py - l * .4, px, py);
      x.moveTo(px + l * .4, py - l * .66); x.quadraticCurveTo(px + l * .2, py - l * .1, px, py);
    }
    x.lineCap = 'round'; x.lineWidth = Math.max(1.2, U * .055);
    x.strokeStyle = rnd() < .65 ? dark : light; x.stroke();
  }
}
// big soft light/dark patches so the ground looks painted, not flat
function groundBlobs(x, rnd, W, H, U, n, lightCol, darkCol){
  for (let i = 0; i < n; i++) {
    const cx = rnd() * W, cy = rnd() * H, r = U * (1.6 + rnd() * 2.6), col = rnd() < .55 ? lightCol : darkCol;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }
}
function bezPts(P, step, U){
  const out = [];
  for (let t = 0; t <= 1.0001; t += .002) {
    const u = 1 - t, px = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0];
    const py = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
    if (!out.length || Math.hypot(px - out[out.length - 1][0], py - out[out.length - 1][1]) > step) out.push([px, py]);
  }
  return out;
}
// a soft winding garden path with pebbles along its edges
function pathRibbon(x, rnd, P, U, wide, edge, fill, pebble){
  const pts = bezPts(P, U * .25, U);
  const trace = () => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); };
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.save(); shadowOn(x, 'rgba(60,110,80,.22)', U * .25, U * .06); trace(); x.lineWidth = wide + U * .12; x.strokeStyle = edge; x.stroke(); x.restore();
  trace(); x.lineWidth = wide; x.strokeStyle = fill; x.stroke();
  trace(); x.lineWidth = wide * .45; x.strokeStyle = 'rgba(255,255,255,.35)'; x.stroke();
  for (let i = 2; i < pts.length - 2; i += 2) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    const side = rnd() < .5 ? -1 : 1, off = wide * (.18 + rnd() * .3) * side, px = pts[i][0] + nx * off, py = pts[i][1] + ny * off;
    if (rnd() < .55) stone(x, px, py, U * (.07 + rnd() * .05), U * (.05 + rnd() * .03), rnd() * TAU, pebble);
  }
}
function specks(x, rnd, W, H, n, r, col){
  x.beginPath();
  for (let i = 0; i < n; i++) { const px = rnd() * W, py = rnd() * H, rr = r * (.5 + rnd()); x.moveTo(px + rr, py); x.arc(px, py, rr, 0, TAU); }
  x.fillStyle = col; x.fill();
}
function flower(x, cx, cy, s, petal, rot, center = '#ffcf3a'){
  x.fillStyle = 'rgba(40,80,50,.14)'; x.beginPath(); x.arc(cx + s * .1, cy + s * .24, s * 1.05, 0, TAU); x.fill();
  const g = x.createRadialGradient(cx, cy, s * .1, cx, cy, s * 1.05);
  g.addColorStop(0, mix(petal, '#ffffff', .6)); g.addColorStop(1, petal);
  x.beginPath();
  for (let p = 0; p < 5; p++) {
    const a = rot + p * TAU / 5, px = cx + Math.cos(a) * s * .52, py = cy + Math.sin(a) * s * .52;
    x.moveTo(px + Math.cos(a) * s * .5, py + Math.sin(a) * s * .5); x.ellipse(px, py, s * .5, s * .36, a, 0, TAU);
  }
  x.fillStyle = g; x.fill(); x.lineWidth = Math.max(.8, s * .07); x.strokeStyle = rgba(mix(petal, '#000000', .3), .4); x.stroke();
  const c2 = x.createRadialGradient(cx - s * .08, cy - s * .1, 0, cx, cy, s * .3);
  c2.addColorStop(0, '#fff7c8'); c2.addColorStop(.6, center); c2.addColorStop(1, mix(center, '#000000', .18));
  x.beginPath(); x.arc(cx, cy, s * .3, 0, TAU); x.fillStyle = c2; x.fill();
  x.beginPath(); x.arc(cx - s * .09, cy - s * .1, s * .08, 0, TAU); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill();
}
const LOBES = [[-.3, -.46, .7], [.34, -.42, .72], [-.62, .1, .74], [.6, .08, .78], [0, 0, 1], [.02, .48, .68]];
function bush(x, cx, cy, s, col, rnd, blooms){
  x.save(); shadowOn(x, 'rgba(30,60,40,.3)', s * .45, s * .22);
  x.beginPath(); for (const [ox, oy, k] of LOBES) { const r = k * s * .62; x.moveTo(cx + ox * s + r, cy + oy * s); x.arc(cx + ox * s, cy + oy * s, r, 0, TAU); }
  x.fillStyle = mix(col, '#000000', .1); x.fill(); x.restore();
  for (const [ox, oy, k] of LOBES) {
    const lx = cx + ox * s, ly = cy + oy * s, lr = k * s * .62;
    const g = x.createRadialGradient(lx - lr * .35, ly - lr * .45, lr * .08, lx, ly, lr);
    g.addColorStop(0, mix(col, '#ffffff', .42)); g.addColorStop(.6, col); g.addColorStop(1, mix(col, '#000000', .16));
    x.beginPath(); x.arc(lx, ly, lr, 0, TAU); x.fillStyle = g; x.fill();
    x.beginPath(); x.arc(lx, ly, lr, Math.PI * .15, Math.PI * .85); x.lineWidth = Math.max(1, s * .035); x.strokeStyle = rgba(mix(col, '#000000', .3), .35); x.stroke();
  }
  x.beginPath();
  for (let i = 0; i < 7; i++) { const a = rnd() * TAU, r = s * (.15 + rnd() * .55), px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r - s * .1; x.moveTo(px + s * .05, py); x.arc(px, py, s * .05, 0, TAU); }
  x.fillStyle = 'rgba(255,255,255,.45)'; x.fill();
  if (blooms) for (let i = 0; i < blooms.n; i++) {
    const a = rnd() * TAU, r = s * (.2 + rnd() * .45);
    flower(x, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .85 - s * .08, s * (.16 + rnd() * .06), blooms.cols[Math.floor(rnd() * blooms.cols.length)], rnd() * TAU);
  }
}
// points spaced along the four edges (and the corners), slightly outside so bushes frame the field
function edgeSpots(W, H, U, step, rnd){
  const out = [], o = U * .15;
  for (let px = -U * .3; px < W + U; px += step * (.8 + rnd() * .5)) { out.push([px, -o]); out.push([W - px, H + o]); }
  for (let py = step * .7; py < H - step * .5; py += step * (.8 + rnd() * .5)) { out.push([-o, py]); out.push([W + o, H - py]); }
  return out;
}
function stone(x, cx, cy, rx, ry, rot, col){
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.fillStyle = 'rgba(40,40,80,.16)'; x.beginPath(); x.ellipse(rx * .08, ry * .35, rx, ry, 0, 0, TAU); x.fill();
  const g = x.createRadialGradient(-rx * .3, -ry * .4, 0, 0, 0, rx);
  g.addColorStop(0, mix(col, '#ffffff', .7)); g.addColorStop(.7, col); g.addColorStop(1, mix(col, '#000000', .12));
  x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, TAU); x.fill();
  x.lineWidth = Math.max(1, ry * .1); x.strokeStyle = rgba(mix(col, '#000000', .3), .35); x.stroke();
  x.restore();
}
function mushroom(x, cx, cy, s, cap){
  x.fillStyle = 'rgba(40,60,40,.18)'; x.beginPath(); x.ellipse(cx + s * .1, cy + s * .3, s * 1.05, s * .8, 0, 0, TAU); x.fill();
  const g = x.createRadialGradient(cx - s * .3, cy - s * .35, 0, cx, cy, s);
  g.addColorStop(0, mix(cap, '#ffffff', .5)); g.addColorStop(.6, cap); g.addColorStop(1, mix(cap, '#000000', .2));
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fill();
  x.lineWidth = Math.max(1, s * .08); x.strokeStyle = rgba(mix(cap, '#000000', .35), .45); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath();
  for (const [dx, dy, r] of [[-.35, -.3, .2], [.3, -.38, .15], [.4, .22, .18], [-.2, .35, .14], [.04, -.02, .12]]) { x.moveTo(cx + dx * s + r * s, cy + dy * s); x.arc(cx + dx * s, cy + dy * s, r * s, 0, TAU); }
  x.fill();
}

/* meadow (unicorn + mix): pastel flowers, stepping stones, flowering bushes */
function bgMeadow(x, W, H, U, rnd){
  ground(x, W, H, '#d2f7dc', '#aee9c3', 'rgba(255,255,255,.5)');
  groundBlobs(x, rnd, W, H, U, Math.round(W * H / (U * U) / 6), 'rgba(255,255,255,.22)', 'rgba(90,200,140,.14)');
  stripes(x, W, H, U, 'rgba(255,255,255,.12)');
  specks(x, rnd, W, H, W * H / (U * U) * 1.6, U * .03, 'rgba(255,255,255,.6)');
  pathRibbon(x, rnd, [[-U, H * .8], [W * .42, H * 1.0], [W * .5, H * .2], [W + U, H * .28]], U, U * .95, '#f5c9dc', '#fde3ee', '#ffffff');
  tuftPatches(x, rnd, W, H, U, Math.round(W * H / (U * U) / 3.4), 'rgba(60,165,105,.4)', 'rgba(150,225,170,.9)');
  const PET = ['#ffa3cf', '#cdb0ff', '#ffffff', '#ffbf9e', '#ff8fc0', '#a9d0ff'];
  const clusters = Math.round(W * H / (U * U) / 10);
  for (let i = 0; i < clusters; i++) {
    const cx = rnd() * W, cy = rnd() * H, col = PET[Math.floor(rnd() * PET.length)], n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) flower(x, cx + (rnd() - .5) * U * 1.1, cy + (rnd() - .5) * U * .9, U * (.15 + rnd() * .09), col, rnd() * TAU);
  }
  for (let i = 0; i < 3; i++) mushroom(x, U + rnd() * (W - 2 * U), U + rnd() * (H - 2 * U), U * (.2 + rnd() * .06), '#ff6fa8');
  const BUSH = ['#7fd99c', '#70d293', '#8ee2aa'];
  for (const [bx, by] of edgeSpots(W, H, U, U * 2.3, rnd)) bush(x, bx, by, U * (.85 + rnd() * .35), BUSH[Math.floor(rnd() * 3)], rnd, rnd() < .8 ? { n:2 + Math.floor(rnd() * 3), cols:PET } : null);
  vignette(x, W, H, 'rgba(50,160,100,.22)');
}

/* candy land (sweets): pink frosting, sprinkles, macarons, lollipops, cream with cherries */
function macaron(x, cx, cy, s, col){
  x.save(); shadowOn(x, 'rgba(150,60,90,.3)', s * .4, s * .2);
  x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fillStyle = mix(col, '#ffffff', .25); x.fill(); x.restore();
  x.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, px = cx + Math.cos(a) * s * .93, py = cy + Math.sin(a) * s * .93; x.moveTo(px + s * .13, py); x.arc(px, py, s * .13, 0, TAU); }
  x.fillStyle = mix(col, '#ffffff', .35); x.fill();
  const g = x.createRadialGradient(cx - s * .3, cy - s * .35, s * .05, cx, cy, s * .9);
  g.addColorStop(0, mix(col, '#ffffff', .55)); g.addColorStop(.7, col); g.addColorStop(1, mix(col, '#000000', .1));
  x.beginPath(); x.arc(cx, cy, s * .86, 0, TAU); x.fillStyle = g; x.fill();
  x.lineWidth = Math.max(1, s * .05); x.strokeStyle = rgba(mix(col, '#000000', .3), .35); x.stroke();
  x.beginPath(); x.ellipse(cx - s * .3, cy - s * .38, s * .3, s * .14, -.5, 0, TAU); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill();
}
function lollipop(x, cx, cy, s, c1, c2, ang){
  x.save(); x.translate(cx, cy); x.rotate(ang);
  shadowOn(x, 'rgba(150,60,90,.3)', s * .35, s * .18);
  x.fillStyle = '#fffaf2'; x.beginPath(); rrect(x, s * .7, -s * .1, s * 1.5, s * .2, s * .1); x.fill();
  x.beginPath(); x.arc(0, 0, s, 0, TAU); x.fillStyle = c1; x.fill(); shadowOff(x);
  x.save(); x.beginPath(); x.arc(0, 0, s * .97, 0, TAU); x.clip();
  x.beginPath(); for (let t = 0; t < 1; t += .01) { const a = t * TAU * 2.6, r = t * s; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  x.lineWidth = s * .22; x.strokeStyle = c2; x.lineCap = 'round'; x.stroke(); x.restore();
  const g = x.createRadialGradient(-s * .3, -s * .35, 0, 0, 0, s);
  g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(90,20,60,.22)');
  x.beginPath(); x.arc(0, 0, s, 0, TAU); x.fillStyle = g; x.fill();
  x.lineWidth = Math.max(1, s * .05); x.strokeStyle = 'rgba(120,30,80,.3)'; x.stroke();
  x.beginPath(); x.ellipse(-s * .38, -s * .42, s * .28, s * .13, -.6, 0, TAU); x.fillStyle = 'rgba(255,255,255,.8)'; x.fill();
  x.restore();
}
function wrapped(x, cx, cy, s, col, ang){
  x.save(); x.translate(cx, cy); x.rotate(ang);
  shadowOn(x, 'rgba(150,60,90,.3)', s * .35, s * .2);
  x.fillStyle = mix(col, '#ffffff', .35);
  x.beginPath(); x.moveTo(-s * .7, 0); x.lineTo(-s * 1.45, -s * .55); x.quadraticCurveTo(-s * 1.25, 0, -s * 1.45, s * .55); x.closePath();
  x.moveTo(s * .7, 0); x.lineTo(s * 1.45, -s * .55); x.quadraticCurveTo(s * 1.25, 0, s * 1.45, s * .55); x.closePath(); x.fill();
  x.beginPath(); x.ellipse(0, 0, s * .85, s * .7, 0, 0, TAU); x.fillStyle = col; x.fill(); shadowOff(x);
  x.save(); x.clip(); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = s * .18;
  x.beginPath(); for (let k = -3; k <= 3; k++) { x.moveTo(k * s * .45 - s, -s); x.lineTo(k * s * .45 + s, s); } x.stroke(); x.restore();
  const g = x.createRadialGradient(-s * .25, -s * .3, 0, 0, 0, s * .9);
  g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(90,20,60,.25)');
  x.beginPath(); x.ellipse(0, 0, s * .85, s * .7, 0, 0, TAU); x.fillStyle = g; x.fill();
  x.lineWidth = Math.max(1, s * .05); x.strokeStyle = rgba(mix(col, '#000000', .35), .4); x.stroke();
  x.restore();
}
function dollop(x, cx, cy, s, cherry){
  x.save(); shadowOn(x, 'rgba(150,60,90,.32)', s * .45, s * .22);
  x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fillStyle = '#fff6ef'; x.fill(); x.restore();
  for (const [k, oy] of [[1, 0], [.74, -.12], [.48, -.22]]) {
    const r = s * k, py = cy + oy * s;
    const g = x.createRadialGradient(cx - r * .35, py - r * .4, 0, cx, py, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.7, '#fff3ea'); g.addColorStop(1, '#f1d8cf');
    x.beginPath(); x.arc(cx, py, r, 0, TAU); x.fillStyle = g; x.fill();
    x.lineWidth = Math.max(1, s * .04); x.strokeStyle = 'rgba(190,130,120,.35)'; x.stroke();
  }
  if (cherry) {
    const r = s * .3, py = cy - s * .3;
    x.strokeStyle = '#5c8a3c'; x.lineWidth = Math.max(1.2, s * .06); x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx, py - r * .6); x.quadraticCurveTo(cx + r * .5, py - r * 1.8, cx + r * 1.4, py - r * 1.9); x.stroke();
    const g = x.createRadialGradient(cx - r * .35, py - r * .35, 0, cx, py, r);
    g.addColorStop(0, '#ff9aa6'); g.addColorStop(.5, '#ff2d55'); g.addColorStop(1, '#b0102e');
    x.beginPath(); x.arc(cx, py, r, 0, TAU); x.fillStyle = g; x.fill();
    x.beginPath(); x.ellipse(cx - r * .35, py - r * .38, r * .28, r * .16, -.6, 0, TAU); x.fillStyle = 'rgba(255,255,255,.85)'; x.fill();
  }
}
function donut(x, cx, cy, s, icing, rnd){
  x.save(); shadowOn(x, 'rgba(150,60,90,.3)', s * .4, s * .2);
  x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.arc(cx, cy, s * .32, 0, TAU, true); x.fillStyle = '#f2b36b'; x.fill(); x.restore();
  x.beginPath();
  for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = s * (.84 + (i % 2 ? .06 : 0)); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  x.arc(cx, cy, s * .4, 0, TAU, true);
  const g = x.createRadialGradient(cx - s * .3, cy - s * .4, 0, cx, cy, s);
  g.addColorStop(0, mix(icing, '#ffffff', .5)); g.addColorStop(.7, icing); g.addColorStop(1, mix(icing, '#000000', .1));
  x.fillStyle = g; x.fill('evenodd');
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, r = s * (.5 + rnd() * .28), px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r, b = rnd() * TAU;
    x.beginPath(); x.moveTo(px - Math.cos(b) * s * .08, py - Math.sin(b) * s * .08); x.lineTo(px + Math.cos(b) * s * .08, py + Math.sin(b) * s * .08);
    x.strokeStyle = SPARK_COLS[i % 6]; x.lineWidth = s * .07; x.lineCap = 'round'; x.stroke();
  }
  x.beginPath(); x.ellipse(cx - s * .45, cy - s * .45, s * .22, s * .1, -.7, 0, TAU); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill();
}
// piped whipped-cream rosette (top view), optionally crowned with a cherry
function rosette(x, cx, cy, s, rot, cherry){
  x.save(); shadowOn(x, 'rgba(170,60,110,.3)', s * .5, s * .22);
  x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fillStyle = '#fff3ee'; x.fill(); x.restore();
  for (let k = 0; k < 8; k++) {
    const a = rot + k * TAU / 8, px = cx + Math.cos(a) * s * .58, py = cy + Math.sin(a) * s * .58;
    const g = x.createRadialGradient(px - s * .12, py - s * .14, 0, px, py, s * .44);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.7, '#fff4f0'); g.addColorStop(1, '#f3d6d6');
    x.beginPath(); x.ellipse(px, py, s * .44, s * .32, a + 1.2, 0, TAU); x.fillStyle = g; x.fill();
    x.lineWidth = Math.max(.8, s * .035); x.strokeStyle = 'rgba(200,140,150,.4)'; x.stroke();
  }
  const g = x.createRadialGradient(cx - s * .1, cy - s * .12, 0, cx, cy, s * .4);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f6dede');
  x.beginPath(); x.arc(cx, cy, s * .36, 0, TAU); x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(200,140,150,.4)'; x.stroke();
  if (cherry) {
    const r = s * .36, py = cy - s * .08;
    x.strokeStyle = '#5c8a3c'; x.lineWidth = Math.max(1.2, s * .07); x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx, py - r * .55); x.quadraticCurveTo(cx + r * .4, py - r * 1.7, cx + r * 1.3, py - r * 1.85); x.stroke();
    x.save(); shadowOn(x, 'rgba(120,10,40,.35)', r * .5, r * .2);
    const cg = x.createRadialGradient(cx - r * .35, py - r * .35, 0, cx, py, r);
    cg.addColorStop(0, '#ff9aa6'); cg.addColorStop(.5, '#ff2d55'); cg.addColorStop(1, '#b0102e');
    x.beginPath(); x.arc(cx, py, r, 0, TAU); x.fillStyle = cg; x.fill(); x.restore();
    x.beginPath(); x.ellipse(cx - r * .35, py - r * .38, r * .3, r * .16, -.6, 0, TAU); x.fillStyle = 'rgba(255,255,255,.88)'; x.fill();
  }
}
function bgCandy(x, W, H, U, rnd){                                               // the top of a strawberry birthday cake
  ground(x, W, H, '#ffe3ef', '#ffc9de', 'rgba(255,255,255,.65)');
  groundBlobs(x, rnd, W, H, U, Math.round(W * H / (U * U) / 7), 'rgba(255,255,255,.3)', 'rgba(255,150,190,.16)');
  x.lineCap = 'round';                                                          // gentle icing ripples
  for (let i = 0; i < W * H / (U * U) / 9; i++) {
    const cx = rnd() * W, cy = rnd() * H, r = U * (1 + rnd() * 1.2), a = rnd() * TAU;
    x.beginPath(); x.arc(cx, cy, r, a, a + .9 + rnd()); x.lineWidth = U * .22; x.strokeStyle = 'rgba(255,255,255,.22)'; x.stroke();
  }
  const SPR = ['#ff5f97', '#ffc21f', '#3fb6ff', '#5fd492', '#a77cff', '#ffffff', '#ff8a3d'];
  const n = Math.round(W * H / (U * U) * .5);
  for (let ci = 0; ci < SPR.length; ci++) {
    x.beginPath();
    for (let i = 0; i < n / SPR.length; i++) {
      const px = rnd() * W, py = rnd() * H, a = rnd() * TAU, l = U * .11;
      x.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    }
    x.save(); shadowOn(x, 'rgba(180,60,110,.25)', U * .06, U * .03);
    x.lineWidth = U * .09; x.strokeStyle = SPR[ci]; x.stroke(); x.restore();
  }
  const MAC = ['#ffb3d1', '#c9b2ff', '#9fe6c4', '#ffe08a', '#a9d8ff'];
  const inner = [[.2, .24], [.8, .3], [.24, .7], [.78, .76], [.5, .5]];         // a few treats sitting on the cake
  inner.forEach(([fx, fy], i) => {
    const px = W * fx + (rnd() - .5) * U, py = H * fy + (rnd() - .5) * U, k = i % 5;
    if (k === 0) macaron(x, px, py, U * .5, MAC[Math.floor(rnd() * MAC.length)]);
    else if (k === 1) wrapped(x, px, py, U * .36, ['#ff6f9f', '#ffc23a', '#5fd0a0', '#8a7bff'][Math.floor(rnd() * 4)], rnd() * TAU);
    else if (k === 2) donut(x, px, py, U * .55, ['#ff9ac6', '#c9a6ff', '#8fd8ff'][Math.floor(rnd() * 3)], rnd);
    else if (k === 3) lollipop(x, px, py, U * .45, '#ffffff', ['#ff5fa2', '#9b7bff', '#3fb8ff'][Math.floor(rnd() * 3)], rnd() * TAU);
    else wrapped(x, px, py, U * .3, '#ffc23a', rnd() * TAU);
  });
  const step = U * 1.15, inset = U * .22;                                       // whipped cream border with cherries
  const ring = [];
  for (let px = step * .5; px < W; px += step) { ring.push([px, inset]); ring.push([W - px, H - inset]); }
  for (let py = step * 1.2; py < H - step * .8; py += step) { ring.push([inset, py]); ring.push([W - inset, H - py]); }
  ring.sort((a, b) => a[1] - b[1]);
  ring.forEach(([px, py], i) => rosette(x, px, py, U * (.5 + rnd() * .06), rnd() * TAU, (i * 7) % 3 === 0));
  vignette(x, W, H, 'rgba(230,90,150,.16)');
}

/* rainbow park (colours): a big painted rainbow, colourful flower beds */
function cloudTop(x, cx, cy, s){
  x.save(); shadowOn(x, 'rgba(80,110,170,.3)', s * .4, s * .2);
  x.beginPath();
  for (const [ox, oy, k] of [[-.6, .1, .5], [0, -.12, .68], [.62, .08, .52], [-.25, .3, .5], [.3, .3, .5]]) { x.moveTo(cx + ox * s + k * s, cy + oy * s); x.arc(cx + ox * s, cy + oy * s, k * s, 0, TAU); }
  const g = x.createLinearGradient(0, cy - s * .8, 0, cy + s * .8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e5ecff');
  x.fillStyle = g; x.fill(); x.restore();
  x.beginPath(); x.ellipse(cx - s * .1, cy - s * .38, s * .35, s * .12, -.1, 0, TAU); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill();
}
function bgRainbow(x, W, H, U, rnd){
  ground(x, W, H, '#d6f7c6', '#ade79c', 'rgba(255,255,255,.5)');
  stripes(x, W, H, U, 'rgba(255,255,255,.15)');
  specks(x, rnd, W, H, W * H / (U * U) * 2.5, U * .035, 'rgba(255,255,255,.5)');
  tufts(x, rnd, W, H, U, W * H / (U * U) * 1.3, 'rgba(60,150,70,.36)', U * .2);
  const RB = ['#ff8a9b', '#ffb067', '#ffe066', '#86e3a6', '#7cc0ff', '#a993ff'];
  const cx = W * .5, cy = H * .5, band = Math.min(W, H) * .052, R0 = Math.min(W * .42, H * .36);
  x.save(); shadowOn(x, 'rgba(40,90,60,.28)', U * .3, U * .12);
  x.beginPath(); x.arc(cx, cy, R0, Math.PI, TAU); x.lineWidth = band * RB.length + 6; x.strokeStyle = '#ffffff'; x.stroke(); x.restore();
  RB.forEach((c, i) => {
    const r = R0 + band * (RB.length / 2 - i - .5);
    x.beginPath(); x.arc(cx, cy, r, Math.PI, TAU); x.lineWidth = band + .5; x.strokeStyle = c; x.stroke();
  });
  x.beginPath(); x.arc(cx, cy, R0 + band * 2.2, Math.PI * 1.05, Math.PI * 1.4); x.lineWidth = band * .35; x.lineCap = 'round'; x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke();
  cloudTop(x, cx - R0, cy + U * .1, U * .95); cloudTop(x, cx + R0, cy + U * .1, U * .95);
  const PET = ['#ff7f9c', '#ffa95c', '#ffd83a', '#5fd0ff', '#a98bff', '#ff8fd0', '#ffffff'];
  for (let i = 0; i < Math.round(W * H / (U * U) / 10); i++) {
    const fx = rnd() * W, fy = rnd() * H;
    if (Math.abs(Math.hypot(fx - cx, fy - cy) - R0) < band * 4.5 && fy < cy + U) continue;
    for (let k = 0; k < 3; k++) flower(x, fx + (rnd() - .5) * U, fy + (rnd() - .5) * U * .8, U * (.15 + rnd() * .08), PET[Math.floor(rnd() * PET.length)], rnd() * TAU);
  }
  const BUSH = ['#7fd88f', '#6fcf85', '#92e19c'];
  for (const [bx, by] of edgeSpots(W, H, U, U * 2.5, rnd)) bush(x, bx, by, U * (.85 + rnd() * .3), BUSH[Math.floor(rnd() * 3)], rnd, { n:2 + Math.floor(rnd() * 2), cols:PET });
  vignette(x, W, H, 'rgba(40,120,60,.18)');
}

/* toy town (cars): a play-mat road loop with a crosswalk, trees, roofs and a pond */
function loopGeom(W, H, U){ const m = U * 1.25, r = Math.min(U * 1.8, (Math.min(W, H) - 2 * m) / 2); return { m, r, w:W - 2 * m, h:H - 2 * m }; }
function tree(x, cx, cy, s, col){
  x.save(); shadowOn(x, 'rgba(30,60,40,.35)', s * .5, s * .3);
  x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fillStyle = mix(col, '#000000', .1); x.fill(); x.restore();
  for (const [ox, oy, k] of [[-.3, -.25, .62], [.32, -.2, .6], [0, .25, .66], [0, -.05, .7]]) {
    const lx = cx + ox * s, ly = cy + oy * s, lr = k * s;
    const g = x.createRadialGradient(lx - lr * .35, ly - lr * .4, 0, lx, ly, lr);
    g.addColorStop(0, mix(col, '#ffffff', .4)); g.addColorStop(.65, col); g.addColorStop(1, mix(col, '#000000', .15));
    x.beginPath(); x.arc(lx, ly, lr, 0, TAU); x.fillStyle = g; x.fill();
  }
  x.beginPath(); x.ellipse(cx - s * .35, cy - s * .45, s * .25, s * .12, -.5, 0, TAU); x.fillStyle = 'rgba(255,255,255,.4)'; x.fill();
}
// a toy house seen from above: hip roof (four shaded faces) with tile rows and a chimney
function roof(x, cx, cy, w, h, col){
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, px = x0 + h / 2, qx = x1 - h / 2;
  x.save(); shadowOn(x, 'rgba(40,40,80,.38)', w * .18, w * .12);
  x.beginPath(); x.rect(x0, y0, w, h); x.fillStyle = mix(col, '#000000', .2); x.fill(); x.restore();
  const face = (pts, c) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fillStyle = c; x.fill(); };
  face([x0, y0, x1, y0, qx, cy, px, cy], mix(col, '#ffffff', .32));
  face([x1, y0, x1, y1, qx, cy], mix(col, '#ffffff', .08));
  face([x0, y1, x1, y1, qx, cy, px, cy], mix(col, '#000000', .1));
  face([x0, y0, x0, y1, px, cy], mix(col, '#ffffff', .18));
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();                       // tile rows
  x.strokeStyle = rgba(mix(col, '#000000', .4), .28); x.lineWidth = Math.max(1, w * .016);
  x.beginPath();
  for (let k = 1; k < 4; k++) { const t = k / 4, iy0 = lerp(y0, cy, t), iy1 = lerp(y1, cy, t), ix0 = lerp(x0, px, t), ix1 = lerp(x1, qx, t); x.moveTo(ix0, iy0); x.lineTo(ix1, iy0); x.lineTo(ix1, iy1); x.lineTo(ix0, iy1); x.closePath(); }
  x.stroke(); x.restore();
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = Math.max(1.2, w * .03); x.lineCap = 'round';
  x.beginPath(); x.moveTo(px, cy); x.lineTo(qx, cy); x.moveTo(x0, y0); x.lineTo(px, cy); x.moveTo(x1, y0); x.lineTo(qx, cy); x.stroke();
  x.lineWidth = Math.max(1, w * .02); x.strokeStyle = rgba(mix(col, '#000000', .45), .45); x.beginPath(); x.rect(x0, y0, w, h); x.stroke();
  x.save(); shadowOn(x, 'rgba(40,40,80,.4)', w * .06, w * .05);
  x.fillStyle = '#f4efe8'; x.beginPath(); rrect(x, cx + w * .12, cy + h * .08, w * .14, h * .22, w * .02); x.fill(); x.restore();
  x.fillStyle = '#6b5f73'; x.beginPath(); rrect(x, cx + w * .145, cy + h * .11, w * .09, h * .15, w * .015); x.fill();
}
function bgTown(x, W, H, U, rnd){
  ground(x, W, H, '#d5f2c4', '#b3e2a2', 'rgba(255,255,255,.45)');
  stripes(x, W, H, U, 'rgba(255,255,255,.1)');
  tufts(x, rnd, W, H, U, W * H / (U * U) * .9, 'rgba(60,150,70,.3)', U * .18);
  const L = loopGeom(W, H, U), rw = U * 1.05;
  x.save(); shadowOn(x, 'rgba(40,50,80,.25)', U * .25, U * .1);
  x.beginPath(); rrect(x, L.m, L.m, L.w, L.h, L.r); x.lineWidth = rw + U * .24; x.strokeStyle = '#f3f5fa'; x.stroke(); x.restore();
  x.beginPath(); rrect(x, L.m, L.m, L.w, L.h, L.r); x.lineWidth = rw; x.strokeStyle = '#8a90a5'; x.stroke();
  x.lineWidth = rw * .86; x.strokeStyle = '#959bb0'; x.stroke();
  x.setLineDash([U * .42, U * .34]); x.lineWidth = U * .08; x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineCap = 'butt'; x.stroke(); x.setLineDash([]);
  x.fillStyle = '#959bb0';                                                     // crosswalks (asphalt patch hides the dashes)
  x.fillRect(W / 2 - U * .9, H - L.m - rw * .43, U * 1.8, rw * .86); x.fillRect(W / 2 - U * .9, L.m - rw * .43, U * 1.8, rw * .86);
  x.fillStyle = '#ffffff';
  for (let k = -2; k <= 2; k++) { x.fillRect(W / 2 + k * U * .32 - U * .1, H - L.m - rw / 2 + U * .06, U * .2, rw - U * .12); x.fillRect(W / 2 + k * U * .32 - U * .1, L.m - rw / 2 + U * .06, U * .2, rw - U * .12); }
  const ix = L.m + rw / 2 + U * .3, iy = L.m + rw / 2 + U * .3, iw = W - 2 * ix, ih = H - 2 * iy;   // inner park
  if (iw > U * 3 && ih > U * 3) {
    x.save(); x.beginPath(); rrect(x, ix, iy, iw, ih, U * .9); x.clip();
    const px = ix + iw * .72, py = iy + ih * .62, pr = Math.min(iw, ih) * .16;     // pond
    x.fillStyle = 'rgba(40,120,90,.2)'; x.beginPath(); x.ellipse(px + U * .05, py + U * .1, pr * 1.45, pr, 0, 0, TAU); x.fill();
    let g = x.createRadialGradient(px - pr * .4, py - pr * .4, 0, px, py, pr * 1.4); g.addColorStop(0, '#d8f3ff'); g.addColorStop(.6, '#8fd3ff'); g.addColorStop(1, '#5fb0f0');
    x.fillStyle = g; x.beginPath(); x.ellipse(px, py, pr * 1.4, pr * .95, 0, 0, TAU); x.fill();
    x.lineWidth = U * .1; x.strokeStyle = '#f1e7d0'; x.stroke();
    x.beginPath(); x.ellipse(px - pr * .5, py - pr * .35, pr * .4, pr * .12, -.2, 0, TAU); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill();
    x.restore();
    const TC = ['#6fcf7f', '#5cc277', '#86d98a'];
    tree(x, ix + U * .8, iy + U * .8, U * .55, TC[0]); tree(x, ix + U * 1.7, iy + U * .65, U * .45, TC[1]);
    tree(x, ix + iw - U * .8, iy + U * .85, U * .5, TC[2]); tree(x, ix + U * .75, iy + ih - U * .8, U * .5, TC[1]);
    roof(x, ix + iw * .3, iy + ih * .78, U * 1.6, U * 1.05, '#ff7a7a'); roof(x, ix + iw * .64, iy + ih * .24, U * 1.5, U * 1, '#6aa8ff');
    if (ih > U * 6) roof(x, ix + iw * .3, iy + ih * .42, U * 1.35, U * .95, '#ffc34d');
    for (let i = 0; i < 5; i++) flower(x, ix + rnd() * iw, iy + rnd() * ih, U * .14, ['#ff8fb8', '#ffd84d', '#ffffff'][i % 3], rnd() * TAU);
  }
  const TC = ['#6fcf7f', '#5cc277', '#86d98a'];
  for (const [bx, by] of [[U * .5, U * .5], [W - U * .5, U * .5], [U * .5, H - U * .5], [W - U * .5, H - U * .5]]) tree(x, bx, by, U * .42, TC[Math.floor(rnd() * 3)]);
  for (let py = U * 3; py < H - U * 3; py += U * 2.6) { bush(x, U * .05, py, U * .42, '#7fd88f', rnd, null); bush(x, W - U * .05, py + U * 1.3, U * .42, '#7fd88f', rnd, null); }
  vignette(x, W, H, 'rgba(40,90,70,.18)');
}
// point + heading on the road loop at distance s (for the little toy car)
function loopPoint(s, W, H, U, out){
  const L = loopGeom(W, H, U), r = L.r, a = L.w - 2 * r, b = L.h - 2 * r, q = Math.PI * r / 2, P = 2 * a + 2 * b + 4 * q;
  s = ((s % P) + P) % P;
  const x0 = L.m, y0 = L.m;
  const seg = [[a, (t) => [x0 + r + t, y0, 0]], [q, (t) => { const an = -Math.PI / 2 + t / r; return [x0 + r + a + Math.cos(an) * r, y0 + r + Math.sin(an) * r, an + Math.PI / 2]; }],
    [b, (t) => [x0 + L.w, y0 + r + t, Math.PI / 2]], [q, (t) => { const an = t / r; return [x0 + r + a + Math.cos(an) * r, y0 + r + b + Math.sin(an) * r, an + Math.PI / 2]; }],
    [a, (t) => [x0 + r + a - t, y0 + L.h, Math.PI]], [q, (t) => { const an = Math.PI / 2 + t / r; return [x0 + r + Math.cos(an) * r, y0 + r + b + Math.sin(an) * r, an + Math.PI / 2]; }],
    [b, (t) => [x0, y0 + r + b - t, -Math.PI / 2]], [q, (t) => { const an = Math.PI + t / r; return [x0 + r + Math.cos(an) * r, y0 + r + Math.sin(an) * r, an + Math.PI / 2]; }]];
  for (const [len, f] of seg) { if (s <= len) { const p = f(s); out.x = p[0]; out.y = p[1]; out.a = p[2]; return out; } s -= len; }
  out.x = x0 + r; out.y = y0; out.a = 0; return out;
}

/* pumpkin patch night (halloween): moonlit soil rows, curly vines, glossy pumpkins */
function pumpkin(x, cx, cy, s){
  x.save(); shadowOn(x, 'rgba(5,0,20,.55)', s * .5, s * .25);
  x.beginPath(); x.ellipse(cx, cy, s * 1.05, s * .82, 0, 0, TAU); x.fillStyle = '#d9611a'; x.fill(); x.restore();
  for (const [ox, rx, ry] of [[-.55, .45, .66], [.55, .45, .66], [-.28, .5, .76], [.28, .5, .76], [0, .5, .8]]) {
    const px = cx + ox * s;
    const g = x.createRadialGradient(px - s * .2, cy - s * .35, s * .05, px, cy, s * .85);
    g.addColorStop(0, '#ffc778'); g.addColorStop(.45, '#ff9a3c'); g.addColorStop(1, '#d5581a');
    x.beginPath(); x.ellipse(px, cy, rx * s, ry * s, 0, 0, TAU); x.fillStyle = g; x.fill();
    x.lineWidth = Math.max(1, s * .04); x.strokeStyle = 'rgba(150,50,10,.45)'; x.stroke();
  }
  x.beginPath(); x.ellipse(cx - s * .3, cy - s * .42, s * .22, s * .09, -.4, 0, TAU); x.fillStyle = 'rgba(255,255,255,.55)'; x.fill();
  x.fillStyle = '#6b8f3a'; x.beginPath(); rrect(x, cx - s * .1, cy - s * .92, s * .2, s * .32, s * .07); x.fill();
  x.fillStyle = '#4f8a3e'; x.beginPath(); x.ellipse(cx + s * .3, cy - s * .78, s * .28, s * .13, -.4, 0, TAU); x.fill();
}
function curl(x, cx, cy, s, dir){
  x.beginPath();
  for (let t = 0; t < 1; t += .02) { const a = dir * t * TAU * 1.6, r = s * (1 - t * .8); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  x.stroke();
}
function leaf(x, lx, ly, s, a){
  const lg = x.createRadialGradient(lx - s * .3, ly - s * .3, 0, lx, ly, s * 1.1);
  lg.addColorStop(0, '#86c46f'); lg.addColorStop(1, '#2e6a46');
  x.save(); x.translate(lx, ly); x.rotate(a);
  x.beginPath(); x.moveTo(-s, 0); x.quadraticCurveTo(-s * .2, -s * .75, s, 0); x.quadraticCurveTo(-s * .2, s * .75, -s, 0); x.fillStyle = lg; x.fill();
  x.beginPath(); x.moveTo(-s * .85, 0); x.lineTo(s * .8, 0); x.lineWidth = Math.max(1, s * .08); x.strokeStyle = 'rgba(200,255,180,.35)'; x.stroke();
  x.restore();
}
// a curly vine wandering along a list of points, with leaves and curls
function vine(x, rnd, pts, U){
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; x.quadraticCurveTo(ax + (bx - ax) * .5 + (rnd() - .5) * U * .8, ay + (by - ay) * .5 + (rnd() - .5) * U * .8, bx, by); }
  x.strokeStyle = '#3d7a52'; x.lineWidth = U * .075; x.lineCap = 'round'; x.stroke();
  x.lineWidth = U * .045;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i];
    if (rnd() < .6) curl(x, px + (rnd() - .5) * U * .3, py + (rnd() - .5) * U * .3, U * .2, rnd() < .5 ? 1 : -1);
    leaf(x, px + (rnd() - .5) * U * .5, py + (rnd() - .5) * U * .5, U * (.22 + rnd() * .08), rnd() * TAU);
  }
}
function candyCorn(x, cx, cy, s, a){
  x.save(); x.translate(cx, cy); x.rotate(a);
  shadowOn(x, 'rgba(5,0,20,.5)', s * .4, s * .2);
  x.beginPath(); x.moveTo(0, -s); x.quadraticCurveTo(s * .75, s * .55, s * .55, s * .7); x.quadraticCurveTo(0, s * .85, -s * .55, s * .7); x.quadraticCurveTo(-s * .75, s * .55, 0, -s);
  x.fillStyle = '#ffffff'; x.fill(); shadowOff(x);
  x.save(); x.clip();
  x.fillStyle = '#ff9a2e'; x.fillRect(-s, -s * .25, 2 * s, s * .55);
  x.fillStyle = '#ffd23f'; x.fillRect(-s, s * .3, 2 * s, s);
  x.restore();
  x.beginPath(); x.ellipse(-s * .15, -s * .2, s * .1, s * .35, .2, 0, TAU); x.fillStyle = 'rgba(255,255,255,.6)'; x.fill();
  x.restore();
}
function bgPumpkin(x, W, H, U, rnd){
  ground(x, W, H, '#3a2763', '#1f1538', 'rgba(150,120,230,.16)');
  groundBlobs(x, rnd, W, H, U, Math.round(W * H / (U * U) / 8), 'rgba(140,110,220,.12)', 'rgba(10,5,30,.22)');
  let g = x.createRadialGradient(W * .8, -H * .05, 0, W * .8, -H * .05, Math.max(W, H) * .8);   // moonlight from above
  g.addColorStop(0, 'rgba(215,195,255,.42)'); g.addColorStop(.5, 'rgba(180,150,255,.12)'); g.addColorStop(1, 'rgba(180,150,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  tuftPatches(x, rnd, W, H, U, Math.round(W * H / (U * U) / 3), 'rgba(120,90,200,.42)', 'rgba(170,150,240,.3)');
  specks(x, rnd, W, H, W * H / (U * U) * 1.1, U * .03, 'rgba(255,240,200,.3)');
  // two vines winding through the patch
  for (let v = 0; v < 2; v++) {
    const pts = [], y0 = H * (.32 + .38 * v);
    for (let px = -U; px <= W + U; px += U * 1.3) pts.push([px, y0 + Math.sin(px / (U * 2.2) + v * 2) * U * .9 + (rnd() - .5) * U * .4]);
    vine(x, rnd, pts, U);
  }
  // pumpkins gather in the corners and along the sides
  const P = [];
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const ix = cx ? -1 : 1, iy = cy ? -1 : 1;
    P.push([cx + ix * U * .55, cy + iy * U * .6, U * .78]); P.push([cx + ix * U * 1.55, cy + iy * U * .35, U * .52]); P.push([cx + ix * U * .4, cy + iy * U * 1.6, U * .5]);
  }
  for (let py = U * 3.2; py < H - U * 3; py += U * 2.8) { P.push([U * .45, py + (rnd() - .5) * U, U * (.4 + rnd() * .12)]); P.push([W - U * .45, py + U * 1.2 + (rnd() - .5) * U, U * (.4 + rnd() * .12)]); }
  P.sort((a, b) => a[1] - b[1]);
  for (const [px, py, s] of P) {
    leaf(x, px - s * .9, py + s * .3, s * .45, rnd() * TAU);
    pumpkin(x, px, py, s);
  }
  for (let i = 0; i < 6; i++) candyCorn(x, U * 1.2 + rnd() * (W - U * 2.4), U * 1.2 + rnd() * (H - U * 2.4), U * .2, rnd() * TAU);
  for (let i = 0; i < 4; i++) {                                                 // glowing mushrooms
    const px = U * 1.2 + rnd() * (W - U * 2.4), py = U * 1.2 + rnd() * (H - U * 2.4), s = U * .22;
    g = x.createRadialGradient(px, py, 0, px, py, s * 3.2); g.addColorStop(0, 'rgba(140,255,220,.38)'); g.addColorStop(1, 'rgba(140,255,220,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, s * 3.2, 0, TAU); x.fill();
    mushroom(x, px, py, s, '#9a76ff');
    mushroom(x, px + s * 1.5, py + s * .6, s * .65, '#7fd8ff');
  }
  vignette(x, W, H, 'rgba(8,3,22,.5)');
}

const BG = { unicorn:bgMeadow, sweets:bgCandy, colors:bgRainbow, cars:bgTown, halloween:bgPumpkin };
const SEED = { unicorn:11, sweets:23, colors:37, cars:41, halloween:53 };
const worldId = () => { const w = store.S.ses && store.S.ses.world; return BG[w] ? w : 'unicorn'; };

function buildBg(){
  const W = G.W, H = G.H, d = G.dpr, U = G.U, world = worldId();
  if (art.w === W && art.h === H && art.d === d && art.world === world && art.bg) return;
  art.w = W; art.h = H; art.d = d; art.world = world;
  const cv = art.bg && art.bg.width === Math.round(W * d) && art.bg.height === Math.round(H * d) ? art.bg : canvas(Math.round(W * d), Math.round(H * d));
  const x = cv.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(d, 0, 0, d, 0, 0);
  const rnd = rng(SEED[world] * 7919 + Math.round(W) * 31 + Math.round(H));
  try { BG[world](x, W, H, U, rnd); } catch (e) { console.warn('[worm] background', e); }
  art.bg = cv;
  // ambient life for this world (positions seeded so they stay put)
  const night = world === 'halloween';
  const A = { sparkles:[], bugs:[], fireflies:[], clouds:[], fog:[], car:world === 'cars' ? { s:0, out:{ x:0, y:0, a:0 } } : null };
  if (!night) for (let i = 0; i < 2; i++) A.clouds.push({ off:rnd() * (W + U * 8), y:H * (.2 + .55 * i + rnd() * .1), sp:U * (.22 + rnd() * .12) });
  if (world === 'unicorn' || world === 'sweets' || world === 'colors') for (let i = 0; i < 9; i++) A.sparkles.push({ x:rnd() * W, y:rnd() * H, ph:rnd() * TAU, s:U * (.1 + rnd() * .08) });
  if (world === 'unicorn' || world === 'colors') {
    const BC = world === 'unicorn' ? [['#ffb3dc', '#c9a8ff'], ['#bfe0ff', '#ffd1ea']] : [['#ffd84d', '#ff9a4d'], ['#7cc8ff', '#b58cff']];
    for (let i = 0; i < 2; i++) A.bugs.push({ cx:W * (.25 + .5 * i), cy:H * (.3 + .4 * i), ph:rnd() * TAU, c1:BC[i][0], c2:BC[i][1], x:0, y:0 });
  }
  if (night) {
    for (let i = 0; i < 11; i++) A.fireflies.push({ x:rnd() * W, y:rnd() * H, ph:rnd() * TAU, sp:.4 + rnd() * .5 });
    for (let i = 0; i < 2; i++) A.fog.push({ off:rnd() * (W + U * 8), y:H * (.3 + .45 * i), sp:U * .18 });
  }
  art.amb = A;
}
function ensureArt(){ if (!G.U || !G.W) return; buildSprites(); buildBg(); }

/* ---------- pools: particles, ripples, "+1" floats ---------- */
const PARTS = []; for (let i = 0; i < 120; i++) PARTS.push({ on:false, x:0, y:0, vx:0, vy:0, t:0, life:1, s:1, k:0, c:'#fff', rot:0, vr:0, g:0 });
const RIPS = []; for (let i = 0; i < 4; i++) RIPS.push({ on:false, x:0, y:0, t:0 });
const FLOATS = []; for (let i = 0; i < 4; i++) FLOATS.push({ on:false, x:0, y:0, t:0 });
let pi = 0;
function emit(x, y, n, speed, size, kinds, gravity = 0, spread = TAU, dir = 0){
  if (REDUCE) n = Math.min(n, 4);
  for (let i = 0; i < n; i++) {
    const p = PARTS[pi]; pi = (pi + 1) % PARTS.length;
    const a = dir + (Math.random() - .5) * spread, v = speed * (.45 + Math.random() * .75);
    p.on = true; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.t = 0; p.life = .55 + Math.random() * .5;
    p.s = size * (.6 + Math.random() * .7); p.k = kinds[i % kinds.length]; p.c = SPARK_COLS[(Math.random() * SPARK_COLS.length) | 0];
    p.rot = Math.random() * TAU; p.vr = (Math.random() - .5) * 8; p.g = gravity;
  }
}
function ripple(x, y){ const r = RIPS.find(o => !o.on) || RIPS[0]; r.on = true; r.x = x; r.y = y; r.t = 0; }
function floatPlus(x, y){ const f = FLOATS.find(o => !o.on) || FLOATS[0]; f.on = true; f.x = x; f.y = y; f.t = 0; }
const K_STAR = [0, 0, 1], K_MIX = [0, 1, 2, 0, 1], K_DOT = [1];

/* ---------- the worm ---------- */
let st = null;   // worm runtime: mouth, moods, blink, gulp wave, steering memory, etc.
let safe = { x0:0, y0:0, x1:0, y1:0 }, keepOut = [];
const mouthPt = { x:0, y:0 };

function setupWorm(){
  const U = G.U, gp = U * GAP;
  G.head = { x:G.W / 2, y:G.H * .64, a:-Math.PI / 2, av:0 };
  G.segs = []; for (let i = 0; i < START_SEGS; i++) G.segs.push({ x:G.W / 2, y:G.H * .64 + (i + 1) * gp, s:1 });
}
function speed(){ return G.U * (BASE_SPEED + Math.min(1.3, (G.segs.length - START_SEGS) * .14)); }

// play area for item centres: inside the field with a margin, and away from anything drawn over the canvas (HUD, cue)
function computeSafe(){
  const r = itemR(), pad = r + G.U * .3;
  safe = { x0:pad, y0:pad, x1:Math.max(pad, G.W - pad), y1:Math.max(pad, G.H - pad) };
  keepOut = [];
  try {
    const cr = G.cv.getBoundingClientRect();
    const els = [...G.field.querySelectorAll(':scope > :not(canvas)'), ...document.querySelectorAll('.bar, .ask, .hud, header')];
    for (const el of els) {
      if (el.hidden || el.contains(G.cv)) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const x0 = b.left - cr.left, y0 = b.top - cr.top, x1 = b.right - cr.left, y1 = b.bottom - cr.top;
      if (x1 <= 0 || y1 <= 0 || x0 >= G.W || y0 >= G.H) continue;
      if (x0 <= 4 && x1 >= G.W - 4) {                                              // a full-width band: just shrink the field
        if (y0 <= 4) { safe.y0 = Math.max(safe.y0, y1 + r + 6); continue; }
        if (y1 >= G.H - 4) { safe.y1 = Math.min(safe.y1, y0 - r - 6); continue; }
      }
      keepOut.push({ x0:x0 - r - 6, y0:y0 - r - 6, x1:x1 + r + 6, y1:y1 + r + 6 });
    }
  } catch (e) { /* layout not ready: margins only */ }
  if (safe.y1 < safe.y0) { const m = (safe.y0 + safe.y1) / 2; safe.y0 = safe.y1 = m; }
}
const inKeepOut = (x, y) => keepOut.some(k => x > k.x0 && x < k.x1 && y > k.y0 && y < k.y1);
function placeItem(it){
  const U = G.U, h = G.head;
  let best = null, bestScore = -1;
  for (let k = 0; k < 90; k++) {
    const x = lerp(safe.x0, safe.x1, Math.random()), y = lerp(safe.y0, safe.y1, Math.random());
    if (inKeepOut(x, y)) continue;
    let score = 1e9;
    if (h) {
      score = Math.min(score, Math.hypot(x - h.x, y - h.y) / (U * 3.2));
      // not right in front of the moving head either
      const fx = h.x + Math.cos(h.a) * U * 2, fy = h.y + Math.sin(h.a) * U * 2;
      score = Math.min(score, Math.hypot(x - fx, y - fy) / (U * 2.2));
      for (let i = 0; i < G.segs.length; i += 2) score = Math.min(score, Math.hypot(x - G.segs[i].x, y - G.segs[i].y) / (U * 1.4));
    }
    for (const o of G.items) if (o !== it && o.x != null) score = Math.min(score, Math.hypot(x - o.x, y - o.y) / (it.r * 2.7));
    if (score >= 1) { it.x = x; it.y = y; return; }
    if (score > bestScore) { bestScore = score; best = [x, y]; }
  }
  if (!best) best = [lerp(safe.x0, safe.x1, .5), lerp(safe.y0, safe.y1, .3)];
  it.x = best[0]; it.y = best[1];
}

const worm = {
  init(){
    st = { mouth:0, happy:0, surprise:0, blink:0, blinkIn:1.5 + Math.random() * 2, gulp:-1, grow:0, wander:Math.random() * 10,
      oopsCool:0, leaving:[], puff:0, recoil:0, recoilT:0 };
    for (const p of PARTS) p.on = false; for (const r of RIPS) r.on = false; for (const f of FLOATS) f.on = false;
    G.aim = null; G.chomp = 0; G.head = null; G.segs = [];
    if (G.W && G.U) { ensureArt(); setupWorm(); }
  },
  resize(){
    ensureArt();
    if (!G.head) return;
    const R = headR();
    G.head.x = clamp(G.head.x, R, G.W - R); G.head.y = clamp(G.head.y, R, G.H - R);
    for (const s of G.segs) { s.x = clamp(s.x, 0, G.W); s.y = clamp(s.y, 0, G.H); }
    computeSafe();
    for (const it of G.items) { it.r = itemR(); if (it.x != null) { it.x = clamp(it.x, safe.x0, safe.x1); it.y = clamp(it.y, safe.y0, safe.y1); } }
  },
  round(){
    if (!st) worm.init();
    if (!G.head && G.W) { ensureArt(); setupWorm(); }
    for (const it of G.items) if (it.state === 'idle') { it.state = 'leave'; it.lt = 0; st.leaving.push(it); emit(it.x, it.y, 5, G.U * 2.5, G.U * .12, K_DOT); }
    G.items = [];
    if (!G.W) return;
    computeSafe();
    const n = G.round < 2 ? 3 : 4;
    pickSet(n).forEach((j, k) => {
      const w = sw(j);
      if (!w.color) getImage(w.pic);
      const it = { j, k, w, r:itemR(), s:0, delay:.15 + k * .13, ph:Math.random() * TAU, state:'idle', vx:0, vy:0, wob:0, cool:0, et:0, lt:0, popped:false };
      G.items.push(it); placeItem(it);
    });
  },
  press(x, y){ G.aim = { x, y }; ripple(x, y); if (st) st.steerT = G.t; },
  move(x, y, e){ if (G.down || (e && e.pointerType === 'mouse')) { if (G.aim) { G.aim.x = x; G.aim.y = y; } else G.aim = { x, y }; if (st) st.steerT = G.t; } },
  key(e){
    const d = { ArrowUp:[0, -1], ArrowDown:[0, 1], ArrowLeft:[-1, 0], ArrowRight:[1, 0] }[e.key];
    if (!d || !G.head) return false;
    G.aim = { x:G.head.x + d[0] * G.W, y:G.head.y + d[1] * G.H };
    if (st) st.steerT = G.t;
    return true;
  },
  update(dt){
    if (!G.W || !G.U) return;
    if (!st) worm.init();
    if (!G.head) { ensureArt(); setupWorm(); computeSafe(); for (const it of G.items) placeItem(it); }
    steer(dt);
    body(dt);
    moods(dt);
    items(dt);
    pools(dt);
  },
  draw(c){
    if (!G.W || !G.U || !G.head) return;
    ensureArt();
    if (art.bg) c.drawImage(art.bg, 0, 0, G.W, G.H);
    ambientGround(c);
    drawRipples(c);
    for (let i = 0; i < st.leaving.length; i++) drawItem(c, st.leaving[i]);
    for (let i = 0; i < G.items.length; i++) if (G.items[i].state !== 'eat') drawItem(c, G.items[i]);
    drawWorm(c);
    for (let i = 0; i < G.items.length; i++) if (G.items[i].state === 'eat') drawItem(c, G.items[i]);
    ambientAir(c);
    drawParticles(c);
    drawFloats(c);
  },
  // tests: move the pointer onto the target picture
  testHint(){
    if (G.done || !G.items) return null;
    const it = G.items.find(o => o.state === 'idle' && o.j === G.target && o.s >= .7);
    return it ? { action:'move', x:it.x, y:it.y } : null;
  },
};

/* ---------- update ---------- */
function steer(dt){
  const h = G.head, U = G.U, R = headR(), sp = speed();
  const m = R + U * .1;
  let want = null, aimD = 1e9;
  if (G.aim) {
    const ax = clamp(G.aim.x, m + U * .45, G.W - m - U * .45), ay = clamp(G.aim.y, m + U * .45, G.H - m - U * .45);
    aimD = Math.hypot(ax - h.x, ay - h.y);
    if (aimD < U * .5 && !G.down) G.aim = null;
    else want = Math.atan2(ay - h.y, ax - h.x);
  }
  const maxT = 6.4 * sp / (U * 4.5);   // same turning circle at any speed
  let targetAv;
  // look ahead: curve away from the walls before reaching them
  const look = U * 1.35, lx = h.x + Math.cos(h.a) * look, ly = h.y + Math.sin(h.a) * look;
  const nearWall = lx < m || lx > G.W - m || ly < m || ly > G.H - m;
  if (nearWall && aimD > look * 1.2) want = Math.atan2(G.H * .5 - h.y, G.W * .5 - h.x);
  if (want != null) {
    let diff = want - h.a; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    targetAv = clamp(diff * 7, -maxT, maxT);
  } else {
    st.wander += dt;
    targetAv = Math.sin(st.wander * .9) * 1.1 + Math.sin(st.wander * 2.3) * .4;   // gentle meander when nobody steers
  }
  h.av += (targetAv - h.av) * Math.min(1, dt * 11);
  h.a += h.av * dt;
  if (st.recoilT > 0) { const k = Math.min(dt, st.recoilT); h.a += st.recoil * k / .2; st.recoilT -= dt; }
  if (h.a > Math.PI) h.a -= TAU; else if (h.a < -Math.PI) h.a += TAU;
  h.x += Math.cos(h.a) * sp * dt; h.y += Math.sin(h.a) * sp * dt;
  // hard stop at the edges (rarely reached): slide along the wall
  if (h.x < R) { h.x = R; if (Math.cos(h.a) < 0) h.a = Math.PI - h.a; }
  if (h.x > G.W - R) { h.x = G.W - R; if (Math.cos(h.a) > 0) h.a = Math.PI - h.a; }
  if (h.y < R) { h.y = R; if (Math.sin(h.a) < 0) h.a = -h.a; }
  if (h.y > G.H - R) { h.y = G.H - R; if (Math.sin(h.a) > 0) h.a = -h.a; }
}
function body(dt){
  const gp = G.U * GAP, segs = G.segs;
  let px = G.head.x, py = G.head.y, first = true;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], g = first ? gp * 1.18 : gp;
    const dx = s.x - px, dy = s.y - py, d = Math.hypot(dx, dy) || 1;
    if (d > g) { s.x = px + dx / d * g; s.y = py + dy / d * g; }
    if (s.s < 1) s.s = Math.min(1, s.s + dt * 3.2);
    px = s.x; py = s.y; first = false;
  }
  if (st.gulp >= 0) {                                                           // swallowed bump travels to the tail, then it grows
    st.gulp += dt * 11;
    if (st.gulp > segs.length + .6) {
      st.gulp = -1;
      const t = segs[segs.length - 1];
      segs.push({ x:t.x, y:t.y, s:0 });
      emit(t.x, t.y, 6, G.U * 2.2, G.U * .12, K_STAR);
    }
  }
}
function moods(dt){
  st.happy = Math.max(0, st.happy - dt);
  st.surprise = Math.max(0, st.surprise - dt);
  st.puff = Math.max(0, st.puff - dt * 2.5);
  st.oopsCool = Math.max(0, st.oopsCool - dt);
  st.blinkIn -= dt;
  if (st.blinkIn <= 0) { st.blink = .16; st.blinkIn = 2.2 + Math.random() * 2.6; if (Math.random() < .2) st.blinkIn = .3; }
  st.blink = Math.max(0, st.blink - dt);
  // mouth opens when food is close in front, wide while swallowing
  const h = G.head, fx = Math.cos(h.a), fy = Math.sin(h.a);
  let want = 0;
  for (let i = 0; i < G.items.length; i++) {
    const it = G.items[i];
    if (it.state === 'eat') { want = 1; break; }
    if (it.state !== 'idle' || it.s < .7) continue;
    const dx = it.x - h.x, dy = it.y - h.y, d = Math.hypot(dx, dy) || 1;
    if ((dx * fx + dy * fy) / d > .45) want = Math.max(want, clamp((G.U * 3 - d) / (G.U * 1.6), 0, .75));
  }
  if (st.happy > 0 && want < 1) want = Math.max(want, st.happy > 1.1 ? .6 : 0);
  st.mouth += (want - st.mouth) * Math.min(1, dt * (want > st.mouth ? 16 : 9));
}
function items(dt){
  const h = G.head, U = G.U, R = headR();
  // where the mouth is (for the swallow animation)
  faceGeom(); mouthPt.x = FACE.mx; mouthPt.y = FACE.my;
  for (let i = 0; i < G.items.length; i++) {
    const it = G.items[i];
    if (it.delay > 0) { it.delay -= dt; if (it.delay <= 0 && !it.popped) { it.popped = true; emit(it.x, it.y, 8, U * 3, U * .13, K_STAR); } continue; }
    if (it.state === 'eat') {
      it.et += dt / .34;
      if (it.et >= 1) {
        it.state = 'gone';
        emit(mouthPt.x, mouthPt.y, 14, U * 4.5, U * .17, K_MIX);
        st.gulp = 0; st.puff = 1;
        try { sfx.pop(); } catch (e) {}
      }
      continue;
    }
    if (it.state !== 'idle') continue;
    if (it.s < 1) it.s = Math.min(1, it.s + dt * 2.6);
    it.wob = Math.max(0, it.wob - dt * 1.4);
    it.cool = Math.max(0, it.cool - dt);
    if (it.vx || it.vy) {                                                         // bounced away: glide, slow down, bump the walls
      it.x += it.vx * dt; it.y += it.vy * dt;
      const f = Math.exp(-2.7 * dt); it.vx *= f; it.vy *= f;
      if (it.x < safe.x0) { it.x = safe.x0; it.vx = Math.abs(it.vx) * .85; } else if (it.x > safe.x1) { it.x = safe.x1; it.vx = -Math.abs(it.vx) * .85; }
      if (it.y < safe.y0) { it.y = safe.y0; it.vy = Math.abs(it.vy) * .85; } else if (it.y > safe.y1) { it.y = safe.y1; it.vy = -Math.abs(it.vy) * .85; }
      if (Math.abs(it.vx) + Math.abs(it.vy) < U * .05) { it.vx = 0; it.vy = 0; }
    }
    if (G.done || it.s < .7 || it.cool > 0) continue;
    const dx = it.x - h.x, dy = it.y - h.y, d = Math.hypot(dx, dy);
    if (d < R * .8 + it.r * .82) {
      if (it.j === G.target) {
        it.state = 'eat'; it.et = 0; it.ex = it.x; it.ey = it.y;
        st.happy = 1.6; st.mouth = Math.max(st.mouth, .7);
        floatPlus(it.x, it.y - it.r * .4);
        emit(it.x, it.y, 18, U * 5, U * .2, K_MIX, U * 2);
        gotIt(it.x, it.y);
      } else {
        const n = d || 1, push = U * 11;
        it.vx = dx / n * push; it.vy = dy / n * push; it.wob = 1; it.cool = 1.4;
        st.surprise = .9;
        let away = Math.atan2(-dy, -dx) - h.a; away = Math.atan2(Math.sin(away), Math.cos(away));
        st.recoil = away * .75; st.recoilT = .2;                                   // the worm bonks and turns away
        emit(it.x - dx / n * it.r, it.y - dy / n * it.r, 6, U * 2.5, U * .1, K_DOT);
        const steering = G.down || G.t - (st.steerT ?? -99) < 1.5;           // only her own moves count as a wrong pick
        if (steering && st.oopsCool <= 0) { st.oopsCool = .9; oops(it.j); }
      }
    }
  }
  // keep bubbles from overlapping after bounces
  for (let a = 0; a < G.items.length; a++) for (let b = a + 1; b < G.items.length; b++) {
    const A = G.items[a], B = G.items[b];
    if (A.state !== 'idle' || B.state !== 'idle' || A.delay > 0 || B.delay > 0) continue;
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, min = (A.r + B.r) * 1.08;
    if (d < min) {
      const p = Math.min((min - d) * .5, U * 6 * dt), ux = dx / d, uy = dy / d;
      A.x = clamp(A.x - ux * p, safe.x0, safe.x1); A.y = clamp(A.y - uy * p, safe.y0, safe.y1);
      B.x = clamp(B.x + ux * p, safe.x0, safe.x1); B.y = clamp(B.y + uy * p, safe.y0, safe.y1);
    }
  }
  let n = 0;
  for (let i = 0; i < st.leaving.length; i++) { const it = st.leaving[i]; it.lt += dt * 3.5; if (it.lt < 1) st.leaving[n++] = it; }
  st.leaving.length = n;
}
function pools(dt){
  for (let i = 0; i < PARTS.length; i++) {
    const p = PARTS[i]; if (!p.on) continue;
    p.t += dt; if (p.t >= p.life) { p.on = false; continue; }
    const f = Math.exp(-2.6 * dt); p.vx *= f; p.vy = p.vy * f + p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
  for (let i = 0; i < RIPS.length; i++) { const r = RIPS[i]; if (r.on && (r.t += dt) > .5) r.on = false; }
  for (let i = 0; i < FLOATS.length; i++) { const f = FLOATS[i]; if (f.on && (f.t += dt) > 1.25) f.on = false; }
}

/* ---------- drawing ---------- */
const FACE = { x:0, y:0, ox:0, oy:0, mx:0, my:0, R:0, tilt:0 };
function faceGeom(){
  const h = G.head, R = headR(), fx = Math.cos(h.a), fy = Math.sin(h.a);
  let hx = h.x, hy = h.y;
  if (st && st.surprise > 0 && !REDUCE) hx += Math.sin(G.t * 40) * R * .06 * st.surprise;
  FACE.x = hx; FACE.y = hy; FACE.R = R;
  FACE.ox = fx * R * .17; FACE.oy = fy * R * .13 + R * .04;
  FACE.mx = hx + FACE.ox; FACE.my = hy + FACE.oy + R * .3;
  FACE.tilt = REDUCE ? 0 : clamp(fx * .12 + h.av * .02, -.2, .2);
}
function drawWorm(c){
  const U = G.U, t = REDUCE ? 0 : G.t, segs = G.segs, n = segs.length, R = headR();
  const rb = SP.ballR, sh = SP.shadow;
  faceGeom();
  // 1) soft ground shadows under everything
  for (let i = n - 1; i >= 0; i--) {
    const s = segs[i], r = segRadius(i, n) * s.s;
    put(c, sh, s.x + r * .12, s.y + r * .42, r * 2.5, r * 1.9);
  }
  put(c, sh, FACE.x + R * .1, FACE.y + R * .48, R * 2.6, R * 2);
  // 2) glossy body, tail first; a crawl wave runs along it
  let px = FACE.x, py = FACE.y;
  for (let i = 0; i < n; i++) { const s = segs[i]; s.dx = px - s.x; s.dy = py - s.y; px = s.x; py = s.y; }
  for (let i = n - 1; i >= 0; i--) {
    const s = segs[i], d = Math.hypot(s.dx, s.dy) || 1;
    let r = segRadius(i, n) * popEase(s.s);
    if (st.gulp >= 0) r *= 1 + .34 * Math.max(0, 1 - Math.abs(i - st.gulp) / 1.4);
    r *= 1 + .05 * Math.sin(t * 9 - i * .9);
    const w = Math.sin(t * 8 - i * .75) * U * .06, ox = -s.dy / d * w, oy = s.dx / d * w;
    const sp = SP.ball[i % SP.ball.length], k = sp.cw * r / rb;
    if (r > .5) c.drawImage(sp, s.x + ox - k / 2, s.y + oy - k / 2, k, k);
  }
  // 3) head with face, antennae and bow
  drawHead(c, t);
}
const segRadius = (i, n) => segR() * (1 - i / (n + 3) * .42);
function drawHead(c, t){
  const R = FACE.R, x = FACE.x, y = FACE.y, puff = st.puff;
  c.save(); c.translate(x, y); c.rotate(FACE.tilt);
  const sx = 1 + .1 * puff + .04 * st.mouth, sy = 1 - .05 * puff;
  // antennae (behind the head)
  const sway = Math.sin(t * 3.1) * R * .08, lag = clamp(-G.head.av * R * .05, -R * .25, R * .25);
  c.lineCap = 'round'; c.strokeStyle = '#6a2f78'; c.lineWidth = Math.max(1.5, R * .085);
  for (let side = -1; side <= 1; side += 2) {
    const bx = side * R * .36, by = -R * .72, tx = side * R * .7 + sway * side + lag, ty = -R * 1.42 + Math.cos(t * 3.4 + side) * R * .05;
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(side * R * .3, -R * 1.25, tx, ty); c.stroke();
    put(c, SP.tip, tx, ty - R * .02, SP.tip.cw);
  }
  const hk = SP.head.cw * R / SP.headR;
  c.drawImage(SP.head, -hk * sx / 2, -hk * sy / 2, hk * sx, hk * sy);
  // face looks where the worm goes
  const fx = FACE.ox, fy = FACE.oy;
  const ck = SP.blush.cw;
  put(c, SP.blush, fx - R * .54, fy + R * .17, ck * (1 + .3 * puff), ck * .72 * (1 + .3 * puff));
  put(c, SP.blush, fx + R * .54, fy + R * .17, ck * (1 + .3 * puff), ck * .72 * (1 + .3 * puff));
  const lookx = Math.cos(G.head.a) * R * .04, looky = Math.sin(G.head.a) * R * .04;
  const ex = R * .33, ey = fy - R * .1, erx = R * .145 * (st.surprise > 0 ? 1.15 : 1), ery = R * .195 * (st.surprise > 0 ? 1.15 : 1);
  c.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    const cx = fx + side * ex + lookx, cy = ey + looky;
    if (st.happy > 0 && st.happy < 1.45) {                                       // happy ^ ^
      c.beginPath(); c.arc(cx, cy + ery * .35, erx * 1.05, Math.PI * 1.15, Math.PI * 1.85);
      c.lineWidth = Math.max(2, R * .085); c.strokeStyle = '#3b1f4e'; c.stroke();
    } else if (st.blink > 0) {                                                   // blink
      c.beginPath(); c.arc(cx, cy - ery * .2, erx * .95, Math.PI * .2, Math.PI * .8);
      c.lineWidth = Math.max(2, R * .075); c.strokeStyle = '#3b1f4e'; c.stroke();
    } else {
      c.beginPath(); c.ellipse(cx, cy, erx, ery, 0, 0, TAU); c.fillStyle = '#3b1f4e'; c.fill();
      c.beginPath(); c.ellipse(cx, cy + ery * .45, erx * .62, ery * .34, 0, 0, TAU); c.fillStyle = '#7d4fae'; c.fill();
      c.beginPath(); c.arc(cx + erx * .28, cy - ery * .36, erx * .42, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
      c.beginPath(); c.arc(cx - erx * .34, cy + ery * .38, erx * .17, 0, TAU); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();
      c.beginPath();                                                             // lashes
      c.moveTo(cx + side * erx * .7, cy - ery * .62); c.lineTo(cx + side * erx * 1.15, cy - ery * .95);
      c.moveTo(cx + side * erx * .95, cy - ery * .25); c.lineTo(cx + side * erx * 1.42, cy - ery * .42);
      c.lineWidth = Math.max(1.5, R * .05); c.strokeStyle = '#3b1f4e'; c.stroke();
    }
  }
  // mouth
  const mx = fx, my = fy + R * .3, m = st.mouth;
  if (st.surprise > 0 && m < .3) {
    c.beginPath(); c.ellipse(mx, my + R * .02, R * .08, R * .1, 0, 0, TAU); c.fillStyle = '#9e2257'; c.fill();
  } else if (m < .08) {
    c.beginPath(); c.arc(mx, my - R * .1, R * .16, Math.PI * .18, Math.PI * .82);
    c.lineWidth = Math.max(2, R * .07); c.strokeStyle = '#b0306a'; c.stroke();
  } else {
    const w = R * (.17 + .08 * m), dpt = R * (.08 + .3 * m);
    c.beginPath(); c.moveTo(mx - w, my - R * .06); c.quadraticCurveTo(mx, my - R * .1, mx + w, my - R * .06);
    c.bezierCurveTo(mx + w, my - R * .06 + dpt * 1.3, mx - w, my - R * .06 + dpt * 1.3, mx - w, my - R * .06); c.closePath();
    c.fillStyle = '#8f1d4f'; c.fill();
    c.save(); c.clip();
    c.beginPath(); c.ellipse(mx, my - R * .06 + dpt * .95, w * .7, dpt * .5, 0, 0, TAU); c.fillStyle = '#ff7a9c'; c.fill();
    c.restore();
    c.lineWidth = Math.max(1.5, R * .05); c.strokeStyle = '#7a1742'; c.stroke();
  }
  // bow on top
  const bk = SP.bow.cw;
  c.save(); c.translate(R * .5, -R * .66); c.rotate(.35 + Math.sin(t * 2.2) * .05);
  c.drawImage(SP.bow, -bk / 2, -bk / 2, bk, bk); c.restore();
  c.restore();
}
function drawItem(c, it){
  if (it.delay > 0 || it.x == null || it.state === 'gone') return;
  const U = G.U, r = it.r, t = REDUCE ? 0 : G.t;
  let s = it.s < 1 ? popEase(clamp(it.s, 0, 1)) : 1, x = it.x, y = it.y, rot = 0, sx = 1, sy = 1;
  const bob = Math.sin(t * 2.4 + it.ph);
  if (it.state === 'idle' || it.state === 'leave') { y += bob * U * .07; rot = Math.sin(t * 1.6 + it.ph) * .06; }
  if (it.wob > 0) { const w = Math.sin(G.t * 26) * it.wob * .2; sx = 1 + w; sy = 1 - w; rot += Math.sin(G.t * 17) * it.wob * .3; }
  if (it.state === 'eat') { const e = easeIn(Math.min(1, it.et)); x = lerp(it.ex, mouthPt.x, e); y = lerp(it.ey, mouthPt.y, e); s = 1 - e * .88; rot = e * 4.5; sx = 1 - e * .25; }
  else if (it.state === 'leave') s *= 1 - easeIn(Math.min(1, it.lt));
  if (s <= .02) return;
  if (it.state !== 'eat') put(c, SP.shadow, it.x + r * .12, it.y + r * .5, r * 2.1 * s * (1 - bob * .05), r * 1.3 * s * (1 - bob * .05));
  if (it.state === 'idle' && G.hint && !G.done && it.j === G.target) {           // golden glow + orbiting twinkles after the hint
    const p = (Math.sin(G.t * 6) + 1) / 2, hk = SP.halo.cw * s * (1 + .1 * p);
    c.globalAlpha = .75 + .25 * p; c.drawImage(SP.halo, x - hk / 2, y - hk / 2, hk, hk); c.globalAlpha = 1;
    c.beginPath();
    for (let k = 0; k < 4; k++) { const a = G.t * 1.8 + k * Math.PI / 2, rr = r * 1.32 * s; star4(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr, U * (.12 + .06 * Math.sin(G.t * 9 + k))); }
    c.fillStyle = '#fff6c4'; c.fill();
  }
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s * sx, s * sy);
  const bs = SP.bubble[it.k % SP.bubble.length], bk = bs.cw * r / SP.itemR;
  c.drawImage(bs, -bk / 2, -bk / 2, bk, bk);
  drawPic(c, it.w, 0, 0, r * 1.32);
  c.drawImage(SP.gloss, -bk / 2, -bk / 2, bk, bk);
  c.restore();
}
function drawRipples(c){
  for (let i = 0; i < RIPS.length; i++) {
    const rp = RIPS[i]; if (!rp.on) continue;
    const k = rp.t / .5;
    c.beginPath(); c.arc(rp.x, rp.y, G.U * (.25 + .75 * easeOut(k)), 0, TAU);
    c.lineWidth = G.U * .12 * (1 - k); c.strokeStyle = 'rgba(255,255,255,' + (.9 * (1 - k)).toFixed(3) + ')'; c.stroke();
  }
}
function drawParticles(c){
  const d = G.dpr;
  for (let i = 0; i < PARTS.length; i++) {
    const p = PARTS[i]; if (!p.on) continue;
    const k = p.t / p.life, a = k < .7 ? 1 : 1 - (k - .7) / .3, s = p.s * (k < .2 ? .5 + k * 2.5 : 1);
    if (s <= 0) continue;
    c.globalAlpha = a; c.fillStyle = p.c;
    const co = Math.cos(p.rot) * d, si = Math.sin(p.rot) * d;
    c.setTransform(co, si, -si, co, p.x * d, p.y * d);
    c.beginPath();
    if (p.k === 0) star4(c, 0, 0, s);
    else if (p.k === 1) c.arc(0, 0, s * .45, 0, TAU);
    else heartPath(c, 0, 0, s * .8);
    c.fill();
  }
  c.setTransform(d, 0, 0, d, 0, 0); c.globalAlpha = 1;
}
function drawFloats(c){
  const star = getImage('star'), U = G.U;
  for (let i = 0; i < FLOATS.length; i++) {
    const f = FLOATS[i]; if (!f.on) continue;
    const k = f.t / 1.25, rise = easeOut(Math.min(1, k * 1.3)) * U * 1.5, sc = k < .25 ? popEase(k / .25) : 1, a = k < .7 ? 1 : 1 - (k - .7) / .3;
    const x = f.x, y = f.y - rise, sz = U * .78 * sc;
    c.globalAlpha = a;
    if (star.complete && star.naturalWidth) c.drawImage(star, x - sz * 1.05, y - sz / 2, sz, sz);
    c.font = SP.font; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = U * .14; c.strokeStyle = '#ffffff'; c.strokeText('+1', x - sz * .02, y + U * .03);
    c.fillStyle = '#ff9d00'; c.fillText('+1', x - sz * .02, y + U * .03);
  }
  c.globalAlpha = 1;
}
const cursor = { x:0, y:0, a:0 };
function ambientGround(c){
  const A = art.amb; if (!A) return;
  const t = REDUCE ? 0 : G.t, W = G.W, U = G.U;
  if (A.car) {
    loopPoint(t * U * 1.6, W, G.H, U, cursor);
    const k = SP.car.cw, co = Math.cos(cursor.a), si = Math.sin(cursor.a), d = G.dpr;
    c.setTransform(co * d, si * d, -si * d, co * d, cursor.x * d, (cursor.y + U * .18) * d);
    c.drawImage(SP.car, -k / 2, -k / 2, k, k);
    c.setTransform(d, 0, 0, d, 0, 0);
  }
  if (A.clouds.length) {
    c.globalAlpha = .07;
    for (let i = 0; i < A.clouds.length; i++) {
      const cl = A.clouds[i], span = W + U * 8, x = ((cl.off + t * cl.sp) % span) - U * 4;
      put(c, SP.cloud, x, cl.y, SP.cloud.cw, SP.cloud.cw * .6);
    }
    c.globalAlpha = 1;
  }
  if (A.sparkles.length) {
    c.fillStyle = '#ffffff';
    for (let i = 0; i < A.sparkles.length; i++) {
      const sp = A.sparkles[i], a = Math.max(0, Math.sin(t * 1.7 + sp.ph));
      if (a < .05) continue;
      c.globalAlpha = a * .9; c.beginPath(); star4(c, sp.x, sp.y, sp.s * (.6 + .4 * a)); c.fill();
    }
    c.globalAlpha = 1;
  }
}
function ambientAir(c){
  const A = art.amb; if (!A) return;
  const t = REDUCE ? 0 : G.t, U = G.U, d = G.dpr;
  for (let i = 0; i < A.bugs.length; i++) {                                     // butterflies drifting on lazy loops
    const b = A.bugs[i], q = t * .35 + b.ph;
    const x = b.cx + Math.sin(q) * G.W * .28, y = b.cy + Math.sin(q * 1.7) * G.H * .18;
    const dx = Math.cos(q) * G.W * .28, dy = Math.cos(q * 1.7) * 1.7 * G.H * .18, a = Math.atan2(dy, dx);
    const f = .3 + .7 * Math.abs(Math.sin(t * 13 + b.ph)), s = U * .32, co = Math.cos(a) * d, si = Math.sin(a) * d;
    c.setTransform(co, si, -si, co, x * d, y * d);
    c.fillStyle = 'rgba(60,30,90,.1)'; c.beginPath(); c.ellipse(-s * .4, s * .9, s * .55, s * .4 * f, 0, 0, TAU); c.fill();
    c.fillStyle = b.c1; c.beginPath(); c.ellipse(s * .15, -s * .52 * f, s * .5, s * .55 * f, -.35, 0, TAU); c.ellipse(s * .15, s * .52 * f, s * .5, s * .55 * f, .35, 0, TAU); c.fill();
    c.fillStyle = b.c2; c.beginPath(); c.ellipse(-s * .3, -s * .36 * f, s * .32, s * .36 * f, .3, 0, TAU); c.ellipse(-s * .3, s * .36 * f, s * .32, s * .36 * f, -.3, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(s * .25, -s * .6 * f, s * .12, 0, TAU); c.arc(s * .25, s * .6 * f, s * .12, 0, TAU); c.fill();
    c.fillStyle = '#5a2f6e'; c.beginPath(); c.ellipse(0, 0, s * .45, s * .1, 0, 0, TAU); c.fill();
  }
  if (A.bugs.length) c.setTransform(d, 0, 0, d, 0, 0);
  for (let i = 0; i < A.fog.length; i++) {
    const fg = A.fog[i], span = G.W + U * 8, x = ((fg.off + t * fg.sp) % span) - U * 4;
    c.globalAlpha = .35; put(c, SP.fog, x, fg.y, SP.fog.cw, SP.fog.cw * .5);
  }
  for (let i = 0; i < A.fireflies.length; i++) {
    const f = A.fireflies[i], q = t * f.sp + f.ph;
    const x = f.x + Math.sin(q) * U * 1.2, y = f.y + Math.cos(q * .8) * U * .9, a = .35 + .65 * Math.max(0, Math.sin(t * 2.3 + f.ph * 3));
    c.globalAlpha = a; put(c, SP.glow, x, y, SP.glow.cw * (.7 + .3 * a));
  }
  c.globalAlpha = 1;
}


registerGame('worm', worm);
