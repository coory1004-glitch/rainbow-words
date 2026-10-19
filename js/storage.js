// storage.js (owner: core) — saved progress. Rewards (stars, stickers, outfits, what she wears) must never reset by accident.
//
// Three copies, newest wins, stickers/outfits are unioned so a clock hiccup can never take one away:
//   1. localStorage 'rainbow-words-v1'      primary copy, written synchronously on every save (players already have v1 data here)
//   2. localStorage 'rainbow-words-v1.bak'  the last good copy seen at boot (and refreshed when a session ends)
//   3. IndexedDB 'rainbow-words' / kv / 'P' mirror of every save; reconciled after boot, then onRestored callbacks fire
// Only resetProgress() / importCode() (parent screen, behind a gate) may clear progress; they stamp clearedAt so older
// copies are not merged back in.
import { store } from './state.js';
import { WORLDS, SHOP, DEF_WEAR, wordOf } from './data.js';

const KEY = 'rainbow-words-v1', BAK = KEY + '.bak', BAD = KEY + '.corrupt', PRE = KEY + '.before-clear';
const DB_NAME = 'rainbow-words', DB_STORE = 'kv', DB_KEY = 'P';

const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const obj = o => (isObj(o) ? o : {});
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const flags = o => { const r = {}; for (const k of Object.keys(obj(o))) if (o[k]) r[k] = 1; return r; };

export function defaults(){
  return { v:2, stars:0, got:{}, owned:{}, wear:{ ...DEF_WEAR },
    settings:{ music:true, sfx:true }, stats:{ games:0, firstPlayed:0, lastPlayed:0 }, updatedAt:0 };
}

// migrate any older shape (v1 = { stars, got, owned, wear }) to v2; unknown fields are preserved
const validWear = (cid, id) => { const c = SHOP.find(c => c.id === cid); return !!c && c.items.some(it => it[0] === id); };
function normalize(d){
  const P = Object.assign({}, obj(d));
  P.v = 2;
  P.stars = Math.max(0, Math.floor(num(P.stars)));
  P.got = flags(P.got);
  P.owned = flags(P.owned);
  const wear = { ...DEF_WEAR, ...obj(P.wear) };
  for (const c of Object.keys(DEF_WEAR)) if (!validWear(c, wear[c])) wear[c] = DEF_WEAR[c];
  P.wear = wear;
  P.settings = { music:true, sfx:true, ...obj(P.settings) };
  P.stats = { games:0, firstPlayed:0, lastPlayed:0, ...obj(P.stats) };
  P.stats.games = Math.max(0, Math.floor(num(P.stats.games)));
  P.updatedAt = num(P.updatedAt);
  if (P.clearedAt != null) P.clearedAt = num(P.clearedAt);
  return P;
}
function parse(raw){
  if (!raw || typeof raw !== 'string') return null;
  try { const d = JSON.parse(raw); return isObj(d) ? d : null; } catch (e) { return null; }
}
const hasProgress = P => !!P && (P.stars > 0 || Object.keys(P.got).length > 0 || Object.keys(P.owned).length > 0 || P.stats.games > 0);

// newest copy wins; stickers and bought outfits from the other copy are kept unless it predates a grown-up reset
function merge(a, b){
  const [win, lose] = (b.updatedAt > a.updatedAt) ? [b, a] : [a, b];
  const out = normalize(win);
  if (lose.updatedAt >= (win.clearedAt || 0)) {
    out.got = { ...lose.got, ...out.got };
    out.owned = { ...lose.owned, ...out.owned };
  }
  return out;
}

/* ---------- localStorage (may be missing, full or throw in private mode) ---------- */
let lsOk = true;
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { lsOk = false; return null; } };
function lsSet(k, v){
  for (let attempt = 0; attempt < 2; attempt++) {
    try { localStorage.setItem(k, v); lsOk = true; return true; }
    catch (e) {
      // quota: drop our own non-essential copies once and retry
      if (attempt === 0 && k !== BAD) { try { localStorage.removeItem(BAD); localStorage.removeItem(PRE); } catch (e2) {} continue; }
      lsOk = false;
    }
  }
  return false;
}

