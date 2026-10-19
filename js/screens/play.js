// screens/play.js (owner: engine) — the game screen: HUD (home, 8 star slots, star counter), the spoken question chip,
// the canvas field and its overlays (ready-set-go, word reveal, tapped-word tag, bonus stars).
import { store, ROUNDS } from '../state.js';
import { PROMPTS, range } from '../data.js';
import { say } from '../audio.js';
import { wiggle } from '../fx.js';
import { imgSrc } from '../images.js';
import { G, startGame, stopGame, promptText } from '../engine.js';
import { registerScreen, registerActions, starPill, homeButton, ICON } from '../router.js';

const CUES = { worm:'손가락으로 끌면 지렁이가 따라와요', jump:'화면을 콕 누르면 점프!', balloon:'맞는 풍선을 콕 눌러요' };

function playHTML(){
  const ses = store.S.ses;
  const star = `<img src="${imgSrc('star')}" alt="" aria-hidden="true" draggable="false">`;
  return `<section class="screen play" data-game="${ses.game}">
    <header class="bar hud">
      ${homeButton()}
      <div class="slots" aria-hidden="true">${range(ROUNDS).map(() => `<i class="slot">${star}</i>`).join('')}</div>
      ${starPill(ses.stars, { id:'sesStars' })}
    </header>
    <button class="ask" data-act="sayq" aria-label="문제 다시 듣기">
      <span class="spk">${ICON.speaker}</span>
      <span class="ask-t"><small>${PROMPTS[ses.game].verb}</small><b class="ask-word word"></b></span>
    </button>
    <div class="field">
      <canvas aria-label="게임 화면"></canvas>
      <p class="field-cue">${CUES[ses.game] || ''}</p>
      <div class="ov ov-tag" hidden aria-hidden="true"></div>
      <div class="ov ov-ready" hidden aria-hidden="true"></div>
      <div class="ov ov-reveal" hidden></div>
      <div class="ov ov-bonus" hidden></div>
    </div>
  </section>`;
}

registerScreen('play', { html:playHTML, mount:() => startGame(), unmount:() => stopGame() });
registerActions({
  sayq: el => { wiggle(el.querySelector('.spk')); if (G.on && !G.paused && !G.done) say(promptText()); },
});
