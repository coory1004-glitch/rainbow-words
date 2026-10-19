// screens/intro.js (owner: ui) — meet the 5 words: a big picture card, rainbow letters (tap a letter to hear its name),
// the Korean meaning, a speaker and a next arrow. The word is said twice; the first card opens with "Let's learn new words!".
import { store } from '../state.js';
import { RAINBOW, GAMES_META } from '../data.js';
import { sfx, say } from '../audio.js';
import { picHTML, iconHTML } from '../images.js';
import { wiggle } from '../fx.js';
import { sw } from '../session.js';
import { registerScreen, registerActions, go, render, app, letters, wordSize, homeButton, ICON } from '../router.js';

const SPARK = c => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0c.9 6.2 2.9 8.2 10 10-7.1 1.8-9.1 3.8-10 10-.9-6.2-2.9-8.2-10-10 7.1-1.8 9.1-3.8 10-10z" fill="${c}"/></svg>`;

function stepsHTML(n, k){
  return `<div class="steps" role="img" aria-label="오늘의 단어 ${k + 1} / ${n}">${Array.from({ length:n }, (_, j) =>
    `<i class="${j < k ? 'on' : j === k ? 'now' : ''}" style="--c:${RAINBOW[(j * 2) % 7]}">${j < k ? ICON.check : `<b>${j + 1}</b>`}</i>`).join('')}</div>`;
}

function introHTML(){
  const ses = store.S.ses, k = ses.intro, w = sw(k), n = ses.words.length, last = k === n - 1;
  const g = GAMES_META.find(x => x.id === ses.game) || GAMES_META[0];
  return `<section class="screen intro">
    <header class="bar">
      ${homeButton()}
      ${stepsHTML(n, k)}
      <button class="mini skip" data-act="startplay" aria-label="바로 게임하기">${iconHTML(g.icon)}<span>바로 게임</span></button>
    </header>
    <main class="intro-main">
      <div class="wcard-wrap">
        <button class="wcard toy" data-act="sayword" aria-label="${w.en} 듣기">
          <span class="spark s1">${SPARK('#ffd23f')}</span><span class="spark s2">${SPARK('#ff8cc6')}</span><span class="spark s3">${SPARK('#9ad4ff')}</span>
          <span class="wshadow" aria-hidden="true"></span>
          <span class="wpic">${picHTML(w)}</span>
        </button>
      </div>
      <div class="intro-txt">
        <div class="word intro-word" style="font-size:${wordSize(w.en, 110)}" aria-label="${w.en}">${letters(w.en, true)}</div>
        <p class="ko-pill">${w.ko}</p>
        <p class="cue intro-cue">글자를 누르면 이름을 알려줘요</p>
        <div class="controls">
          <button class="round toy listen" data-act="sayword" aria-label="다시 듣기">${ICON.speaker}</button>
          ${last
            ? `<button class="btn toy primary go-play" data-act="startplay">${iconHTML(g.icon)}게임 시작!</button>`
            : `<button class="next toy" data-act="nextintro" aria-label="다음 단어">${ICON.arrow}</button>`}
        </div>
      </div>
    </main>
  </section>`;
}

// the word is said twice: once on arrival, again after a short pause (the first card opens with a hello)
function mount(later){
  const ses = store.S.ses, w = sw(ses.intro);
  const first = ses.intro === 0 ? ["Let's learn new words!", w.en] : [w.en];
  later(() => say(first, { queue:true, gap:350 }).then(() => later(() => say(w.en, { queue:true }), 650)), 380);
}

registerScreen('intro', { html:introHTML, mount });
registerActions({
  nextintro: () => { sfx.pop(); store.S.ses.intro++; render(); },
  startplay: () => { sfx.pop(); go('play'); },
  sayword: () => { wiggle(app.querySelector('.wpic .pic')); say(sw(store.S.ses.intro).en); },
  letter: el => { sfx.pop(); wiggle(el); say('letter ' + el.dataset.l.toUpperCase()); },
});