// replace store.P's contents in place so any module holding a reference sees the new data
function replaceP(next){
  if (!store.P) { store.P = next; return; }
  for (const k of Object.keys(store.P)) delete store.P[k];
  Object.assign(store.P, next);
}

/* ---------- IndexedDB mirror ---------- */
let dbp = null, idbOk = false;
function db(){
  if (dbp) return dbp;
  dbp = new Promise(res => {
    const t = setTimeout(() => res(null), 4000);        // some private modes never answer
    const done = v => { clearTimeout(t); idbOk = !!v; res(v); };
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return done(null);
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(DB_STORE); } catch (e) {} };
      r.onsuccess = () => {
        const d = r.result;
        d.onversionchange = () => { try { d.close(); } catch (e) {} dbp = null; };
        done(d);
      };
      r.onerror = () => done(null);
      r.onblocked = () => done(null);
    } catch (e) { done(null); }
  });
  return dbp;
}
async function idbPut(val){
  const d = await db(); if (!d) return false;
  return new Promise(res => {
    try {
      const tx = d.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(val, DB_KEY);
      tx.oncomplete = () => res(true);
      tx.onerror = tx.onabort = () => res(false);
    } catch (e) { dbp = null; res(false); }
  });
}
async function idbGet(){
  const d = await db(); if (!d) return null;
  return new Promise(res => {
    try {
      const r = d.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    } catch (e) { dbp = null; res(null); }
  });
}

/* ---------- restore callbacks ---------- */
const restoredCbs = [];
export function onRestored(cb){ if (typeof cb === 'function') restoredCbs.push(cb); }
const fireRestored = () => restoredCbs.forEach(cb => { try { cb(); } catch (e) {} });

/* ---------- boot ---------- */
let bootFound = false;          // load() found a saved copy in localStorage
let reconciled = null;          // promise: IndexedDB has been compared with what load() found
let lastWritten = '';           // JSON of the last copy written, to spot unsaved changes at pagehide

// sync. Reads saved progress, migrates, sets and returns store.P. Never throws.
export function load(){
  try {
    const raw = lsGet(KEY), rawBak = lsGet(BAK);
    const main = parse(raw), bak = parse(rawBak);
    if (raw && !main) lsSet(BAD, raw);              // keep the broken copy for inspection, never silently drop it
    let P = null;
    if (main && bak) P = merge(normalize(main), normalize(bak));
    else if (main || bak) P = normalize(main || bak);
    bootFound = !!P;
    replaceP(P || defaults());
    const s = JSON.stringify(store.P);
    // last good copy from the previous visit — but never replace a .bak that has progress with an emptied main copy
    // (unless a grown-up reset/import emptied it on purpose)
    const mN = main && normalize(main), bN = bak && normalize(bak);
    if (main && !(bN && hasProgress(bN) && !hasProgress(mN) && !((mN.clearedAt || 0) >= bN.updatedAt))) lsSet(BAK, raw);
    if (P && (!main || s !== raw)) lsSet(KEY, s);   // migrated (v1 → v2) or recovered from .bak: write it back
    lastWritten = P ? s : '';
  } catch (e) {
    if (!store.P) store.P = defaults();
  }
  reconciled = reconcile().catch(() => {});
  return store.P;
}

