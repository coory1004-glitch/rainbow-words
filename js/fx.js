// fx.js (owner: engine) — confetti bursts, wiggles, toasts and the flying star.
//   burst(x, y, n), burstAt(el, n)     rainbow confetti (stars, hearts, dots, curly ribbons) at a viewport point / element
//   wiggle(el), shake(el)
//   toast(msg, { icon }?)              glossy message card; icon = img/ name (optional, added)
//   flyStarXY(x, y, onArrive?)         img/star.webp flies (with a sparkle trail) from a viewport point to #sesStars
//   shapeOn(c, s, r)                   draw confetti shape s (0 star, 1 heart, 2 dot, 3 ribbon) centred at 0,0
import { store, REDUCED_MOTION as reduce } from './state.js';
import { RAINBOW, TAU } from './data.js';
import { imgSrc, iconHTML } from './images.js';
import { sfx } from './audio.js';

const fx = document.createElement('canvas'); fx.id = 'fx'; fx.setAttribute('aria-hidden', 'true'); document.body.appendChild(fx);
const fctx = fx.getContext('2d');
let parts = [], raf = 0, fdpr = 1, last = 0;
const MAX = 360;
function sizeFx(){ fdpr = Math.min(2, window.devicePixelRatio || 1); fx.width = Math.round(innerWidth * fdpr); fx.height = Math.round(innerHeight * fdpr); }
sizeFx(); addEventListener('resize', sizeFx);
// lighter tints of the rainbow for the glossy side of each piece
const LIGHT = RAINBOW.map(h => { const n = parseInt(h.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => Math.round(v + (255 - v) * .5)); return `rgb(${c})`; });

function kick(){ if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
export function burst(x, y, n){
  if (reduce) n = Math.min(n, 10);
  n = Math.min(n, MAX - parts.length);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * TAU, sp = 4 + Math.random() * 8.5, ci = k % 7;
    parts.push({ x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 5.5, r:6 + Math.random() * 8,
      rot:Math.random() * 6, vr:(Math.random() - .5) * .28, flip:Math.random() * 6, vf:.12 + Math.random() * .18,
      s:k % 4, c:RAINBOW[ci], l:LIGHT[ci], t:0, life:70 + Math.random() * 45, g:.3, drag:.985 });
  }
  kick();
}
// a few small twinkles (used for the flying star's trail and arrivals)
function sparkle(x, y, n, spread = 3){
  n = Math.min(n, MAX - parts.length);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * TAU, sp = Math.random() * spread;
    parts.push({ x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, r:4 + Math.random() * 5, rot:0, vr:.1, flip:0, vf:0,
      s:4, c:Math.random() < .5 ? '#fff6b0' : '#ffffff', l:'#ffffff', t:0, life:22 + Math.random() * 14, g:.04, drag:.92 });
  }
  kick();
}
export function burstAt(el, n){ const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n); }

// confetti shapes centred at 0,0: 0 star, 1 heart, 2 dot, 3 curly ribbon, 4 twinkle (also handy for canvases)
function path(c, s, r){
  c.beginPath();
  if (s === 0) { for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .48 : r, a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
  else if (s === 1) { const k = r / 13; c.moveTo(0, 9 * k); c.bezierCurveTo(-15 * k, -1 * k, -8 * k, -13 * k, 0, -5 * k); c.bezierCurveTo(8 * k, -13 * k, 15 * k, -1 * k, 0, 9 * k); }
  else if (s === 3) { const w = r * .32; c.moveTo(-r, -w); c.quadraticCurveTo(-r * .5, -w * 3, 0, -w); c.quadraticCurveTo(r * .5, w * 1, r, -w); c.lineTo(r, w); c.quadraticCurveTo(r * .5, w * 3, 0, w); c.quadraticCurveTo(-r * .5, w * -1 + w * 2, -r, w); c.closePath(); }
  else if (s === 4) { const q = r * .18; c.moveTo(0, -r); c.quadraticCurveTo(q, -q, r, 0); c.quadraticCurveTo(q, q, 0, r); c.quadraticCurveTo(-q, q, -r, 0); c.quadraticCurveTo(-q, -q, 0, -r); }
  else c.arc(0, 0, r * .55, 0, TAU);
}
export function shapeOn(c, s, r){ path(c, s, r); c.fill(); }

function tick(now){
  const step = Math.min(3, Math.max(.25, (now - last) / 16.67)); last = now;
  fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0);
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  let n = 0;
  for (const p of parts) if (p.t < p.life && p.y < innerHeight + 40) parts[n++] = p;
  parts.length = n;
  for (const p of parts) {
    p.t += step; p.vy += p.g * step; const d = Math.pow(p.drag, step); p.vx *= d; p.vy *= p.g < .1 ? d : 1;
    p.x += p.vx * step; p.y += p.vy * step; p.rot += p.vr * step; p.flip += p.vf * step;
    fctx.globalAlpha = Math.max(0, Math.min(1, (p.life - p.t) / 18));
    const fl = p.vf ? Math.cos(p.flip) : 1, sy = Math.abs(fl) < .15 ? .15 : Math.abs(fl);
    fctx.setTransform(fdpr, 0, 0, fdpr, p.x * fdpr, p.y * fdpr); fctx.rotate(p.rot); fctx.scale(1, sy);
    // tumbling pieces show their lighter side while flipped
    fctx.fillStyle = fl < 0 ? p.l : p.c; path(fctx, p.s, p.r); fctx.fill();
    if (p.s !== 4 && fl >= 0) { fctx.fillStyle = 'rgba(255,255,255,.45)'; fctx.scale(.42, .42); fctx.translate(-p.r * .5, -p.r * .6); path(fctx, 2, p.r); fctx.fill(); }
  }
  fctx.globalAlpha = 1; fctx.setTransform(1, 0, 0, 1, 0, 0);
  raf = parts.length || flyers.length ? requestAnimationFrame(tick) : 0;
  stepFlyers(now);
}

