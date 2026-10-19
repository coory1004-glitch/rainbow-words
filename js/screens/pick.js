// screens/pick.js (owner: ui) — choose a word world (5 worlds + mix) for the chosen game.
import { store } from '../state.js';
import { WORLDS, GAMES_META, TOTAL } from '../data.js';
import { countGot, gotTotal } from '../storage.js';
import { sfx, say, preload } from '../audio.js';
import { iconHTML } from '../images.js';
import { startSession } from '../session.js';
import { registerScreen, registerActions, go, starPill, homeButton } from '../router.js';

function pickHTML(){
  const S = store.S, P = store.P;
  const g = GAMES_META.find(x => x.id === S.game) || GAMES_META[0];
  const tiles = WORLDS.map((W, k) => {
    const t = W.tile;
    return `<button class="tile toy${W.color ? ' rainbow' : ''}" data-act="world" data-id="${W.id}"
      style="--face:${t.face};--edge:${t.edge};--shade:${t.shade};--tile-ink:${t.ink || 'var(--ink)'};--prog:${t.prog || 'rgba(255,255,255,.75)'};--d:${(k * -.6).toFixed(1)}s">
      ${iconHTML(W.icon, 'ic')}<span class="tile-ko">${W.ko}</span><span class="tile-en">${W.en}</span>
      <span class="tile-prog">${iconHTML('notebook')}${countGot(W)} / ${W.words.length}</span></button>`;
  }).join('');
  const mix = `<button class="tile toy" data-act="world" data-id="mix" style="--face:#ffffff;--edge:#c3a6ff;--shade:#a084e6;--d:-3s">
      ${iconHTML('dice', 'ic')}<span class="tile-ko">모두 섞어서</span><span class="tile-en">Mix It Up</span>
      <span class="tile-prog" style="--prog:#f3ecff">${iconHTML('notebook')}${gotTotal()} / ${TOTAL}</span></button>`;
  return `<section class="screen">
    <header class="bar">
      ${homeButton()}
      <h1>${iconHTML(g.icon)}어떤 단어로 놀까?</h1>
      ${starPill(P.stars)}
    </header>
    <div class="worlds">${tiles}${mix}</div>
  </section>`;
}

registerScreen('pick', { html:pickHTML });
registerActions({
  pickgame: el => {
    preload(WORLDS.map(W => W.id));
    store.S.game = el.dataset.game;
    const g = GAMES_META.find(x => x.id === store.S.game) || GAMES_META[0];
    sfx.pop(); say(g.en + '!');
    go('pick');
  },
  world: el => startSession(el.dataset.id),
});
