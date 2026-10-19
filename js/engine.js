// engine.js (owner: engine) — shared canvas game runtime: rounds, scoring, input, drawing helpers.
// Game modules call registerGame(id, { init(), resize(), round(), press(x, y), update(dt), draw(ctx), testHint(),
//   move?(x, y, e), key?(e) → true if handled }).
import { store, ROUNDS } from './state.js';
import { PROMPTS, PRAISE, RAINBOW, TAU, shuffle, range, pickOne } from './data.js';
import { save } from './storage.js';
import { say, sfx } from './audio.js';
import { burst, flyStarXY } from './fx.js';
import { drawPic } from './images.js';
import { sw } from './session.js';
import { app, go } from './router.js';

export const G = { on:false };
export const GAMES = {};
export function registerGame(id, impl){ GAMES[id] = impl; }
export const currentGame = () => (G.type ? GAMES[G.type] : null);
// automated tests only: what to do now to hit the current target (canvas CSS px), or null
export function testHint(){ const g = currentGame(); return G.on && g && g.testHint ? g.testHint() : null; }

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
export function drawBubble(c, it, glow){
  const s = easeBack(Math.min(1, it.s == null ? 1 : it.s));
  const x = it.x, y = it.y + Math.sin(G.t * 2.2 + it.ph) * G.U * .08, r = it.r * s;
  if (r <= 1) return;
  if (glow) { const p = (Math.sin(G.t * 7) + 1) / 2; c.beginPath(); c.arc(x, y, r + G.U * .15 + p * G.U * .2, 0, TAU); c.fillStyle = `rgba(255,210,63,${.35 + .4 * p})`; c.fill(); }
  c.beginPath(); c.ellipse(x, y + r * .98, r * .7, r * .16, 0, 0, TAU); c.fillStyle = 'rgba(74,43,94,.12)'; c.fill();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#fff'; c.fill();
  c.lineWidth = Math.max(3, r * .09); c.strokeStyle = RAINBOW[(it.k || 0) % 7]; c.stroke();
  drawPic(c, sw(it.j), x, y, r * 1.35);
}
export function drawPop(c, it, x = it.x, y = it.y){
  const p = it.pop; if (p <= 0) return;
  c.beginPath(); c.arc(x, y, it.r * (1.5 - .5 * p), 0, TAU);
  c.lineWidth = 5 * p; c.strokeStyle = `rgba(255,255,255,${p})`; c.stroke();
}
// the sky gradient is cached per size/world (no per-frame allocation)
let skyKey = '', skyGrad = null;
export function skyFill(c){
  const p = pal(), k = G.H + '|' + p.sky[0] + p.sky[1];
  if (k !== skyKey || !skyGrad) { skyKey = k; skyGrad = c.createLinearGradient(0, 0, 0, G.H); skyGrad.addColorStop(0, p.sky[0]); skyGrad.addColorStop(1, p.sky[1]); }
  c.fillStyle = skyGrad; c.fillRect(0, 0, G.W, G.H);
  if (p.moon) { c.beginPath(); c.arc(G.W * .82, G.H * .16, G.U * .75, 0, TAU); c.fillStyle = '#fff3c4'; c.fill(); }
}
export function dots(c){
  c.fillStyle = pal().dot;
  c.beginPath();
  for (let y = 22, r = 0; y < G.H; y += 44, r++) for (let x = r % 2 ? 22 : 0; x < G.W + 22; x += 44) { c.moveTo(x + 2, y); c.arc(x, y, 2, 0, TAU); }
  c.fill();
}
export function cloudC(c, x, y, s){
  c.fillStyle = pal().cloud;
  c.beginPath(); c.arc(x, y, s * .5, 0, TAU); c.arc(x + s * .55, y - s * .25, s * .65, 0, TAU); c.arc(x + s * 1.15, y, s * .5, 0, TAU); c.fill();
  c.fillRect(x, y, s * 1.15, s * .5);
}
// n session-word indexes including the current target, shuffled
export function pickSet(n){
  const others = shuffle(range(store.S.ses.words.length).filter(j => j !== G.target)).slice(0, n - 1);
  return shuffle([G.target, ...others]);
}

