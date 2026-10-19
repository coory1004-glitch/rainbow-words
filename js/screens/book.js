// screens/book.js (owner: ui) — sticker book: all 47 words by world, locked ones as silhouettes.
import { store } from '../state.js';
import { WORLDS, TOTAL, wordOf } from '../data.js';
import { countGot, gotTotal } from '../storage.js';
import { sfx, say } from '../audio.js';
import { picHTML, iconHTML } from '../images.js';
import { wiggle, shake } from '../fx.js';
import { registerScreen, registerActions, go, starPill, homeButton } from '../router.js';

// one sticker (also used by the result screen)
export function stickerHTML(w, has){
  return has
    ? `<button class="sticker toy" data-act="say" data-say="${w.en}" aria-label="${w.en} 듣기">${picHTML(w)}<span class="w">${w.en}</span></button>`
    : `<button class="sticker toy locked-st" data-act="lockedword" aria-label="아직 못 찾은 스티커">${picHTML(w)}<span class="w">?</span></button>`;
}

function bookHTML(){
  const P = store.P;
  return `<section class="screen book">
    <header class="bar">
      ${homeButton()}
      <h1>내 스티커북</h1>
      ${starPill(P.stars)}
    </header>
    <p class="cue">스티커를 누르면 소리가 나요 · ${gotTotal()} / ${TOTAL}개 모았어요</p>
    ${WORLDS.map(W => `<section class="shelf">
      <h2>${iconHTML(W.icon)}${W.ko}<small>${countGot(W)} / ${W.words.length}</small></h2>
      <div class="stickers">${W.words.map((_, i) => { const w = wordOf(W.id, i); return stickerHTML(w, !!P.got[w.key]); }).join('')}</div>
    </section>`).join('')}
  </section>`;
}

registerScreen('book', { html:bookHTML });
registerActions({
  book: () => { sfx.pop(); say('Sticker book!'); go('book'); },
  say: el => { wiggle(el); say(el.dataset.say, { rate:.78 }); },
  lockedword: el => { shake(el); sfx.boop(); say('Find me in a game!'); },
});
