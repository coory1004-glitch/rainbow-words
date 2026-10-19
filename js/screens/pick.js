// screens/pick.js (owner: ui) — choose a word world (5 worlds + mix) for the chosen game.
import { store } from '../state.js';
import { WORLDS, GAMES_META, TOTAL } from '../data.js';
import { countGot, gotTotal } from '../storage.js';
import { sfx, say, preload } from '../audio.js';
import { iconHTML } from '../images.js';
import { startSession } from '../session.js';
import { registerScreen, registerActions, go, starPill, homeButton, meterHTML, ICON } from '../router.js';

function tileHTML({ id, ko, en, icon, t, got, total, cls = '', k }){
  const done = got >= total;
  return `<button class="tile toy${cls}" data-act="world" data-id="${id}" aria-label="${ko}, 스티커 ${got} / ${total}"
      style="--face:${t.face};--edge:${t.edge};--shade:${t.shade};--tile-ink:${t.ink || 'var(--ink)'};--d:${(k * -.55).toFixed(2)}s;--i:${k}">
      <span class="plate tile-plate">${iconHTML(icon, 'ic')}</span>
      <span class="tile-ko">${ko}</span>
      <span class="tile-en">${en}</span>
      <span class="tile-prog">${meterHTML(got / total, t.fill || '')}<span class="tile-n">${done ? `<span class="tile-done">${ICON.check}</span>` : ''}${got}<small>/${total}</small></span></span>
    </button>`;
}

const FILL = {
  unicorn:'linear-gradient(90deg,#ff9fd0,#ff5fae)',
  sweets:'linear-gradient(90deg,#ffc27a,#ff7a8a)',
  colors:'',
  cars:'linear-gradient(90deg,#7cd0ff,#2f86ff)',
  halloween:'linear-gradient(90deg,#ffc14d,#ff8a1f)',
};

function pickHTML(){
  const S = store.S, P = store.P;
  const g = GAMES_META.find(x => x.id === S.game) || GAMES_META[0];
  const tiles = WORLDS.map((W, k) => tileHTML({ id:W.id, ko:W.ko, en:W.en, icon:W.icon, t:{ ...W.tile, fill:FILL[W.id] }, got:countGot(W), total:W.words.length,
    cls:(W.color ? ' rainbow' : '') + (W.id === 'halloween' ? ' night' : ''), k })).join('');
  const mix = tileHTML({ id:'mix', ko:'모두 섞어서', en:'Mix It Up', icon:'dice', t:{ face:'#ffffff', edge:'#c3a6ff', shade:'#a084e6' },
    got:gotTotal(), total:TOTAL, cls:' mixtile', k:WORLDS.length });
  return `<section class="screen pick">
    <header class="bar">
      ${homeButton()}
      <div class="game-chip" style="--edge:${g.edge}">${iconHTML(g.icon)}<span>${g.ko}</span></div>
      ${starPill(P.stars)}
    </header>
    <h1 class="pick-title">어떤 단어로 놀까?</h1>
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
