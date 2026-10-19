// screens/book.js (owner: ui) — sticker album: one page per world, collected words as die-cut Fluent stickers,
// locked ones as grey silhouettes with a question mark. Tap a sticker to hear the word.
import { store } from '../state.js';
import { WORLDS, TOTAL, wordOf } from '../data.js';
import { countGot, gotTotal } from '../storage.js';
import { sfx, say } from '../audio.js';
import { picHTML, iconHTML } from '../images.js';
import { wiggle, shake, burstAt } from '../fx.js';
import { registerScreen, registerActions, go, starPill, homeButton, meterHTML, ICON } from '../router.js';

// a gentle, stable tilt per word so the page looks hand-stuck but never jumps between renders
const tilt = key => { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; return ((Math.abs(h) % 9) - 4) * 1.1; };

// one sticker slot (also used by the result screen)
export function stickerHTML(w, has, { isNew = false, i = 0 } = {}){
  return has
    ? `<button class="sticker got${isNew ? ' new' : ''}" data-act="say" data-say="${w.en}" aria-label="${w.en} 듣기" style="--tilt:${tilt(w.key).toFixed(1)}deg;--i:${i}">
        <span class="st-img">${picHTML(w)}</span><span class="w">${w.en}</span>${isNew ? '<span class="new-tag">NEW</span>' : ''}</button>`
    : `<button class="sticker locked-st" data-act="lockedword" aria-label="아직 못 찾은 스티커" style="--i:${i}">
        <span class="st-img">${picHTML(w)}<span class="st-q">${ICON.q}</span></span><span class="w" aria-hidden="true">&nbsp;</span></button>`;
}

const PAGE = {
  unicorn:{ a:'#fff0f8', b:'#ffe0f1', edge:'#ffc6e4', fill:'linear-gradient(90deg,#ff9fd0,#ff5fae)' },
  sweets:{ a:'#fff7ec', b:'#ffe9dc', edge:'#ffd2b0', fill:'linear-gradient(90deg,#ffc27a,#ff7a8a)' },
  colors:{ a:'#fffce8', b:'#eef4ff', edge:'#e2d6ff', fill:'' },
  cars:{ a:'#f0f9ff', b:'#e0f2ff', edge:'#bfe0ff', fill:'linear-gradient(90deg,#7cd0ff,#2f86ff)' },
  halloween:{ a:'#3d2468', b:'#2a1650', edge:'#6a45a0', fill:'linear-gradient(90deg,#ffc14d,#ff8a1f)', dark:true },
};

function bookHTML(){
  const P = store.P, all = gotTotal();
  return `<section class="screen book">
    <header class="bar">
      ${homeButton()}
      <h1>${iconHTML('notebook')}내 스티커북</h1>
      ${starPill(P.stars)}
    </header>
    <div class="book-sum card-soft">
      <span class="plate sum-plate">${iconHTML('trophy')}</span>
      <span class="sum-txt"><span class="sum-t">모은 스티커 <b>${all}</b><small> / ${TOTAL}</small></span>${meterHTML(all / TOTAL)}</span>
    </div>
    <p class="cue book-cue">스티커를 누르면 영어로 말해 줘요 · 물음표는 게임에서 찾아요</p>
    <div class="albums">
    ${WORLDS.map(W => {
      const pg = PAGE[W.id] || PAGE.unicorn, n = countGot(W), tot = W.words.length;
      return `<section class="album${pg.dark ? ' dark' : ''}" style="--pa:${pg.a};--pb:${pg.b};--pe:${pg.edge}">
        <header class="album-h">
          <span class="plate album-plate">${iconHTML(W.icon)}</span>
          <span class="album-t"><span class="album-ko">${W.ko}</span><span class="album-en">${W.en}</span></span>
          <span class="album-n">${n >= tot ? `<span class="tile-done">${ICON.check}</span>` : ''}<b>${n}</b><small>/${tot}</small></span>
          <span class="album-meter">${meterHTML(n / tot, pg.fill)}</span>
        </header>
        <div class="stickers">${W.words.map((_, i) => { const w = wordOf(W.id, i); return stickerHTML(w, !!P.got[w.key], { i }); }).join('')}</div>
      </section>`;
    }).join('')}
    </div>
  </section>`;
}

registerScreen('book', { html:bookHTML });
registerActions({
  book: () => { sfx.pop(); say('Sticker book!'); go('book'); },
  say: el => { wiggle(el.querySelector('.st-img') || el); burstAt(el, 10); say(el.dataset.say); },
  lockedword: el => { shake(el); sfx.boop(); say('Find me in a game!'); },
});
