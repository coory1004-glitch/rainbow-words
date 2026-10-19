// games/jump.js (owner: jump) — the princess runs; tap (or Space) to jump into the bubble you hear.
import { G, registerGame, gotIt, oops, pickSet, skyFill, cloudC, drawBubble, drawPop, pal } from '../engine.js';
import { store } from '../state.js';
import { PET_IMG, TAU } from '../data.js';
import { sfx } from '../audio.js';
import { avatarImage } from '../art.js';
import { getImage } from '../images.js';

const AIR = 1.1; // seconds in the air
const ready = im => im && im.complete && im.naturalWidth > 0;

const jump = {
  init(){ Object.assign(G, { py:0, vy:0, ground:true, dizzy:0, scroll:0, queue:[], spawnT:.6, buf:0, items:[] }); jump.geo(); },
  geo(){
    G.gy = G.H * .84; G.ch = Math.min(G.U * 3.2, G.H * .36); G.cw = G.ch * 2 / 3;
    G.cx = Math.max(G.W * .2, G.cw * .9); G.jh = G.ch;
    G.g = 8 * G.jh / (AIR * AIR); G.v0 = 4 * G.jh / AIR;
    G.iy = G.gy - G.ch * .6 - G.jh * .8; G.ir = G.ch * .27; G.vx = Math.max(G.W * .22, G.U * 3);
  },
  resize(){ jump.geo(); G.items.forEach(it => { it.y = G.iy; it.r = G.ir; }); },
  round(){ G.items.forEach(it => { if (it.alive) { it.alive = false; it.pop = 1; } }); G.queue = pickSet(G.round < 2 ? 3 : 4); G.spawnT = Math.min(G.spawnT, 1); },
  press(){ if (G.ground && G.dizzy <= 0) { G.vy = G.v0; G.ground = false; sfx.jump(); } else G.buf = .18; },
  key(e){ if (e.key === ' ' || e.key === 'ArrowUp') { jump.press(); return true; } return false; },
  update(dt){
    G.scroll += G.vx * dt;
    if (G.dizzy > 0) G.dizzy -= dt;
    if (!G.ground) { G.vy -= G.g * dt; G.py += G.vy * dt; if (G.py <= 0) { G.py = 0; G.vy = 0; G.ground = true; if (G.buf > 0) { G.buf = 0; jump.press(); } } }
    G.buf = Math.max(0, G.buf - dt);
    if (!G.done) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) {
        if (!G.queue.length) { G.queue = pickSet(G.round < 2 ? 3 : 4); G.hint = true; }
        const j = G.queue.shift();
        G.items.push({ j, k:G.items.length + G.round, x:G.W + G.ir + 4, y:G.iy, r:G.ir, s:1, alive:true, pop:0, ph:Math.random() * TAU });
        G.spawnT = 1.9;
      }
    }
    const top = G.gy - G.py - G.ch, bot = G.gy - G.py, left = G.cx - G.cw * .36, right = G.cx + G.cw * .36;
    for (const it of G.items) {
      it.x -= G.vx * dt; it.pop = Math.max(0, it.pop - dt * 3);
      if (!it.alive || G.done) continue;
      const nx = Math.max(left, Math.min(it.x, right)), ny = Math.max(top, Math.min(it.y, bot));
      if (Math.hypot(it.x - nx, it.y - ny) < it.r * .85) {
        it.alive = false; it.pop = 1;
        if (it.j === G.target) gotIt(it.x, it.y);
        else { G.dizzy = .8; oops(it.j); }
      }
    }
    G.items = G.items.filter(it => it.x > -it.r * 2 && (it.alive || it.pop > 0));
  },
  draw(c){
    const p = pal(), U = G.U;
    skyFill(c);
    const cw = G.W * .55;
    for (let k = -1; k < 3; k++) { const x = k * cw - (G.scroll * .12 % cw); cloudC(c, x + cw * .2, G.H * (.14 + (k & 1) * .1), U * 1.1); }
    c.fillStyle = p.hill; const hw = G.W * .5;
    for (let k = -1; k < 4; k++) { const x = k * hw - (G.scroll * .35 % hw); c.beginPath(); c.ellipse(x + hw / 2, G.gy, hw * .62, G.H * .2, 0, Math.PI, 0); c.fill(); }
    c.fillStyle = p.ground; c.fillRect(0, G.gy, G.W, G.H - G.gy);
    c.fillStyle = p.ground2; c.fillRect(0, G.gy, G.W, U * .22);
    const sp = U * 2.2, gy2 = G.gy + (G.H - G.gy) * .55;
    c.fillStyle = p.road ? '#ffffff' : p.ground2;
    for (let x = -(G.scroll % sp); x < G.W + sp; x += sp) {
      if (p.road) c.fillRect(x, gy2 - U * .05, U * .9, U * .1);
      else { c.beginPath(); c.ellipse(x, gy2, U * .35, U * .1, 0, 0, TAU); c.fill(); }
    }
    for (const it of G.items) { if (it.alive) drawBubble(c, it, it.j === G.target && G.hint && !G.done); else drawPop(c, it); }
    const pet = store.P.wear.pet;
    if (pet !== 'none' && PET_IMG[pet]) {
      const im = getImage(PET_IMG[pet]), ps = G.ch * .42;
      if (ready(im)) c.drawImage(im, G.cx - G.cw * .85 - ps / 2, G.gy - ps - Math.abs(Math.sin(G.t * 9 + 1)) * U * .5, ps, ps);
    }
    const lift = Math.min(G.py / G.jh, 1);
    c.beginPath(); c.ellipse(G.cx, G.gy + U * .04, G.cw * .32 * (1 - lift * .5), U * .12, 0, 0, TAU); c.fillStyle = 'rgba(0,0,0,.14)'; c.fill();
    const img = avatarImage(G.ground ? 'idle' : 'jump'), bob = G.ground ? Math.abs(Math.sin(G.t * 11)) * U * .12 : 0;
    c.save(); c.translate(G.cx, G.gy - G.py - G.ch / 2 - bob); c.rotate(G.ground ? 0 : -.08);
    if (ready(img)) c.drawImage(img, -G.cw / 2, -G.ch / 2, G.cw, G.ch);
    c.restore();
    if (G.dizzy > 0) {
      const st = getImage('star'), ss = U * .4;
      for (let k = 0; k < 3; k++) {
        const a = G.t * 6 + k * TAU / 3, sx = G.cx + Math.cos(a) * G.cw * .28, sy = G.gy - G.py - G.ch * .82 + Math.sin(a) * U * .14;
        if (ready(st)) c.drawImage(st, sx - ss / 2, sy - ss / 2, ss, ss);
      }
    }
  },
  // tests: press Space when the target bubble will meet her at the top of a jump
  testHint(){
    if (G.done || !G.ground || G.dizzy > 0) return null;
    const right = G.cx + G.cw * .36;
    const it = G.items.find(o => o.alive && o.j === G.target);
    if (!it) return null;
    const tArrive = (it.x - it.r * .5 - right) / G.vx;   // seconds until it reaches her front edge
    return tArrive > AIR * .3 && tArrive < AIR * .55 ? { action:'press', x:G.cx, y:G.gy - G.ch / 2 } : null;
  },
};

registerGame('jump', jump);
