// router.js (owner: ui) — screen registry, one delegated click handler, render/go with a quick screen transition.
// Also small shared UI helpers (icons, rainbow letters, star pill, home button, meters).
import { store } from './state.js';
import { byId, RAINBOW } from './data.js';
import { iconHTML } from './images.js';
import { musicScene } from './audio.js';

export const app = document.getElementById('app');

const SCREENS = {};
const ACTIONS = {};
const SESSION_SCREENS = ['intro', 'play', 'result'];
// rough depth of each screen, so going "back" (towards home) animates the other way
const DEPTH = { home:0, closet:1, book:1, parent:1, pick:1, intro:2, play:3, result:4 };
const MUSIC = { play:'game' };
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
  const prev = current, changed = prev !== S.screen;
  current = S.screen;
  const world = SESSION_SCREENS.includes(S.screen) && S.ses ? S.ses.world : 'home';
  document.body.dataset.world = byId[world] || world === 'mix' ? world : 'home';
  document.body.dataset.screen = S.screen;
  const y = window.scrollY, tabsEl = app.querySelector('.tabs'), tx = tabsEl ? tabsEl.scrollLeft : 0;
  app.innerHTML = SCREENS[S.screen].html();
  // a new screen fades/rises in (transform + opacity only, so there is no layout jump)
  const root = app.firstElementChild;
  if (root && changed && prev) root.classList.add((DEPTH[S.screen] ?? 1) < (DEPTH[prev] ?? 1) ? 'enter-back' : 'enter');
  window.scrollTo(0, keepScroll ? y : 0);
  const t2 = app.querySelector('.tabs'); if (t2 && keepScroll) t2.scrollLeft = tx;
  const id = ++renderId;
  const later = (fn, ms) => setTimeout(() => { if (id === renderId) fn(); }, ms);
  try { musicScene(MUSIC[S.screen] || 'menu'); } catch (e) {}
  if (SCREENS[S.screen].mount) SCREENS[S.screen].mount(later);
}

// sets store.S.screen and renders
export function go(screen, opts){ store.S.screen = screen; render(opts); }
export const currentScreen = () => current;

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
  chev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.4c0-1.2 1.3-1.9 2.3-1.3l9 5.9c.9.6.9 1.9 0 2.5l-9 5.9c-1 .7-2.3-.1-2.3-1.3z" fill="currentColor"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  again:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19.6 3.6v4.6H15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 5.6V5a2.5 2.5 0 0 0-2.5-2.5H7A2.5 2.5 0 0 0 4.5 5v6A2.5 2.5 0 0 0 7 13.5h.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  q:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.6 1.2-1.6 2.3v.6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="19.2" r="1.8" fill="currentColor"/></svg>',
};
// rainbow letters; tap=true makes each letter say its name (data-act="letter")
export function letters(text, tap = false){
  let k = 0;
  return text.split(' ').map(g => `<span class="wgrp">${[...g].map(ch => {
    const s = `style="--c:${RAINBOW[k % 7]};--d:${k * 55}ms"`; k++;
    return tap && /[a-z]/i.test(ch) ? `<span class="ltr" data-act="letter" data-l="${ch}" ${s}>${ch}</span>` : `<span class="ltr" ${s}>${ch}</span>`;
  }).join('')}</span>`).join('');
}
// font size that keeps the longest word group on one line
export function wordSize(text, max = 120){
  const L = Math.max(...text.split(' ').map(s => s.length));
  return `min(${max}px, ${(80 / (L * 0.66)).toFixed(2)}vw, 15vh)`;
}
// the star counter pill; pass id 'sesStars' on the play screen so flying stars land there
export function starPill(n, { id = '', act = '' } = {}){
  const tag = act ? 'button' : 'div';
  return `<${tag} class="pill"${id ? ` id="${id}"` : ''}${act ? ` data-act="${act}"` : ''} aria-label="별 ${n}개">${iconHTML('star')}<b>${n}</b></${tag}>`;
}
export const homeButton = () => `<button class="round toy" data-act="home" aria-label="처음 화면으로">${ICON.home}</button>`;
// a rounded progress meter (p = 0..1); fill = css background (defaults to the rainbow)
export function meterHTML(p, fill = ''){
  const pc = Math.round(Math.max(0, Math.min(1, p)) * 100);
  return `<span class="meter-bar" aria-hidden="true"><i style="--p:${pc}%${fill ? `;--fill:${fill}` : ''}"></i></span>`;
}
