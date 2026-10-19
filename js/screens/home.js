// screens/home.js (owner: ui) — the princess on her stage, the three games, the sticker book, the grown-up corner.
import { store } from '../state.js';
import { GAMES_META, TOTAL } from '../data.js';
import { gotTotal } from '../storage.js';
import { sfx, stopVoice, setMusic, isMusicOn, musicScene } from '../audio.js';
import { iconHTML } from '../images.js';
import { stageHTML } from '../art.js';
import { wiggle } from '../fx.js';
import { registerScreen, registerActions, go, app, letters, starPill, meterHTML, ICON } from '../router.js';

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

const musicBtn = () => {
  const on = isMusicOn();
  return `<button class="round sm toy glass music-btn${on ? '' : ' off'}" data-act="music" role="switch" aria-checked="${on}" aria-label="배경 음악 ${on ? '켜짐' : '꺼짐'}">${iconHTML(on ? 'music' : 'muted')}</button>`;
};

function gameCard(g, k){
  return `<button class="game toy" data-act="pickgame" data-game="${g.id}" style="--face:${g.face};--edge:${g.edge};--shade:${g.shade};--d:${(k * -.8).toFixed(1)}s;--i:${k}" aria-label="${g.ko}">
      <span class="plate gi-plate">${iconHTML(g.icon, 'gi')}</span>
      <span class="g-txt"><span class="gn">${g.ko}</span><span class="gs">${g.sub}</span></span>
      <span class="g-go" aria-hidden="true">${ICON.play}</span>
    </button>`;
}

function homeHTML(){
  const P = store.P, got = gotTotal();
  const tools = `<div class="stage-tools">${musicBtn()}${canFullscreen() ? `<button class="round sm toy glass" data-act="fullscreen" aria-label="전체 화면">${ICON.full}</button>` : ''}</div>`;
  const chip = `<button class="dress-chip toy" data-act="closet">${iconHTML('dress')}<span>옷 입히기</span></button>`;
  return `<section class="screen home">
    <header class="top">
      <h1 class="logo" aria-label="Rainbow Words">${iconHTML('rainbow', 'logo-ic')}<span class="word" aria-hidden="true">${letters('Rainbow Words')}</span></h1>
      ${starPill(P.stars, { act:'closet' })}
    </header>
    <div class="home-grid">
      <div class="hero">${stageHTML(tools + chip)}</div>
      <div class="home-side">
        <h2 class="sec home-sec">${iconHTML('sparkles')}게임하고 별을 모아요</h2>
        <div class="games">${GAMES_META.map(gameCard).join('')}</div>
        <button class="bookcard toy" data-act="book" aria-label="내 스티커북, ${got} / ${TOTAL}">
          <span class="plate bk-plate">${iconHTML('notebook')}</span>
          <span class="bk-txt"><span class="bk-t">내 스티커북</span>${meterHTML(got / TOTAL)}</span>
          <span class="bk-n"><b>${got}</b><small>/${TOTAL}</small></span>
          <span class="bk-chev" aria-hidden="true">${ICON.chev}</span>
        </button>
      </div>
    </div>
    <footer class="home-foot"><button class="mini grownup" data-act="parent">${iconHTML('lock')}어른 메뉴</button></footer>
  </section>`;
}

registerScreen('home', { html:homeHTML });
registerActions({
  home: () => { stopVoice(); sfx.pop(); go('home'); },
  fullscreen: () => { sfx.pop(); toggleFullscreen(); },
  music: el => {
    const on = !isMusicOn();
    setMusic(on);
    try { musicScene('menu'); } catch (e) {}   // re-apply the scene so music starts/stops right away
    sfx.pop();
    el.outerHTML = musicBtn();
    wiggle(app.querySelector('.music-btn'));
  },
});
