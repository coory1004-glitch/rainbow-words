// router.js (owner: ui) — screen registry, one delegated click handler, render/go. Also small shared UI helpers.
import { store } from './state.js';
import { byId, RAINBOW } from './data.js';
import { iconHTML } from './images.js';
import { musicScene } from './audio.js';

export const app = document.getElementById('app');

const SCREENS = {};
const ACTIONS = {};
const SESSION_SCREENS = ['intro', 'play', 'result'];
let current = null, renderId = 0;

// name → { html(), mount?(later), unmount?() }
export function registerScreen(name, impl){ SCREENS[name] = impl; }
// data-act="name" click handlers: (el, event) => void
export function registerActions(map){ Object.assign(ACTIONS, map); }

export function render({ keepScroll = false } = {}){
  const S = store.S;
  if (current && SCREENS[current] && SCREENS[current].unmount) { try { SCREENS[current].unmount(); } catch (e) { console.error(e); } }
  if (SESSION_SCREENS.includes(S.screen) && !S.ses) S.screen = 'home';
  if (!SCREENS[S.screen]) S.screen = 'home';
  current = S.screen;
  document.body.dataset.world = SESSION_SCREENS.includes(S.screen) && byId[S.ses.world] ? S.ses.world : 'home';
  document.body.dataset.screen = S.screen;
  const y = window.scrollY, tabsEl = app.querySelector('.tabs'), tx = tabsEl ? tabsEl.scrollLeft : 0;
  app.innerHTML = SCREENS[S.screen].html();
  window.scrollTo(0, keepScroll ? y : 0);
  const t2 = app.querySelector('.tabs'); if (t2 && keepScroll) t2.scrollLeft = tx;
  const id = ++renderId;
  const later = (fn, ms) => setTimeout(() => { if (id === renderId) fn(); }, ms);
  musicScene(S.screen === 'play' ? 'game' : 'menu');
  if (SCREENS[S.screen].mount) SCREENS[S.screen].mount(later);
}

// sets store.S.screen and renders
export function go(screen, opts){ store.S.screen = screen; render(opts); }

app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && app.contains(el) && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el, e);
});

/* ---------- shared UI helpers (used by several screens) ---------- */
export const ICON = {
  home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.6 10v9.6h4.6v-5.4h3.6v5.4h4.6V10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>',
  speaker:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.4h3.6L12.4 5v14l-4.8-4.4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.8 8.6a4.8 4.8 0 0 1 0 6.8M18.4 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  full:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.4 5.6 18.8 12l-6.4 6.4" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// rainbow letters; tap=true makes each letter say its name (data-act="letter")
export function letters(text, tap = false){
  let k = 0;
  return text.split(' ').map(g => `<span class="wgrp">${[...g].map(ch => {
    const s = `style="--c:${RAINBOW[k % 7]};--d:${k * 65}ms"`; k++;
    return tap && /[a-z]/i.test(ch) ? `<span class="ltr" data-act="letter" data-l="${ch}" ${s}>${ch}</span>` : `<span class="ltr" ${s}>${ch}</span>`;
  }).join('')}</span>`).join('');
}
export function wordSize(text){
  const L = Math.max(...text.split(' ').map(s => s.length));
  return `min(120px, ${(84 / (L * 0.7)).toFixed(2)}vw, 15vh)`;
}
// the star counter pill; pass id 'sesStars' on the play screen so flying stars land there
export function starPill(n, { id = '', act = '' } = {}){
  const tag = act ? 'button' : 'div';
  return `<${tag} class="pill"${id ? ` id="${id}"` : ''}${act ? ` data-act="${act}"` : ''} aria-label="별 ${n}개">${iconHTML('star')}<b>${n}</b></${tag}>`;
}
export const homeButton = () => `<button class="round toy" data-act="home" aria-label="처음 화면으로">${ICON.home}</button>`;
