// screens/closet.js (owner: art) — dress up: categories, try on, buy with stars, wear owned items.
// Tapping an item always says its English name. A locked item is tried on first (not saved) with a big buy button.
import { store } from '../state.js';
import { SHOP, josa } from '../data.js';
import { save, itemOf, owns } from '../storage.js';
import { sfx, say, preload } from '../audio.js';
import { iconHTML } from '../images.js';
import { burstAt, wiggle, toast } from '../fx.js';
import { stageHTML, thumbHTML, avatarSVG } from '../art.js';
import { registerScreen, registerActions, go, render, app, starPill, homeButton } from '../router.js';

let trial = null;      // { cid, id } — a locked item she is trying on (never saved)
let poseT = 0;

const catOf = () => SHOP.find(c => c.id === store.S.cat) || SHOP[0];
const wearNow = () => trial ? { ...store.P.wear, [trial.cid]: trial.id } : store.P.wear;

function itemHTML(cid, [id, ko, en, price]){
  const P = store.P, own = owns(cid, id), wearing = P.wear[cid] === id, can = !own && P.stars >= price;
  const trying = !!trial && trial.cid === cid && trial.id === id;
  const cls = `item toy${wearing ? ' wearing' : ''}${own ? ' owned' : ' locked'}${can ? ' can' : ''}${trying ? ' trying' : ''}`;
  return `<button class="${cls}" data-act="item" data-cat="${cid}" data-id="${id}" aria-label="${ko}${own ? (wearing ? ', 입고 있어요' : '') : `, 별 ${price}개`}">
    <span class="th">${thumbHTML(cid, id)}</span><span class="nm">${en}</span>
    ${wearing ? `<span class="badge" aria-hidden="true">${iconHTML('check')}</span>` : own ? '' : `<span class="price">${iconHTML('star')}<b>${price}</b></span>`}
  </button>`;
}

function tryBarHTML(){
  if (!trial) return '';
  const it = itemOf(trial.cid, trial.id);
  if (!it) return '';
  const P = store.P, price = it[3], need = Math.max(0, price - P.stars);
  const body = need ? `<div class="need" role="status" aria-label="별 ${need}개가 더 필요해요">
        <span class="meter" style="--p:${Math.round(P.stars / price * 100)}%"><i></i></span>
        <span class="need-n">${iconHTML('star')}<b>${P.stars}</b><small>/${price}</small></span>
      </div>
      <button class="go toy" data-act="pickgame" data-game="${store.S.game}" aria-label="게임하러 가기">${iconHTML('game')}</button>`
    : `<button class="buy toy" data-act="buy" aria-label="별 ${price}개로 사기">${iconHTML('star')}<b>${price}</b><span>사기</span></button>`;
  return `<div class="trybar${need ? ' short' : ''}">${body}<button class="tryx" data-act="untry" aria-label="그만 입어 보기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg></button></div>`;
}

function stageWrapHTML(){
  const tag = trial ? `<span class="trytag">${iconHTML('sparkles')}입어 보는 중</span>` : '';
  return stageHTML(tag, trial ? 'trying' : '', wearNow()) + tryBarHTML();
}

const itemsHTML = cat => cat.items.map(it => itemHTML(cat.id, it)).join('');

function closetHTML(){
  const S = store.S, P = store.P, cat = catOf();
  return `<section class="screen closet">
    <header class="bar">
      ${homeButton()}
      <h1>${iconHTML('dress')}옷 입히기</h1>
      ${starPill(P.stars)}
    </header>
    <div class="closet-grid">
      <div class="stage-wrap">${stageWrapHTML()}</div>
      <div class="shop">
        <div class="tabs" role="tablist">${SHOP.map(c => `<button class="tab${c.id === cat.id ? ' on' : ''}" role="tab" aria-selected="${c.id === cat.id}" data-act="tab" data-cat="${c.id}">${iconHTML(c.icon)}<span>${c.ko}</span></button>`).join('')}</div>
        <div class="shelf">
          <div class="items">${itemsHTML(cat)}</div>
          <p class="note">${iconHTML('star')} 별은 게임에서 모아요. 갖고 싶은 옷을 누르면 먼저 입어 볼 수 있어요.</p>
          <div class="row"><button class="btn toy primary" data-act="pickgame" data-game="${S.game}">${iconHTML('game')}게임하러 가기</button></div>
        </div>
      </div>
    </div>
  </section>`;
}

