// screens/play.js (owner: engine) — the game screen: round dots, the spoken question, the canvas field.
import { store, ROUNDS } from '../state.js';
import { PROMPTS, RAINBOW, range } from '../data.js';
import { say } from '../audio.js';
import { wiggle } from '../fx.js';
import { G, startGame, stopGame, promptText } from '../engine.js';
import { registerScreen, registerActions, starPill, homeButton, ICON } from '../router.js';

const CUES = { worm:'손가락으로 끌면 지렁이가 따라와요', jump:'화면을 콕 누르면 점프!', balloon:'맞는 풍선을 콕 눌러요' };

function playHTML(){
  const ses = store.S.ses;
  return `<section class="screen play">
    <header class="bar">
      ${homeButton()}
      <div class="rbar rdots" aria-hidden="true">${range(ROUNDS).map(k => `<i style="--c:${RAINBOW[k % 7]}"></i>`).join('')}</div>
      ${starPill(ses.stars, { id:'sesStars' })}
    </header>
    <button class="ask toy" data-act="sayq" aria-label="문제 다시 듣기"><span class="spk">${ICON.speaker}</span>
      <span class="ask-t"><small>${PROMPTS[ses.game].verb}</small><b class="ask-word"></b></span></button>
    <div class="field"><canvas aria-label="게임 화면"></canvas><p class="field-cue">${CUES[ses.game] || ''}</p></div>
  </section>`;
}

registerScreen('play', { html:playHTML, mount:() => startGame(), unmount:() => stopGame() });
registerActions({
  sayq: el => { wiggle(el.querySelector('.spk')); if (G.on) say(promptText()); },
});
