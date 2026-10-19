// screens/home.js (owner: ui) — the princess, the three games, the sticker book, the grown-up corner.
import { store } from '../state.js';
import { GAMES_META, TOTAL } from '../data.js';
import { gotTotal } from '../storage.js';
import { sfx, stopVoice } from '../audio.js';
import { iconHTML } from '../images.js';
import { stageHTML } from '../art.js';
import { registerScreen, registerActions, go, letters, starPill, ICON } from '../router.js';

// full screen where the browser allows it (not when already opened from the home screen)
function canFullscreen(){
  const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  return !installed && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}
function toggleFullscreen(){
  const d = document, el = d.documentElement;
  try {
    const r = (d.fullscreenElement || d.webkitFullscreenElement)
      ? (d.exitFullscreen || d.webkitExitFullscreen).call(d)
      : (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if (r && r.catch) r.catch(() => {});
  } catch (e) {}
}

function homeHTML(){
  const P = store.P;
  return `<section class="screen home">
    <header class="top">
      <h1 class="word logo" aria-label="Rainbow Words">${letters('Rainbow Words')}</h1>
      <div class="top-r">
        ${canFullscreen() ? `<button class="round sm toy" data-act="fullscreen" aria-label="전체 화면">${ICON.full}</button>` : ''}
        ${starPill(P.stars, { act:'closet' })}
      </div>
    </header>
    ${stageHTML(`<button class="dress-chip toy" data-act="closet">${iconHTML('dress')}옷 입히기</button>`)}
    <h2 class="sec">게임하고 별을 모아요</h2>
    <div class="games">${GAMES_META.map((g, k) => `<button class="game toy" data-act="pickgame" data-game="${g.id}" style="--face:${g.face};--edge:${g.edge};--shade:${g.shade};--d:${k * -.7}s">
      ${iconHTML(g.icon, 'gi')}<span class="gn">${g.ko}</span><span class="gs">${g.sub}</span></button>`).join('')}</div>
    <button class="wide toy" data-act="book">${iconHTML('notebook')}내 스티커북 <small>${gotTotal()} / ${TOTAL}</small></button>
    <p class="note">소리를 켜 주세요. 영어는 미국식 발음으로 미리 녹음해 두었어요.</p>
    <button class="mini grownup" data-act="parent">${iconHTML('lock')}어른 메뉴</button>
  </section>`;
}

registerScreen('home', { html:homeHTML });
registerActions({
  home: () => { stopVoice(); sfx.pop(); go('home'); },
  fullscreen: () => { sfx.pop(); toggleFullscreen(); },
});
