// fx.js (owner: engine) — confetti bursts, wiggles, toasts and the flying star.
import { store, REDUCED_MOTION as reduce } from './state.js';
import { RAINBOW, TAU } from './data.js';
import { imgSrc } from './images.js';

const fx = document.createElement('canvas'); fx.id = 'fx'; document.body.appendChild(fx);
const fctx = fx.getContext('2d');
let parts = [], raf = 0, fdpr = 1;
function sizeFx(){ fdpr = Math.min(2, window.devicePixelRatio || 1); fx.width = innerWidth * fdpr; fx.height = innerHeight * fdpr; }
sizeFx(); addEventListener('resize', sizeFx);

export function burst(x, y, n){
  if (reduce) n = Math.min(n, 10);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * TAU, sp = 4 + Math.random() * 9;
    parts.push({ x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 6, r:7 + Math.random() * 9,
      rot:Math.random() * 6, vr:(Math.random() - .5) * .3, s:k % 3, c:RAINBOW[k % 7], t:0, life:70 + Math.random() * 40 });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
export function burstAt(el, n){ const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n); }
// confetti shapes: 0 star, 1 heart, 2 dot (also handy for canvases)
export function shapeOn(c, s, r){
  c.beginPath();
  if (s === 0) { for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .45 : r, a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
  else if (s === 1) { const k = r / 14; c.moveTo(0, 6 * k); c.bezierCurveTo(-14 * k, -4 * k, -6 * k, -14 * k, 0, -7 * k); c.bezierCurveTo(6 * k, -14 * k, 14 * k, -4 * k, 0, 6 * k); }
  else c.arc(0, 0, r * .5, 0, TAU);
  c.fill();
}
function tick(){
  fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0);
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  let n = 0;
  for (const p of parts) if (p.t < p.life && p.y < innerHeight + 40) parts[n++] = p;
  parts.length = n;
  for (const p of parts) {
    p.t++; p.vy += .32; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    fctx.globalAlpha = Math.min(1, (p.life - p.t) / 20);
    fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
    fctx.fillStyle = p.c; shapeOn(fctx, p.s, p.r);
  }
  fctx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(tick) : 0;
}

export function wiggle(el){
  if (!el || reduce || !el.animate) return;
  el.animate([{transform:'rotate(0)'}, {transform:'rotate(-9deg) scale(1.06)'}, {transform:'rotate(8deg) scale(1.06)'}, {transform:'rotate(-4deg)'}, {transform:'rotate(0)'}], {duration:520, easing:'ease-out'});
}
export function shake(el){
  if (!el || reduce || !el.animate) return;
  el.animate([{transform:'translateX(0)'}, {transform:'translateX(-12px)'}, {transform:'translateX(12px)'}, {transform:'translateX(-8px)'}, {transform:'translateX(6px)'}, {transform:'translateX(0)'}], {duration:480});
}

// a star flies from viewport point (x0,y0) to #sesStars; onArrive defaults to updating that pill's number
export function flyStarXY(x0, y0, onArrive){
  const pill = document.getElementById('sesStars');
  const done = () => {
    if (onArrive) { try { onArrive(); } catch (e) {} return; }
    if (pill) { const b = pill.querySelector('b'); if (b && store.S.ses) b.textContent = store.S.ses.stars; wiggle(pill); }
  };
  if (!pill || reduce || !document.body.animate) { done(); return; }
  const b = pill.getBoundingClientRect(), x1 = b.left + 24, y1 = b.top + b.height / 2;
  const s = document.createElement('img'); s.className = 'fly'; s.src = imgSrc('star'); s.alt = ''; s.setAttribute('aria-hidden', 'true');
  document.body.appendChild(s);
  s.animate([
    { transform:`translate(${x0}px,${y0}px) translate(-50%,-50%) scale(.3)`, opacity:0 },
    { transform:`translate(${x0}px,${y0 - 40}px) translate(-50%,-50%) scale(2)`, opacity:1, offset:.35 },
    { transform:`translate(${x1}px,${y1}px) translate(-50%,-50%) scale(.6)`, opacity:1 },
  ], { duration:950, easing:'cubic-bezier(.5,0,.3,1)' }).onfinish = () => { s.remove(); done(); };
}

let toastT = 0;
const toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.hidden = true; toastEl.setAttribute('role', 'status');
document.body.appendChild(toastEl);
export function toast(msg){
  toastEl.textContent = msg; toastEl.hidden = false;
  toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
  clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 2600);
}
