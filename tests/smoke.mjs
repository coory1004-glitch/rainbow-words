#!/usr/bin/env node
// Rainbow Words smoke test — runs the whole flow in headless Chromium against an already running static server.
//   python3 -m http.server <PORT> --bind 127.0.0.1   (from the repo root, in the background)
//   node tests/smoke.mjs <PORT>
// Steps: home loads clean → each game (worm, jump, balloon) auto-played to the result screen via engine testHint()
// → closet purchase → reload keeps stars / stickers / owned / wear. Prints PASS/FAIL per step; exits 1 on any FAIL.
import { createRequire } from 'module';

const port = Number(process.argv[2]);
if (!port) { console.error('usage: node tests/smoke.mjs <port>'); process.exit(2); }
const BASE = `http://127.0.0.1:${port}/`;

let chromium;
try { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }
catch (e) { ({ chromium } = await import('playwright')); }

const GAMES = [
  { id:'worm', world:'unicorn' },
  { id:'jump', world:'halloween' },
  { id:'balloon', world:'colors' },
];
const GAME_TIMEOUT = 300e3;   // generous: games may add countdowns, intros, animations

let failed = 0;
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
function report(ok, step, detail = ''){
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? '  — ' + detail : ''}  [${secs()}]`);
  return ok;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:1 });
const page = await ctx.newPage();

/* ---------- console watch ---------- */
const problems = [];       // console errors, page errors, missing voice lines
const notes = [];
const EXTERNAL = /fonts\.googleapis\.com|fonts\.gstatic\.com/;
page.on('console', m => {
  const text = m.text(), url = (m.location() && m.location().url) || '';
  if (m.type() === 'error') {
    if (EXTERNAL.test(text) || EXTERNAL.test(url)) { notes.push('external font: ' + text); return; }
    problems.push('console.error: ' + text + (url ? ` (${url})` : ''));
  } else if (m.type() === 'warning' && /\[voice\] missing/.test(text)) problems.push('missing voice line: ' + text);
});
page.on('pageerror', e => problems.push('pageerror: ' + (e && e.stack || e)));
page.on('requestfailed', r => {
  const why = (r.failure() && r.failure().errorText) || '';
  if (EXTERNAL.test(r.url()) || /ERR_ABORTED/.test(why)) return;   // aborted by our own reload/navigation
  problems.push('request failed: ' + r.url() + ' ' + why);
});
page.on('response', r => { if (r.status() >= 400 && !EXTERNAL.test(r.url())) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
let seen = 0;
function newProblems(){ const p = problems.slice(seen); seen = problems.length; return p; }

/* ---------- helpers ---------- */
async function poll(fn, { timeout = 15000, every = 100 } = {}){
  const end = Date.now() + timeout; let v;
  while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch (e) {} await sleep(every); }
  return null;
}
const appState = () => page.evaluate(async () => {
  const { store } = await import('/js/state.js');
  return { screen:store.S.screen, game:store.S.game, ses:store.S.ses ? JSON.parse(JSON.stringify(store.S.ses)) : null, P:store.P ? JSON.parse(JSON.stringify(store.P)) : null };
});
const screenIs = name => poll(async () => (await appState()).screen === name, { timeout:20000 });

// click a [data-act] element like a child would; fall back to forced/synthetic clicks if animations get in the way
async function tap(selector){
  const loc = page.locator(selector);
  const n = await loc.count();
  let target = null;
  for (let i = 0; i < n; i++) { if (await loc.nth(i).isVisible()) { target = loc.nth(i); break; } }
  if (!target) return false;
  try { await target.click({ timeout:4000 }); return true; } catch (e) {}
  try { await target.click({ force:true, timeout:2000 }); return true; } catch (e) {}
  try { await target.dispatchEvent('click'); return true; } catch (e) {}
  return false;
}
async function goScreen(name){ await page.evaluate(async n => { (await import('/js/router.js')).go(n); }, name); }
async function noEmoji(label){
  const hits = await page.evaluate(() => {
    const re = /\p{Extended_Pictographic}/u, out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 40));
    return out;
  });
  if (hits.length) report(false, `no system emoji on ${label}`, JSON.stringify(hits.slice(0, 5)));
}
async function goHome(){
  if (!(await tap('[data-act="home"]'))) await goScreen('home');
  return screenIs('home');
}

/* ---------- 1. home ---------- */
try {
  await page.goto(BASE, { waitUntil:'load' });
  const ok = await poll(() => page.evaluate(async () => {
    const { store } = await import('/js/state.js');
    return !!store.P && store.S.screen === 'home' && document.querySelector('#app').children.length > 0;
  }), { timeout:20000 });
  await sleep(1500);
  const p = newProblems();
  report(!!ok && !p.length, 'home loads with zero console errors', p.join(' | '));
  await noEmoji('home');
} catch (e) { report(false, 'home loads with zero console errors', String(e)); }

/* ---------- 2. play every game to the result screen ---------- */
async function playGame({ id, world }){
  const step = `${id}: home → ${world} → skip intro → auto-play → result`;
  try {
    if (!(await goHome())) return report(false, step, 'could not reach home');
    const before = (await appState()).P.stars;

    if (!(await tap(`[data-act="pickgame"][data-game="${id}"]`))) {
      await page.evaluate(async g => { const { store } = await import('/js/state.js'); store.S.game = g; (await import('/js/router.js')).go('pick'); }, id);
    }
    if (!(await screenIs('pick'))) return report(false, step, 'pick screen not shown');
    if ((await appState()).game !== id) return report(false, step, 'store.S.game is not ' + id);
    await noEmoji(`pick (${id})`);

    if (!(await tap(`[data-act="world"][data-id="${world}"]`))) {
      await page.evaluate(async w => { (await import('/js/session.js')).startSession(w); }, world);
    }
    if (!(await screenIs('intro'))) return report(false, step, 'intro screen not shown');
    await sleep(600);
    await noEmoji(`intro (${id})`);

    if (!(await tap('[data-act="startplay"]'))) await goScreen('play');
    const on = await poll(() => page.evaluate(async () => {
      const { store } = await import('/js/state.js'), m = await import('/js/engine.js');
      return store.S.screen === 'play' && m.G.on;
    }), { timeout:20000 });
    if (!on) return report(false, step, 'game did not start (screen play + G.on)');
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());

    // auto-play with the game's own testHint()
    const end = Date.now() + GAME_TIMEOUT;
    let held = false, actions = 0, last = '', lastRound = -1, lastProgress = Date.now();
    while (Date.now() < end) {
      const s = await page.evaluate(async () => {
        const { store } = await import('/js/state.js'), m = await import('/js/engine.js');
        let hint = null;
        try {
          hint = typeof m.testHint === 'function' ? m.testHint()
            : (m.GAMES && m.GAMES[m.G.type] && m.GAMES[m.G.type].testHint ? m.GAMES[m.G.type].testHint() : null);
        } catch (e) { hint = null; }
        const r = m.G.cv && m.G.cv.isConnected ? m.G.cv.getBoundingClientRect() : null;
        return { screen:store.S.screen, on:!!m.G.on, round:m.G.round, hint, rect:r ? { left:r.left, top:r.top } : null };
      });
      if (s.screen === 'result') break;
      if (s.screen !== 'play') { await sleep(200); continue; }
      if (s.round !== lastRound) { lastRound = s.round; lastProgress = Date.now(); }
      if (s.hint && s.rect) {
        const x = s.rect.left + s.hint.x, y = s.rect.top + s.hint.y;
        if (s.hint.action === 'move') {
          await page.mouse.move(x, y);
          if (!held) { await page.mouse.down(); held = true; }
          await sleep(40);
        } else if (s.hint.action === 'tap') {
          await page.mouse.click(x, y); actions++; await sleep(300);
        } else if (s.hint.action === 'press') {
          await page.keyboard.press('Space'); actions++; await sleep(300);
        } else { last = 'unknown hint action ' + s.hint.action; await sleep(100); }
      } else await sleep(40);
    }
    if (held) { await page.mouse.move(2, 2); await page.mouse.up(); }
    const st = await appState();
    if (st.screen !== 'result') return report(false, step, `timed out on round ${lastRound} (no progress for ${((Date.now() - lastProgress) / 1000).toFixed(0)}s) ${last}`);
    const ROUNDS = await page.evaluate(async () => (await import('/js/state.js')).ROUNDS);
    const earned = st.P.stars - before;
    const p = newProblems();
    report(st.ses.stars >= ROUNDS && earned === st.ses.stars && !p.length, step,
      `session stars ${st.ses.stars} (rounds ${ROUNDS} + bonus ${st.ses.bonus}), saved stars +${earned}` + (p.length ? ' | ' + p.join(' | ') : ''));
    await sleep(800);
    await noEmoji(`result (${id})`);
  } catch (e) { report(false, step, String(e && e.stack || e)); }
}
for (const g of GAMES) await playGame(g);

/* ---------- 3. sticker book opens ---------- */
try {
  await goHome();
  if (!(await tap('[data-act="book"]'))) await goScreen('book');
  const ok = await screenIs('book');
  const got = (await appState()).P.got;
  const unlocked = await page.locator('[data-act="say"]').count();
  report(!!ok && unlocked >= Object.keys(got).length && Object.keys(got).length > 0, 'sticker book shows collected stickers', `got ${Object.keys(got).length}, unlocked stickers on page ${unlocked}`);
  await noEmoji('book');
} catch (e) { report(false, 'sticker book shows collected stickers', String(e)); }

/* ---------- 4. closet: buy one affordable item ---------- */
try {
  await goHome();
  if (!(await tap('[data-act="closet"]'))) await goScreen('closet');
  if (!(await screenIs('closet'))) throw new Error('closet screen not shown');
  const pick = await page.evaluate(async () => {
    const { SHOP } = await import('/js/data.js'), { owns } = await import('/js/storage.js'), { store } = await import('/js/state.js');
    const all = SHOP.flatMap(c => c.items.map(it => ({ cid:c.id, id:it[0], price:it[3] })));
    const can = all.filter(x => !owns(x.cid, x.id) && x.price > 0 && x.price <= store.P.stars).sort((a, b) => a.price - b.price);
    return can[0] || null;
  });
  if (!pick) throw new Error('nothing affordable to buy');
  const before = (await appState()).P;
  const curCat = await page.evaluate(async () => (await import('/js/state.js')).store.S.cat);
  if (curCat !== pick.cid && !(await tap(`[data-act="tab"][data-cat="${pick.cid}"]`))) {
    await page.evaluate(async c => { const { store } = await import('/js/state.js'); store.S.cat = c; (await import('/js/router.js')).render({ keepScroll:true }); }, pick.cid);
  }
  await poll(() => page.locator(`[data-act="item"][data-cat="${pick.cid}"][data-id="${pick.id}"]`).count(), { timeout:5000 });
  if (!(await tap(`[data-act="item"][data-cat="${pick.cid}"][data-id="${pick.id}"]`))) throw new Error(`item ${pick.cid}:${pick.id} not on screen`);
  // tapping a locked item only tries it on; the big buy button makes the purchase
  await poll(() => page.locator('[data-act="buy"]').count(), { timeout:3000 });
  if (await page.locator('[data-act="buy"]').count()) await tap('[data-act="buy"]');
  const ok = await poll(async () => { const P = (await appState()).P; return P.owned[pick.cid + ':' + pick.id] && P.wear[pick.cid] === pick.id && P.stars === before.stars - pick.price; }, { timeout:5000 });
  const p = newProblems();
  report(!!ok && !p.length, 'closet: buy one affordable item', `${pick.cid}:${pick.id} for ${pick.price} stars` + (p.length ? ' | ' + p.join(' | ') : ''));
  await noEmoji('closet');
} catch (e) { report(false, 'closet: buy one affordable item', String(e && e.message || e)); }

/* ---------- 5. reload keeps every reward ---------- */
try {
  await sleep(500);    // let the IndexedDB mirror write land
  const pick = P => ({ stars:P.stars, got:P.got, owned:P.owned, wear:P.wear });
  const before = pick((await appState()).P);
  await page.reload({ waitUntil:'load' });
  await poll(() => page.evaluate(async () => { const { store } = await import('/js/state.js'); return !!store.P && document.querySelector('#app').children.length > 0; }), { timeout:20000 });
  await sleep(1500);   // give a newer IndexedDB copy the chance to (wrongly) replace it
  const after = pick((await appState()).P);
  const same = JSON.stringify(before) === JSON.stringify(after);
  const p = newProblems();
  report(same && before.stars > 0 && Object.keys(before.got).length > 0 && !p.length, 'reload keeps stars, stickers, owned and wear',
    same ? `stars ${after.stars}, stickers ${Object.keys(after.got).length}, owned ${Object.keys(after.owned).length}` : `before ${JSON.stringify(before)} after ${JSON.stringify(after)}` + (p.length ? ' | ' + p.join(' | ') : ''));
} catch (e) { report(false, 'reload keeps stars, stickers, owned and wear', String(e)); }

const rest = newProblems();
if (rest.length) report(false, 'no console errors anywhere', rest.join(' | '));
if (notes.length) console.log('note: ' + [...new Set(notes)].slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `SMOKE FAIL (${failed} failing step${failed > 1 ? 's' : ''})` : 'SMOKE PASS', `[${secs()}]`);
process.exit(failed ? 1 : 0);
