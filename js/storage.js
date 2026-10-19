// storage.js (owner: core) — saved progress. Rewards must never reset by accident.
// localStorage 'rainbow-words-v1' is the primary copy (players already have progress there),
// 'rainbow-words-v1.bak' keeps the last good copy seen at boot, IndexedDB mirrors every save.
import { store } from './state.js';
import { WORLDS, SHOP, DEF_WEAR, wordOf } from './data.js';

const KEY = 'rainbow-words-v1', BAK = KEY + '.bak', BAD = KEY + '.corrupt';
const DB_NAME = 'rainbow-words', DB_STORE = 'kv', DB_KEY = 'P';

const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const obj = o => (isObj(o) ? o : {});

export function defaults(){
  return { v:2, stars:0, got:{}, owned:{}, wear:{ ...DEF_WEAR },
    settings:{ music:true, sfx:true }, stats:{ games:0, firstPlayed:0, lastPlayed:0 }, updatedAt:0 };
}
// migrate any older shape to v2; unknown fields are preserved
function normalize(d){
  const P = Object.assign({}, obj(d));
  P.v = 2;
  P.stars = Math.max(0, Math.floor(Number(P.stars) || 0));
  P.got = { ...obj(P.got) };
  P.owned = { ...obj(P.owned) };
  P.wear = { ...DEF_WEAR, ...obj(P.wear) };
  P.settings = { music:true, sfx:true, ...obj(P.settings) };
  P.stats = { games:0, firstPlayed:0, lastPlayed:0, ...obj(P.stats) };
  P.updatedAt = Number(P.updatedAt) || 0;
  return P;
}
function parse(raw){
  if (!raw) return null;
  try { const d = JSON.parse(raw); return isObj(d) ? d : null; } catch (e) { return null; }
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

// replace store.P's contents in place so any module holding a reference sees the new data
function replaceP(next){
  if (!store.P) { store.P = next; return; }
  for (const k of Object.keys(store.P)) delete store.P[k];
  Object.assign(store.P, next);
}

/* ---------- IndexedDB mirror ---------- */
let dbp = null;
function db(){
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      if (typeof indexedDB === 'undefined') return res(null);
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(DB_STORE); } catch (e) {} };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
async function idbPut(val){
  const d = await db(); if (!d) return;
  try { d.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(val, DB_KEY); } catch (e) {}
}
async function idbGet(){
  const d = await db(); if (!d) return null;
  return new Promise(res => {
    try {
      const r = d.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}

const restoredCbs = [];
export function onRestored(cb){ if (typeof cb === 'function') restoredCbs.push(cb); }

// after boot: if IndexedDB holds a newer copy (e.g. localStorage was cleared), bring it back
async function syncFromMirror(){
  const raw = await idbGet();
  const d = typeof raw === 'string' ? parse(raw) : isObj(raw) ? raw : null;
  if (d) {
    const m = normalize(d);
    if (m.updatedAt > (store.P.updatedAt || 0)) {
      replaceP(m);
      lsSet(KEY, JSON.stringify(store.P));
      restoredCbs.forEach(cb => { try { cb(); } catch (e) {} });
      return;
    }
  }
  if (store.P.updatedAt || hasProgress(store.P)) idbPut(JSON.stringify(store.P));
}
const hasProgress = P => P.stars > 0 || Object.keys(P.got).length > 0 || Object.keys(P.owned).length > 0;

/* ---------- public API ---------- */
// sync. Reads saved progress, migrates, sets and returns store.P. Never throws.
export function load(){
  try {
    const raw = lsGet(KEY), rawBak = lsGet(BAK);
    let d = parse(raw), fromBak = false;
    if (!d) {
      if (raw) lsSet(BAD, raw);            // keep the broken copy for inspection, never silently drop it
      d = parse(rawBak); fromBak = !!d;
    }
    replaceP(d ? normalize(d) : defaults());
    if (d && !fromBak) lsSet(BAK, raw);    // last good copy
    if (fromBak) lsSet(KEY, JSON.stringify(store.P));
  } catch (e) {
    if (!store.P) store.P = defaults();
  }
  syncFromMirror().catch(() => {});
  return store.P;
}

// sync write to localStorage + async mirror to IndexedDB. Stamps P.updatedAt.
export function save(){
  const P = store.P; if (!P) return;
  P.updatedAt = Date.now();
  let s;
  try { s = JSON.stringify(P); } catch (e) { return; }
  lsSet(KEY, s);
  idbPut(s);
}

// navigator.storage.persist() once, after a user gesture; safe to call often
let persistAsked = false;
export function requestPersist(){
  if (persistAsked) return;
  persistAsked = true;
  try {
    const st = navigator.storage;
    if (st && st.persist) (st.persisted ? st.persisted() : Promise.resolve(false)).then(p => p || st.persist()).catch(() => {});
  } catch (e) {}
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
export function exportCode(){
  const P = store.P;
  const body = b64urlEncode(JSON.stringify({ v:2, stars:P.stars, got:P.got, owned:P.owned, wear:P.wear, stats:P.stats }));
  return `RW1-${body}-${fnv(body)}`;
}
export function importCode(text){
  const bad = { ok:false, error:'코드가 올바르지 않아요. 처음부터 끝까지 그대로 붙여 넣어 주세요.' };
  try {
    const m = String(text || '').replace(/\s+/g, '').match(/^RW1-([A-Za-z0-9_-]+)-([0-9a-z]+)$/);
    if (!m || fnv(m[1]) !== m[2]) return bad;
    const d = parse(b64urlDecode(m[1]));
    if (!d || typeof d.stars !== 'number') return bad;
    const next = normalize({ ...store.P, stars:d.stars, got:obj(d.got), owned:obj(d.owned), wear:obj(d.wear), stats:{ ...obj(store.P.stats), ...obj(d.stats) } });
    replaceP(next);
    save();
    return { ok:true };
  } catch (e) { return bad; }
}

// clears to defaults and saves (only the parent screen calls this); sound settings are kept
export function resetProgress(){
  const settings = { ...obj(store.P && store.P.settings) };
  const next = defaults();
  next.settings = { ...next.settings, ...settings };
  replaceP(next);
  save();
}

/* ---------- progress queries ---------- */
export const countGot = W => W.words.filter((_, i) => store.P.got[wordOf(W.id, i).key]).length;
export const gotTotal = () => WORLDS.reduce((a, W) => a + countGot(W), 0);
export const itemOf = (cid, id) => { const c = SHOP.find(c => c.id === cid); return c ? c.items.find(it => it[0] === id) : undefined; };
export const owns = (cid, id) => { const it = itemOf(cid, id); return !!it && (it[3] === 0 || !!store.P.owned[cid + ':' + id]); };