// after boot: compare with the IndexedDB mirror. If it holds a newer copy (or localStorage came back empty), bring it back.
async function reconcile(){
  const raw = await idbGet();
  const d = typeof raw === 'string' ? parse(raw) : isObj(raw) ? raw : null;
  const cur = store.P;
  if (d) {
    const m = normalize(d);
    let next = null;
    if (!bootFound && hasProgress(m)) {
      // localStorage was cleared: the mirror is the real progress. Keep anything earned since boot on top of it.
      next = normalize(m);
      if (cur.updatedAt > 0 && cur.updatedAt >= (m.clearedAt || 0)) {
        next.stars = m.stars + cur.stars;
        next.got = { ...m.got, ...cur.got };
        next.owned = { ...m.owned, ...cur.owned };
        next.stats.games = m.stats.games + cur.stats.games;
        for (const c of Object.keys(DEF_WEAR)) if (cur.wear[c] !== DEF_WEAR[c]) next.wear[c] = cur.wear[c];
        next.settings = { ...m.settings, ...cur.settings };
        next.updatedAt = Math.max(m.updatedAt, cur.updatedAt);
      }
    } else if (m.updatedAt > cur.updatedAt) {
      next = merge(cur, m);
    } else if (m.updatedAt < cur.updatedAt || JSON.stringify(m) !== JSON.stringify(cur)) {
      const merged = merge(cur, m);
      if (Object.keys(merged.got).length !== Object.keys(cur.got).length || Object.keys(merged.owned).length !== Object.keys(cur.owned).length) next = merged;
    }
    if (next) {
      replaceP(next);
      writeAll(JSON.stringify(store.P));
      fireRestored();
      return;
    }
  }
  if (bootFound || store.P.updatedAt) await idbPut(JSON.stringify(store.P));
}

function writeAll(s){
  lastWritten = s;
  lsSet(KEY, s);
  // never let a write race ahead of the boot comparison (it could overwrite the only good copy)
  (reconciled || Promise.resolve()).then(() => idbPut(s));
}

// sync write to localStorage + async mirror to IndexedDB. Stamps P.updatedAt.
export function save(){
  const P = store.P; if (!P) return;
  const now = Date.now();
  P.updatedAt = Math.max(now, (P.updatedAt || 0) + 1);
  if (!P.stats || typeof P.stats !== 'object') P.stats = { games:0, firstPlayed:0, lastPlayed:0 };
  if (!P.stats.firstPlayed) P.stats.firstPlayed = now;
  P.stats.lastPlayed = now;
  let s;
  try { s = JSON.stringify(P); } catch (e) { return; }
  writeAll(s);
}

// the tab is going away (closed, app switched, phone locked): make sure everything is on disk
function flush(){
  const P = store.P; if (!P) return;
  let s; try { s = JSON.stringify(P); } catch (e) { return; }
  if (s !== lastWritten && (bootFound || hasProgress(P) || P.updatedAt)) save();
  else if (lastWritten) idbPut(lastWritten);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flush(); if (lastWritten) lsSet(BAK, lastWritten); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('beforeunload', flush);
  // another tab of the game saved: take its newer copy so the two tabs never undo each other
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue || !store.P) return;
    const d = parse(e.newValue); if (!d) return;
    const m = normalize(d);
    if (m.updatedAt > store.P.updatedAt) { replaceP(merge(store.P, m)); lastWritten = JSON.stringify(store.P); fireRestored(); }
  });
}

// resolves once the IndexedDB comparison after boot is done (tests and the parent screen may wait on it)
export const whenReady = () => reconciled || Promise.resolve();

// navigator.storage.persist() once, after a user gesture; safe to call often
let persistState = 'unknown', persistAsked = false;
export function requestPersist(){
  if (persistAsked) return;
  persistAsked = true;
  try {
    const st = navigator.storage;
    if (!st || !st.persist) { persistState = 'unsupported'; return; }
    (st.persisted ? st.persisted() : Promise.resolve(false))
      .then(p => p || st.persist())
      .then(p => { persistState = p ? 'granted' : 'denied'; if (!p) persistAsked = false; })   // denied: ask again on a later tap
      .catch(() => { persistState = 'unsupported'; });
  } catch (e) { persistState = 'unsupported'; }
}
// ask on real taps until the browser says yes (Chrome grants it once the site is "engaged"); a few tries at most
let persistTries = 0;
if (typeof document !== 'undefined') {
  const ask = e => { if (e.isTrusted === false || persistState === 'granted' || persistTries >= 4) return; if (!persistAsked) persistTries++; requestPersist(); };
  document.addEventListener('pointerdown', ask, { capture:true, passive:true });
  document.addEventListener('keydown', ask, { capture:true, passive:true });
}
// for the parent screen: where progress is kept right now
export function storageInfo(){
  return { local:lsOk, mirror:idbOk, persisted:persistState, updatedAt:store.P ? store.P.updatedAt : 0 };
}