/* ---------- loop, input, rounds ---------- */
function sizeField(){
  if (!G.on) return;
  const r = G.field.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (r.width < 10 || r.height < 10) return;
  G.W = r.width; G.H = r.height; G.dpr = dpr;
  G.cv.width = Math.round(r.width * dpr); G.cv.height = Math.round(r.height * dpr);
  G.U = Math.min(G.W, G.H) / 10;
  if (G.ready) GAMES[G.type].resize();
}
const pt = e => { const r = G.cv.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; };
function hideCue(){ const el = app.querySelector('.field-cue'); if (el) el.hidden = true; }
function onDown(e){
  if (!G.on) return;
  const p = pt(e); G.down = true; hideCue();
  GAMES[G.type].press(p.x, p.y);
  try { G.cv.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
}
function onMove(e){ const g = G.on && GAMES[G.type]; if (g && g.move) { const p = pt(e); g.move(p.x, p.y, e); } }
function onUp(){ G.down = false; }
function onKey(e){
  const g = G.on && GAMES[G.type];
  if (g && g.key && g.key(e)) { hideCue(); e.preventDefault(); }
}

export function startGame(){
  const field = app.querySelector('.field'); if (!field) return;
  const S = store.S, cv = field.querySelector('canvas');
  if (!GAMES[S.ses.game]) { console.error('no game registered for', S.ses.game); return; }
  Object.assign(G, { on:true, ready:false, token:{}, cv, ctx:cv.getContext('2d'), field, type:S.ses.game, t:0, round:0, items:[], done:false, hint:false, roundT:0, down:false, aim:null, head:null });
  G.targets = shuffle(range(S.ses.words.length));
  while (G.targets.length < ROUNDS) { let c; do { c = Math.floor(Math.random() * S.ses.words.length); } while (c === G.targets[G.targets.length - 1]); G.targets.push(c); }
  sizeField();
  if (window.ResizeObserver) { G.ro = new ResizeObserver(sizeField); G.ro.observe(field); }
  else { G.ro = { disconnect(){ removeEventListener('resize', sizeField); } }; addEventListener('resize', sizeField); }
  GAMES[G.type].init(); G.ready = true;
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  nextRound();
  G.last = performance.now();
  G.raf = requestAnimationFrame(frame);
}
export function stopGame(){
  if (!G.on) return;
  G.on = false; cancelAnimationFrame(G.raf);
  if (G.ro) G.ro.disconnect();
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('keydown', onKey);
}
export const promptText = () => PROMPTS[G.type].say(sw(G.target));
function hud(){
  const w = sw(G.target), el = app.querySelector('.ask-word');
  if (el) { el.textContent = w.en; el.style.fontSize = `min(38px, ${(66 / (w.en.length * .68)).toFixed(2)}vw)`; }
  app.querySelectorAll('.rdots i').forEach((d, k) => { d.className = k < G.round ? 'on' : k === G.round ? 'now' : ''; });
}
function nextRound(){
  if (!G.on) return;
  if (G.round >= G.targets.length) { finishGame(); return; }
  G.target = G.targets[G.round]; G.done = false; G.hint = false; G.roundT = 0;
  hud();
  GAMES[G.type].round();
  say(promptText());
}
// correct answer at canvas point x,y: +1 star, sticker, praise + the word, next round
export function gotIt(x, y){
  const S = store.S, P = store.P, w = sw(G.target);
  G.done = true; G.round++;
  S.ses.stars++; P.stars++;
  if (!P.got[w.key]) { P.got[w.key] = 1; S.ses.newStickers.push(w.key); }
  save();
  sfx.yay();
  const r = G.cv.getBoundingClientRect();
  burst(r.left + x, r.top + y, 60); flyStarXY(r.left + x, r.top + y);
  app.querySelectorAll('.rdots i').forEach((d, k) => { d.className = k < G.round ? 'on' : ''; });
  const tok = G.token;
  say([pickOne(PRAISE), w.en]).then(() => setTimeout(() => { if (G.on && G.token === tok) nextRound(); }, 350));
}
// wrong answer (session word index j): say the tapped WORD only, short pause, then the prompt again
export function oops(j){
  const w = sw(j);
  sfx.boop(); G.hint = true;
  say([w.en, promptText()], { gap:450 });
}
function finishGame(){
  const S = store.S, P = store.P;
  S.ses.bonus = 2; S.ses.stars += 2; P.stars += 2;
  P.stats.games = (P.stats.games || 0) + 1; P.stats.lastPlayed = Date.now();
  save();
  go('result');
}
function frame(now){
  if (!G.on) return;
  const dt = Math.min(.05, (now - G.last) / 1000); G.last = now;
  if (!document.hidden && G.W) {
    G.t += dt;
    if (!G.done) { G.roundT += dt; if (!G.hint && G.roundT > 10) { G.hint = true; say(promptText()); } }
    GAMES[G.type].update(dt);
    const c = G.ctx; c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); c.clearRect(0, 0, G.W, G.H);
    GAMES[G.type].draw(c);
  }
  G.raf = requestAnimationFrame(frame);
}