// update the stage, the shelf and the star counter in place (keeps every scroll position)
function refresh(){
  if (store.S.screen !== 'closet') return;
  const sw = app.querySelector('.stage-wrap'), items = app.querySelector('.closet .items'), pill = app.querySelector('.closet .bar .pill b');
  if (!sw || !items) { render({ keepScroll:true }); return; }
  sw.innerHTML = stageWrapHTML();
  items.innerHTML = itemsHTML(catOf());
  if (pill) pill.textContent = store.P.stars;
}
// show a pose for a moment, then go back to idle
function strike(pose, ms = 0){
  const box = app.querySelector('.stage-av'), svg = box && box.querySelector('svg.avatar');
  if (!svg) return;
  svg.outerHTML = avatarSVG(wearNow(), { pose });
  box.classList.remove('hop'); void box.offsetWidth; box.classList.add('hop');
  clearTimeout(poseT);
  if (pose === 'idle') return;
  poseT = setTimeout(() => {
    const b = app.querySelector('.stage-av'), s = b && b.querySelector('svg.avatar');
    if (s && store.S.screen === 'closet' && s.dataset.pose === pose) s.outerHTML = avatarSVG(wearNow());
  }, ms);
}
function stageBurst(n){ const sb = app.querySelector('.stage-av'); if (sb) burstAt(sb, n); }

function wearItem(cid, id, en){
  const P = store.P;
  P.wear[cid] = id; save();
  if (trial && trial.cid === cid) trial = null;
  refresh(); sfx.pop();
  say(id === 'none' ? 'All clear!' : en);
  if (id !== 'none') { strike('idle'); stageBurst(18); }
}
function tryItem(cid, id, en, price){
  trial = { cid, id };
  refresh();
  if (sfx.whoosh) sfx.whoosh(); else sfx.pop();
  strike('idle'); stageBurst(12);
  say([en, store.P.stars >= price ? 'Try it on!' : "Let's get more stars!"]);
}
function buy(){
  if (!trial) return;
  const P = store.P, { cid, id } = trial, it = itemOf(cid, id);
  if (!it) { trial = null; refresh(); return; }
  const [, ko, en, price] = it;
  if (owns(cid, id)) { wearItem(cid, id, en); return; }
  if (P.stars < price) { sfx.boop(); say("Let's get more stars!"); return; }
  P.stars -= price; P.owned[cid + ':' + id] = 1; P.wear[cid] = id; save();
  trial = null;
  refresh();
  sfx.fanfare(); sfx.sparkle?.();
  say(Math.random() < .7 ? ['Wow!', en] : 'So pretty!');
  strike('cheer', 1900); stageBurst(80);
  const pill = app.querySelector('.closet .bar .pill'); if (pill) wiggle(pill);
  toast(`짜잔! ${ko}${josa(ko)} 샀어요!`);
}

registerScreen('closet', {
  html:closetHTML,
  // render() unmounts before every re-render too; only a real exit drops the try-on
  unmount(){ clearTimeout(poseT); if (store.S.screen !== 'closet') trial = null; },
});
registerActions({
  closet: () => { trial = null; preload(['common']); sfx.pop(); say('Dress up!'); go('closet'); },
  tab: el => { if (el.classList.contains('on')) return; sfx.pop(); store.S.cat = el.dataset.cat; render({ keepScroll:true }); },
  item: el => {
    const cid = el.dataset.cat, id = el.dataset.id, it = itemOf(cid, id);
    if (!it) return;
    const [, , en, price] = it;
    if (owns(cid, id)) { wearItem(cid, id, en); return; }
    if (trial && trial.cid === cid && trial.id === id) { sfx.pop(); say(en); strike('idle'); return; }
    tryItem(cid, id, en, price);
  },
  buy: () => buy(),
  untry: () => { trial = null; sfx.pop(); refresh(); },
});
