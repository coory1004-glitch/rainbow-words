// screens/result.js (owner: ui) — the celebration: confetti, the princess cheering on her stage, stars counting up,
// today's stickers (new ones marked), the next closet goal, and buttons to the closet / play again / home.
import { store } from '../state.js';
import { SHOP, josa } from '../data.js';
import { owns } from '../storage.js';
import { sfx, say } from '../audio.js';
import { iconHTML } from '../images.js';
import { burst, wiggle } from '../fx.js';
import { stageHTML, avatarSVG, thumbHTML } from '../art.js';
import { sw, startSession } from '../session.js';
import { registerScreen, registerActions, app, letters, meterHTML, ICON } from '../router.js';
import { stickerHTML } from './book.js';

// the next thing to buy: the dearest item she can afford now, else the cheapest one still out of reach
export function nextGoal(){
  const P = store.P;
  const locked = SHOP.flatMap(c => c.items.map(it => ({ c:c.id, it }))).filter(x => !owns(x.c, x.it[0]));
  if (!locked.length) return { done:true, text:'옷장을 전부 모았어요! 최고예요!' };
  const can = locked.filter(x => x.it[3] <= P.stars).sort((a, b) => b.it[3] - a.it[3])[0];
  if (can) return { c:can.c, id:can.it[0], price:can.it[3], can:true, text:`지금 '${can.it[1]}'${josa(can.it[1])} 살 수 있어요!` };
  const cheap = locked.sort((a, b) => a.it[3] - b.it[3])[0];
  return { c:cheap.c, id:cheap.it[0], price:cheap.it[3], can:false, text:`별 ${cheap.it[3] - P.stars}개만 더 모으면 '${cheap.it[1]}'${josa(cheap.it[1])} 살 수 있어요!` };
}

function goalHTML(){
  const g = nextGoal(), P = store.P;
  if (g.done) return `<div class="goal card-soft"><span class="goal-th plate">${iconHTML('crown')}</span><span class="goal-txt"><span class="goal-t">${g.text}</span></span></div>`;
  return `<button class="goal card-soft${g.can ? ' can' : ''}" data-act="closet" aria-label="${g.text}">
      <span class="goal-th">${thumbHTML(g.c, g.id)}</span>
      <span class="goal-txt"><span class="goal-t">${g.text}</span>
        <span class="goal-m">${meterHTML(Math.min(1, P.stars / Math.max(1, g.price)), 'linear-gradient(90deg,#ffe680,#ffc21f)')}<span class="goal-n">${iconHTML('star')}${Math.min(P.stars, g.price)}<small>/${g.price}</small></span></span>
      </span>
    </button>`;
}

function resultHTML(){
  const ses = store.S.ses, fresh = new Set(ses.newStickers || []);
  const nNew = ses.words.filter((_, k) => fresh.has(sw(k).key)).length;
  return `<section class="screen result">
    <div class="res-hero">
      ${stageHTML(`<button class="round sm toy glass res-home" data-act="home" aria-label="처음 화면으로">${ICON.home}</button><span class="res-medal plate">${iconHTML('trophy')}</span>`, 'small res-stage')}
    </div>
    <div class="res-side">
      <h1 class="word res-title" aria-label="Great job!">${letters('Great job!')}</h1>
      <div class="earned card-soft">
        <span class="plate earn-plate">${iconHTML('glowing-star')}</span>
        <span class="earn-txt">
          <span class="earn-n">+<b id="earnN">0</b></span>
          <span class="earn-sub">별을 모았어요!${ses.bonus ? ` <small>끝까지 한 보너스 ${ses.bonus}개 포함</small>` : ''}</span>
        </span>
      </div>
      <section class="res-st">
        <h2 class="sub">${nNew ? `${iconHTML('sparkles')}새 스티커 ${nNew}개! · 눌러서 들어 봐요` : '오늘 배운 단어 · 눌러서 들어 봐요'}</h2>
        <div class="learned">${ses.words.map((_, k) => { const w = sw(k); return stickerHTML(w, true, { isNew:fresh.has(w.key), i:k }); }).join('')}</div>
      </section>
      ${goalHTML()}
      <div class="row res-btns">
        <button class="btn toy primary" data-act="closet">${iconHTML('dress')}옷 입히기</button>
        <button class="btn toy mint" data-act="again"><span class="btn-svg">${ICON.again}</span>한 번 더!</button>
      </div>
    </div>
  </section>`;
}

function mount(later){
  const ses = store.S.ses, n = ses.stars;
  // she cheers on her stage
  const av = app.querySelector('.res-stage .stage-av svg.avatar');
  if (av) { av.outerHTML = avatarSVG(store.P.wear, { pose:'cheer' }); const box = app.querySelector('.res-stage .stage-av'); if (box) box.classList.add('hop'); }
  later(() => { sfx.fanfare(); burst(innerWidth * .25, innerHeight * .3, 60); burst(innerWidth * .75, innerHeight * .3, 60); }, 150);
  later(() => burst(innerWidth * .5, innerHeight * .2, 50), 900);
  // stars count up
  const el = app.querySelector('#earnN'), step = Math.max(55, Math.min(140, 1400 / Math.max(1, n)));
  for (let i = 1; i <= n; i++) later(() => {
    if (el) el.textContent = i;
    if (sfx.coin) sfx.coin(); else if (i === n) sfx.pop();
    if (i === n) wiggle(app.querySelector('.earn-plate'));
  }, 450 + i * step);
  const lines = ['Great job! Look at all your stars!'];
  if ((ses.newStickers || []).length) lines.push('New sticker!');
  later(() => say(lines, { queue:true, gap:500 }), 350);
}

registerScreen('result', { html:resultHTML, mount });
registerActions({
  again: () => { store.S.game = store.S.ses.game; startSession(store.S.ses.world); },
});
