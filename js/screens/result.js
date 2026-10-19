// screens/result.js (owner: ui) — "Great job!", stars earned, next closet goal, today's words.
import { store } from '../state.js';
import { SHOP, josa, range } from '../data.js';
import { owns } from '../storage.js';
import { sfx, say } from '../audio.js';
import { iconHTML } from '../images.js';
import { burst } from '../fx.js';
import { stageHTML } from '../art.js';
import { sw, startSession } from '../session.js';
import { registerScreen, registerActions, letters } from '../router.js';
import { stickerHTML } from './book.js';

function nextGoal(){
  const P = store.P;
  const locked = SHOP.flatMap(c => c.items.map(it => ({ c:c.id, it }))).filter(x => !owns(x.c, x.it[0]));
  if (!locked.length) return '옷장을 전부 모았어요! 최고예요!';
  const can = locked.filter(x => x.it[3] <= P.stars).sort((a, b) => b.it[3] - a.it[3])[0];
  if (can) return `지금 '${can.it[1]}'${josa(can.it[1])} 살 수 있어요!`;
  const cheap = locked.sort((a, b) => a.it[3] - b.it[3])[0];
  return `별 ${cheap.it[3] - P.stars}개만 더 모으면 '${cheap.it[1]}'${josa(cheap.it[1])} 살 수 있어요!`;
}

function resultHTML(){
  const ses = store.S.ses;
  return `<section class="screen done">
    ${stageHTML('', 'small')}
    <h1 class="word" style="font-size:min(80px, 14vw)" aria-label="Great job!">${letters('Great job!')}</h1>
    <p class="done-ko">별을 ${ses.stars}개 모았어요! <small>(끝까지 한 보너스 ${iconHTML('star')}${ses.bonus} 포함)</small></p>
    <div class="star-row" aria-hidden="true">${range(Math.min(ses.stars, 12)).map(i => `<span style="--i:${i}">${iconHTML('star')}</span>`).join('')}</div>
    <p class="goal">${nextGoal()}</p>
    <h2 class="sub">오늘 배운 단어 · 눌러서 다시 들어요</h2>
    <div class="learned">${ses.words.map((_, k) => stickerHTML(sw(k), true)).join('')}</div>
    <div class="row">
      <button class="btn toy primary" data-act="closet">${iconHTML('dress')}옷 입히러 가기</button>
      <button class="btn toy" data-act="again">한 번 더!</button>
      <button class="btn toy" data-act="home">집으로</button>
    </div>
  </section>`;
}

function mount(later){
  later(() => { sfx.fanfare(); burst(innerWidth * .28, innerHeight * .35, 60); burst(innerWidth * .72, innerHeight * .35, 60); }, 150);
  later(() => say('Great job! Look at all your stars!', { queue:true }), 350);
}

registerScreen('result', { html:resultHTML, mount });
registerActions({
  again: () => { store.S.game = store.S.ses.game; startSession(store.S.ses.world); },
});