/* ---------- parent transfer code: RW1-<base64url json>-<checksum> ---------- */
function fnv(s){
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function b64urlEncode(str){
  const bytes = new TextEncoder().encode(str);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s){
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const CORE = ['v', 'stars', 'got', 'owned', 'wear', 'settings', 'stats', 'updatedAt', 'clearedAt'];
export function exportCode(){
  const P = store.P || defaults();
  const extra = {}; for (const k of Object.keys(P)) if (!CORE.includes(k)) extra[k] = P[k];
  const data = { v:2, s:P.stars, g:Object.keys(P.got), o:Object.keys(P.owned), w:P.wear, st:P.stats, t:Date.now() };
  if (Object.keys(extra).length) data.x = extra;
  const body = b64urlEncode(JSON.stringify(data));
  return `RW1-${body}-${fnv(body)}`;
}
const ERR = {
  empty:'코드를 붙여 넣어 주세요.',
  format:'레인보우 워즈 저장 코드가 아니에요. RW1- 로 시작하는 코드를 그대로 붙여 넣어 주세요.',
  broken:'코드가 중간에 잘렸거나 바뀌었어요. 처음부터 끝까지 다시 복사해서 붙여 넣어 주세요.',
  failed:'코드를 읽지 못했어요. 다시 한 번 복사해서 붙여 넣어 주세요.',
};
// → { ok:true } | { ok:false, error:'<Korean message>' }; on ok replaces + saves P
export function importCode(text){
  try {
    const t = String(text || '').replace(/\s+/g, '');
    if (!t) return { ok:false, error:ERR.empty };
    const m = t.match(/RW1-([A-Za-z0-9_-]+)-([0-9a-z]+)/);
    if (!m) return { ok:false, error:ERR.format };
    if (fnv(m[1]) !== m[2]) return { ok:false, error:ERR.broken };
    let d; try { d = JSON.parse(b64urlDecode(m[1])); } catch (e) { return { ok:false, error:ERR.broken }; }
    if (!isObj(d)) return { ok:false, error:ERR.broken };
    const list = a => Array.isArray(a) ? Object.fromEntries(a.filter(k => typeof k === 'string').map(k => [k, 1])) : flags(a);
    const src = 's' in d ? { stars:d.s, got:list(d.g), owned:list(d.o), wear:d.w, stats:d.st, ...obj(d.x) }
                         : { stars:d.stars, got:list(d.got), owned:list(d.owned), wear:d.wear, stats:d.stats };
    if (!Number.isFinite(Number(src.stars))) return { ok:false, error:ERR.broken };
    keepBeforeClear();
    const cur = store.P || defaults();
    const next = normalize({ ...src, settings:{ ...obj(cur.settings) }, clearedAt:Date.now() });
    next.stats = { ...obj(cur.stats), ...obj(src.stats) };
    replaceP(next);
    save();
    return { ok:true };
  } catch (e) { return { ok:false, error:ERR.failed }; }
}

// a copy of what was there before a reset or import, just in case a grown-up tapped by mistake
function keepBeforeClear(){ try { if (store.P && hasProgress(store.P)) lsSet(PRE, JSON.stringify(store.P)); } catch (e) {} }

// clears to defaults and saves (only the parent screen calls this); sound settings are kept
export function resetProgress(){
  keepBeforeClear();
  const settings = { ...obj(store.P && store.P.settings) };
  const next = defaults();
  next.settings = { ...next.settings, ...settings };
  next.clearedAt = Date.now();
  replaceP(next);
  save();
  lsSet(BAK, JSON.stringify(store.P));
}

/* ---------- progress queries ---------- */
export const countGot = W => W.words.filter((_, i) => store.P.got[wordOf(W.id, i).key]).length;
export const gotTotal = () => WORLDS.reduce((a, W) => a + countGot(W), 0);
export const itemOf = (cid, id) => { const c = SHOP.find(c => c.id === cid); return c ? c.items.find(it => it[0] === id) : undefined; };
export const owns = (cid, id) => { const it = itemOf(cid, id); return !!it && (it[3] === 0 || !!store.P.owned[cid + ':' + id]); };
