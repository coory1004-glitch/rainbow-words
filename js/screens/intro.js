// screens/intro.js (owner: ui) — meet the 5 words: picture, rainbow letters (tap a letter to hear its name), word said twice.
import { store } from '../state.js';
import { RAINBOW } from '../data.js';
import { sfx, say } from '../audio.js';
import { picHTML } from '../images.js';
import { wiggle } from '../fx.js';
import { sw } from '../session.js';
import { registerScreen, registerActions, go, render, app, letters, wordSize, homeButton, ICON } from '../router.js';

function introHTML(){
  const ses = store.S.ses, k = ses.intro, w = sw(k), last = k === ses.words.length - 1;
  return `<section class="screen">
    <header class="bar">
      ${homeButton()}
      <div class="rbar" aria-label="오늘의 단어 ${k + 1} / ${ses.words.length}">${ses.words.map((_, j) => `<i class="${j < k ? 'on' : j === k ? 'now' : ''}" style="--c:${RAINBOW[j % 7]}"></i>`).join('')}</div>
      <button class="mini" data-act="startplay">바로 게임</button>
    </header>
    <main class="stage">
      <p class="cue">오늘의 단어 ${k + 1} / ${ses.words.length} · 잘 듣고 따라 말해요</p>
      <button class="card toy big" data-act="sayword" aria-label="${w.en} 듣기"><span class="wig">${picHTML(w)}</span></button>
      <div class="word" style="font-size:${wordSize(w.en)}" aria-label="${w.en}">${letters(w.en, true)}</div>
      <p class="ko">${w.ko}</p>
      <div class="controls">
        <button class="round toy" data-act="sayword" aria-label="다시 듣기">${ICON.speaker}</button>
        ${last ? `<button class="btn toy primary" data-act="startplay">게임 시작!</button>` : `<button class="next toy" data-act="nextintro" aria-label="다음 단어">${ICON.arrow}</button>`}
      </div>
    </main>
  </section>`;
}

// the word is said twice: once on arrival, again after a short pause
function mount(later){
  const w = sw(store.S.ses.intro);
  later(() => say(w.en, { queue:true, rate:.72 }).then(() => later(() => say(w.en, { queue:true, rate:.8 }), 500)), 380);
}

registerScreen('intro', { html:introHTML, mount });
registerActions({
  nextintro: () => { sfx.pop(); store.S.ses.intro++; render(); },
  startplay: () => { sfx.pop(); go('play'); },
  sayword: el => { wiggle(app.querySelector('.big .wig') || el); say(sw(store.S.ses.intro).en, { rate:.75 }); },
  letter: el => { sfx.pop(); wiggle(el); say('letter ' + el.dataset.l.toUpperCase()); },
});
