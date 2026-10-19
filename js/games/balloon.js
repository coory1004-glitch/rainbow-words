// games/balloon.js (owner: balloon) — picture balloons float up; pop the one you hear.
import { G, registerGame, gotIt, oops, pickSet, skyFill, dots, drawPop } from '../engine.js';
import { store } from '../state.js';
import { PASTEL, TAU, range, shuffle, pickOne } from '../data.js';
import { sfx } from '../audio.js';
import { avatarImage } from '../art.js';
import { drawPic } from '../images.js';
import { sw } from '../session.js';

const bx = b => b.x0 + Math.sin(G.t * 1.1 + b.ph) * G.U * .3;
function newBalloon(j, col, n, k){
  const colW = G.W / n, rx = Math.min(G.U * .95, colW * .46), ry = rx * 1.18;
  return { j, alive:true, pop:0, wob:0, col, n, rx, ry, x0:colW * (col + .5), y:G.H + ry * 1.3 + k * G.H * .18,
    v:G.H * (.12 + Math.random() * .05), ph:Math.random() * TAU, color:store.S.ses.world === 'colors' ? '#efe6ff' : PASTEL[(col * 3 + k) % 7] };
}

const balloon = {
  init(){ G.items = []; },
  resize(){ G.items.forEach(b => { const colW = G.W / b.n; b.x0 = colW * (b.col + .5); b.rx = Math.min(G.U * .95, colW * .46); b.ry = b.rx * 1.18; }); },
  round(){
    G.items.forEach(b => { if (b.alive) { b.alive = false; b.pop = 1; } });
    const n = Math.min(G.round < 2 ? 4 : 5, store.S.ses.words.length);
    G.pool = pickSet(n);
    const cols = shuffle(range(n));
    G.pool.forEach((j, k) => G.items.push(newBalloon(j, cols[k], n, k)));
  },
  press(x, y){
    if (G.done) return;
    for (let i = G.items.length - 1; i >= 0; i--) {
      const b = G.items[i];
      if (!b.alive) continue;
      const cx = bx(b), dx = (x - cx) / (b.rx * 1.2), dy = (y - b.y) / (b.ry * 1.2);
      if (dx * dx + dy * dy <= 1) {
        if (b.j === G.target) { b.alive = false; b.pop = 1; b.px = cx; sfx.pop(); gotIt(cx, b.y); }
        else { b.wob = 1; oops(b.j); }
        return;
      }
    }
  },
  update(dt){
    for (const b of G.items) {
      b.pop = Math.max(0, b.pop - dt * 3);
      if (!b.alive) continue;
      b.y -= b.v * dt; b.wob = Math.max(0, b.wob - dt * 2.5);
      if (b.y < -b.ry * 2.2) {
        if (b.j === G.target) G.hint = true;
        b.y = G.H + b.ry * 1.4;
        const hasTarget = G.items.some(o => o !== b && o.alive && o.j === G.target);
        b.j = hasTarget ? pickOne(G.pool) : G.target;
      }
    }
    G.items = G.items.filter(b => b.alive || b.pop > 0);
  },
  draw(c){
    skyFill(c); dots(c);
    const img = avatarImage('cheer'), ah = Math.min(G.H * .34, G.U * 3.2), aw = ah * 2 / 3;
    if (img.complete && img.naturalWidth) c.drawImage(img, G.U * .2, G.H - ah - Math.abs(Math.sin(G.t * 3)) * G.U * .1, aw, ah);
    for (const b of G.items) {
      if (!b.alive) { if (b.pop > 0) drawPop(c, { r:b.rx, pop:b.pop }, b.px != null ? b.px : bx(b), b.y); continue; }
      const x = bx(b) + Math.sin(b.wob * 20) * b.wob * G.U * .25, y = b.y, rx = b.rx, ry = b.ry;
      c.beginPath(); c.moveTo(x, y + ry); c.bezierCurveTo(x - rx * .3, y + ry * 1.5, x + rx * .3, y + ry * 1.9, x, y + ry * 2.4);
      c.strokeStyle = 'rgba(74,43,94,.35)'; c.lineWidth = 1.5; c.stroke();
      if (b.j === G.target && G.hint && !G.done) { const p = (Math.sin(G.t * 7) + 1) / 2; c.beginPath(); c.ellipse(x, y, rx + G.U * .15 + p * G.U * .2, ry + G.U * .15 + p * G.U * .2, 0, 0, TAU); c.fillStyle = `rgba(255,210,63,${.35 + .4 * p})`; c.fill(); }
      c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = b.color; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(74,43,94,.2)'; c.stroke();
      c.beginPath(); c.moveTo(x, y + ry - 2); c.lineTo(x - rx * .14, y + ry + rx * .2); c.lineTo(x + rx * .14, y + ry + rx * .2); c.closePath(); c.fillStyle = b.color; c.fill();
      c.beginPath(); c.ellipse(x - rx * .5, y - ry * .48, rx * .13, ry * .2, -.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill();
      c.beginPath(); c.arc(x, y + ry * .06, rx * .7, 0, TAU); c.fillStyle = 'rgba(255,255,255,.94)'; c.fill();
      drawPic(c, sw(b.j), x, y + ry * .06, rx * 1.1);
    }
  },
  // tests: tap the target balloon while it is fully on screen
  testHint(){
    if (G.done) return null;
    const b = G.items.find(o => o.alive && o.j === G.target && o.y > o.ry * 1.2 && o.y < G.H - o.ry * 1.2);
    return b ? { action:'tap', x:bx(b), y:b.y } : null;
  },
};

registerGame('balloon', balloon);