export function wiggle(el){
  if (!el || reduce || !el.animate) return;
  el.animate([{transform:'rotate(0)'}, {transform:'rotate(-9deg) scale(1.06)'}, {transform:'rotate(8deg) scale(1.06)'}, {transform:'rotate(-4deg)'}, {transform:'rotate(0)'}], {duration:520, easing:'ease-out'});
}
export function shake(el){
  if (!el || reduce || !el.animate) return;
  el.animate([{transform:'translateX(0)'}, {transform:'translateX(-10px)'}, {transform:'translateX(10px)'}, {transform:'translateX(-6px)'}, {transform:'translateX(4px)'}, {transform:'translateX(0)'}], {duration:440});
}

/* ---------- flying star ---------- */
const flyers = [];
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function stepFlyers(now){
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i], t = Math.min(1, (now - f.t0) / f.dur);
    if (!f.el.isConnected && !f.done) { f.done = true; }
    // rise and grow first, then swoop along a curve to the counter
    let x, y, s, rot;
    if (t < .28) { const q = t / .28, e = 1 - Math.pow(1 - q, 3); x = f.x0; y = f.y0 - 46 * e; s = .3 + 1.5 * e; rot = -30 * (1 - e); }
    else {
      const q = easeIO((t - .28) / .72), sx = f.x0, sy = f.y0 - 46, cx = (sx + f.x1) / 2 + (f.x1 > sx ? -60 : 60), cy = Math.min(sy, f.y1) - 80;
      x = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * cx + q * q * f.x1; y = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * cy + q * q * f.y1;
      s = 1.8 - 1.2 * q; rot = 360 * q;
      if ((f.n = (f.n || 0) + 1) % 2 === 0) sparkle(x, y, 1, 1.2);
    }
    f.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s}) rotate(${rot}deg)`;
    if (t >= 1) { flyers.splice(i, 1); f.el.remove(); sparkle(f.x1, f.y1, 8, 3.5); f.done || f.arrive(); }
  }
}
// a star flies from viewport point (x0,y0) to #sesStars; onArrive defaults to counting that pill's number up by one
export function flyStarXY(x0, y0, onArrive){
  const pill = document.getElementById('sesStars');
  const done = () => {
    if (onArrive) { try { onArrive(); } catch (e) {} return; }
    if (pill && pill.isConnected) {
      const b = pill.querySelector('b'), max = store.S.ses ? store.S.ses.stars : 0;
      if (b) b.textContent = Math.min(max, (parseInt(b.textContent, 10) || 0) + 1);
      if (!reduce && pill.animate) pill.animate([{transform:'scale(1)'}, {transform:'scale(1.22)'}, {transform:'scale(.95)'}, {transform:'scale(1)'}], {duration:380, easing:'ease-out'});
      if (sfx.coin) sfx.coin();
    }
  };
  if (!pill || reduce) { done(); return; }
  const b = pill.getBoundingClientRect(), ico = pill.querySelector('.ico'), ib = ico ? ico.getBoundingClientRect() : null;
  const x1 = ib ? ib.left + ib.width / 2 : b.left + 24, y1 = ib ? ib.top + ib.height / 2 : b.top + b.height / 2;
  const s = document.createElement('img'); s.className = 'fly'; s.src = imgSrc('star'); s.alt = ''; s.setAttribute('aria-hidden', 'true');
  s.style.transform = `translate(${x0}px,${y0}px) translate(-50%,-50%) scale(.3)`;
  document.body.appendChild(s);
  flyers.push({ el:s, x0, y0, x1, y1, t0:performance.now(), dur:1000, arrive:done });
  kick();
}

/* ---------- toast ---------- */
let toastT = 0, toastT2 = 0;
const toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.hidden = true; toastEl.setAttribute('role', 'status');
document.body.appendChild(toastEl);
export function toast(msg, { icon = '' } = {}){
  toastEl.innerHTML = '';
  if (icon) toastEl.insertAdjacentHTML('beforeend', iconHTML(icon));
  const t = document.createElement('span'); t.textContent = msg; toastEl.appendChild(t);
  toastEl.hidden = false; toastEl.classList.remove('bye');
  toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
  clearTimeout(toastT); clearTimeout(toastT2);
  toastT = setTimeout(() => { toastEl.classList.add('bye'); toastT2 = setTimeout(() => { toastEl.hidden = true; toastEl.classList.remove('bye'); }, 300); }, 2600);
}
